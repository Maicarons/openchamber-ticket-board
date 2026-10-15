import type { GuestSessionActivity } from '@openchamber/sdk';
import { DEFAULT_SYNC_OPTIONS, statusForSession, type AgentOutcome, type SyncOptions } from './sync.ts';
import type { TaskStatus } from './task.ts';

export type OrphanCandidate = {
  id: string;
  title: string;
  parentId: string | null;
  archivedAt: number | null;
  activity: GuestSessionActivity;
  outcome: AgentOutcome;
};

/** Structural eligibility only: a real top-level session, not archived, that no task already points to. */
export const isAdoptable = (session: Pick<OrphanCandidate, 'id' | 'parentId' | 'archivedAt'>, linkedSessionIds: ReadonlySet<string>): boolean =>
  session.parentId === null && session.archivedAt === null && !linkedSessionIds.has(session.id);

/**
 * The column a newly-adopted task should land in, from the session's
 * current activity — reuses the same mapping the live sync uses, just
 * starting from a status ("backlog") no real task has, so the first
 * matching rule always fires. `null` means not active enough yet to adopt
 * (for example, just created with no turn started).
 */
export const initialStatusForNewSession = (
  session: Pick<OrphanCandidate, 'activity' | 'outcome'>,
  options: SyncOptions = DEFAULT_SYNC_OPTIONS,
): TaskStatus | null => statusForSession('backlog', session.activity, session.outcome, options);

/**
 * The host falls back to the session's own id as its `title` until OpenCode
 * generates a real one from the conversation, so a brand-new session's
 * `title` is rarely empty — it's the id itself. Treating only an *empty*
 * title as "no title yet" let that straight through as a confusing
 * `ses_...`-looking task title. `projectName`, when known, makes a much
 * more useful placeholder than the id ever was.
 */
export const titleForOrphanSession = (session: Pick<OrphanCandidate, 'id' | 'title'>, projectName?: string | null): string => {
  const title = session.title.trim();
  if (title && title !== session.id) return title.slice(0, 200);
  return projectName ? `New session in ${projectName}` : `New session (${session.id.slice(0, 8)})`;
};
