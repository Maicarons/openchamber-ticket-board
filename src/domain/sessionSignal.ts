import type { GuestSessionActivity } from '@openchamber/sdk';

export type AgentOutcome = 'completed' | 'failed' | null;

export type AttentionOptions = {
  /** Agent is blocked on a tool-permission prompt. Treated like a question by default. */
  waitingPermissionMeansReview: boolean;
  /** The agent's turn ended in an error. */
  failedMeansReview: boolean;
};

export const DEFAULT_ATTENTION_OPTIONS: AttentionOptions = {
  waitingPermissionMeansReview: true,
  failedMeansReview: true,
};

/**
 * A linked session never writes the ticket's Status. It can only mark the
 * index entry as needing attention — the agent finishing, asking a question,
 * hitting a permission prompt, or failing. The ticket's own Status stays the
 * person's record of what the tracker says.
 */
export const attentionForSession = (
  activity: GuestSessionActivity,
  outcome: AgentOutcome,
  options: AttentionOptions = DEFAULT_ATTENTION_OPTIONS,
): boolean | null => {
  switch (activity) {
    case 'running':
    case 'retrying':
      return false;
    case 'waiting-question':
      return true;
    case 'waiting-permission':
      return options.waitingPermissionMeansReview ? true : null;
    case 'idle':
      if (outcome === 'completed') return true;
      if (outcome === 'failed') return options.failedMeansReview ? true : null;
      return false;
    default:
      return null;
  }
};

/** A real, top-level, not-archived session that no ticket points at. */
export const isUnlinkedSession = (
  session: { id: string; parentId: string | null; archivedAt: number | null },
  linkedSessionIds: ReadonlySet<string>,
): boolean =>
  session.parentId === null && session.archivedAt === null && !linkedSessionIds.has(session.id);
