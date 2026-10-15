import type { GuestSessionActivity } from '@openchamber/sdk';
import type { TaskStatus } from './task.ts';

export type AgentOutcome = 'completed' | 'failed' | null;

export type SyncOptions = {
  /** Agent is blocked on a tool-permission prompt. Treated like a question by default. */
  waitingPermissionMeansReview: boolean;
  /** The agent's turn ended in an error. */
  failedMeansReview: boolean;
};

export const DEFAULT_SYNC_OPTIONS: SyncOptions = {
  waitingPermissionMeansReview: true,
  failedMeansReview: true,
};

/**
 * Maps a linked session's live state to the task status it implies, or
 * `null` when nothing should change. A task the user marked Done is never
 * moved by this: Done stays a deliberate, user-only action (see board
 * requirements — an agent finishing a turn must not mark a task Done).
 *
 * Rules (as directed): the agent actively working moves the task to
 * In Progress from anywhere; the agent finishing, asking a question, or
 * (per `options`) hitting a permission prompt or a failure moves it to
 * Review, so the user notices without the agent ever claiming "done" itself.
 */
export const statusForSession = (
  current: TaskStatus,
  activity: GuestSessionActivity,
  outcome: AgentOutcome,
  options: SyncOptions = DEFAULT_SYNC_OPTIONS,
): TaskStatus | null => {
  if (current === 'done') return null;
  const toReview = () => (current === 'review' ? null : 'review');
  const toInProgress = () => (current === 'in_progress' ? null : 'in_progress');
  switch (activity) {
    case 'running':
    case 'retrying':
      return toInProgress();
    case 'waiting-question':
      return toReview();
    case 'waiting-permission':
      return options.waitingPermissionMeansReview ? toReview() : null;
    case 'idle':
      if (outcome === 'completed') return toReview();
      if (outcome === 'failed') return options.failedMeansReview ? toReview() : null;
      return null;
    default:
      return null;
  }
};
