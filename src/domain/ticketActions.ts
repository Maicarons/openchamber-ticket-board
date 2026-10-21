import { isClaimedStatus, isResolvedStatus, ticketRef, type Ticket } from './ticket.ts';
import { blockingReasons, isFrontierCandidate } from './ticketColumns.ts';
import { triageRoleForStatus, type TriageLabels } from './triageLabels.ts';
import { translator, type Language } from '../i18n.ts';

/**
 * The board is a launcher, not an agent. Each action only writes a prompt into
 * the ticket's description box; the existing Start Agent button sends it. The
 * prompt always carries the skill name, the ticket's own reference, and the
 * feature/effort, so the agent does not have to guess what the board meant.
 */
export type TicketActionId =
  | 'wayfinder'
  | 'to-tickets'
  | 'to-spec'
  | 'triage'
  | 'implement'
  | 'implement-spec'
  | 'code-review'
  | 'handoff';

export type TicketAction = {
  id: TicketActionId;
  label: string;
  skill: string;
  prompt: string;
  disabledReason: string | null;
};

export type ActionContext = {
  feature: string;
  hasSpec: boolean;
  hasMap: boolean;
  specPath: string | null;
  mapPath: string | null;
  siblings: readonly Ticket[];
  labels?: TriageLabels;
  /** A branch or commit the review should compare against; defaults to `main`. */
  reviewBase?: string;
};

export const SETUP_PROMPT = '/setup-matt-pocock-skills';

const refOf = (ticket: Ticket): string => ticketRef(ticket, 'local') || ticket.slug;

const header = (ticket: Ticket, context: ActionContext): string => {
  const parts = [`Ticket: ${refOf(ticket)} — ${ticket.title}`];
  if (context.feature) parts.push(`Feature: ${context.feature}`);
  parts.push(`Path: ${ticket.path}`);
  return parts.join('\n');
};

const promptFor = (skill: string, target: string, ticket: Ticket | null, context: ActionContext): string => {
  const lines = [`/${skill}${target ? ` ${target}` : ''}`];
  if (ticket) lines.push('', header(ticket, context));
  else if (context.feature) lines.push('', `Feature: ${context.feature}`);
  return lines.join('\n');
};

const triageNeeded = (ticket: Ticket, labels?: TriageLabels): boolean => {
  const role = triageRoleForStatus(ticket.status, labels);
  return ticket.status === null || role === 'needs-triage' || role === 'needs-info';
};

/**
 * Every action carries the reason it cannot run right now, so the button can
 * be disabled with an explanation instead of failing after a click.
 */
export const actionsForTicket = (
  ticket: Ticket,
  context: ActionContext,
  language: Language = 'en',
): TicketAction[] => {
  const t = translator(language);
  const labels = context.labels;
  const blocked = blockingReasons(ticket, context.siblings, labels, language);
  const resolved = isResolvedStatus(ticket.status) || triageRoleForStatus(ticket.status, labels) === 'wontfix';
  const claimed = isClaimedStatus(ticket.status);
  const frontier = isFrontierCandidate(ticket, context.siblings, labels);
  const specPath = context.specPath ?? (context.feature ? `.scratch/${context.feature}/spec.md` : 'spec.md');

  const action = (
    id: TicketActionId,
    label: string,
    skill: string,
    target: string,
    disabledReason: string | null,
    subject: Ticket | null = ticket,
  ): TicketAction => ({
    id,
    label,
    skill,
    prompt: promptFor(skill, target, subject, context),
    disabledReason,
  });

  return [
    action(
      'triage',
      t('action.triage'),
      'triage',
      refOf(ticket),
      resolved
        ? t('action.reason.resolved')
        : claimed
          ? t('action.reason.claimed')
          : triageNeeded(ticket, context.labels)
            ? null
            : t('action.reason.alreadyTriaged', { status: ticket.status ?? '' }),
    ),
    action(
      'implement',
      t('action.implement'),
      'implement',
      ticket.path,
      resolved
        ? t('action.reason.resolved')
        : claimed
          ? t('action.reason.alreadyClaimed')
          : blocked.length
            ? t('action.reason.blocked', { reasons: blocked.join('; ') })
            : frontier
              ? null
              : t('action.reason.notReady', { status: ticket.status ?? t('action.emptyStatus') }),
    ),
    action(
      'implement-spec',
      t('action.implementSpec'),
      'implement-spec',
      specPath,
      !context.feature
        ? t('action.reason.noFeature')
        : !context.hasSpec
          ? t('action.reason.noSpec', { feature: context.feature })
          : null,
    ),
    action(
      'to-tickets',
      t('action.toTickets'),
      'to-tickets',
      specPath,
      !context.feature
        ? t('action.reason.noFeature')
        : !context.hasSpec
          ? t('action.reason.noSpec', { feature: context.feature })
          : null,
    ),
    action(
      'to-spec',
      t('action.toSpec'),
      'to-spec',
      context.feature,
      !context.feature ? t('action.reason.noFeature') : null,
      null,
    ),
    action(
      'wayfinder',
      t('action.wayfinder'),
      'wayfinder',
      context.feature || ticket.path,
      resolved ? t('action.reason.resolved') : null,
      null,
    ),
    action(
      'code-review',
      t('action.codeReview'),
      'code-review',
      context.reviewBase?.trim() || 'main',
      !context.feature ? t('action.reason.noFeature') : resolved || claimed ? null : t('action.reason.nothingImplemented'),
    ),
    action(
      'handoff',
      t('action.handoff'),
      'handoff',
      ticket.path,
      null,
    ),
  ];
};

export const enabledActions = (ticket: Ticket, context: ActionContext, language: Language = 'en'): TicketAction[] =>
  actionsForTicket(ticket, context, language).filter((action) => action.disabledReason === null);
