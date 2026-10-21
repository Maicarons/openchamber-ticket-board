import type { GuestWorktreesSnapshot, HostClient } from '@openchamber/sdk';
import { worktreeLinkState } from '../domain/unlink.ts';
import type { TicketWorktree } from '../domain/ticketIndex.ts';

export type WorktreeSyncHost = Pick<HostClient, 'onWorktrees'>;

export type WatchedWorktreeTicket = {
  id: string;
  projectId: string;
  worktree: TicketWorktree | null;
};

/**
 * Watches the live worktree behind every linked ticket and clears the link
 * when that worktree is deleted from the sidebar. One subscription per
 * project, same shape as `createSessionSync`.
 */
export const createWorktreeSync = (
  host: WorktreeSyncHost,
  onWorktreeGone: (ticketId: string) => void,
) => {
  const subscriptions = new Map<string, Promise<() => void>>();
  let ticketsById = new Map<string, WatchedWorktreeTicket>();
  let disposed = false;

  const applySnapshot = (projectId: string, snapshot: GuestWorktreesSnapshot) => {
    if (disposed) return;
    for (const ticket of ticketsById.values()) {
      if (ticket.projectId !== projectId || !ticket.worktree) continue;
      if (worktreeLinkState(ticket.worktree.directory, snapshot) === 'gone') onWorktreeGone(ticket.id);
    }
  };

  const watch = (projectId: string) => {
    const promise = host.onWorktrees(projectId, (snapshot) => applySnapshot(projectId, snapshot));
    subscriptions.set(projectId, promise);
    void promise.then((stop) => {
      if (disposed || !subscriptions.has(projectId)) stop();
    }, () => undefined);
  };

  const sync = (tickets: readonly WatchedWorktreeTicket[]) => {
    if (disposed) return;
    ticketsById = new Map(tickets.map((ticket) => [ticket.id, ticket]));
    const needed = new Set(tickets.filter((ticket) => ticket.worktree && ticket.projectId).map((ticket) => ticket.projectId));
    for (const projectId of needed) if (!subscriptions.has(projectId)) watch(projectId);
    for (const [projectId, promise] of subscriptions) {
      if (needed.has(projectId)) continue;
      subscriptions.delete(projectId);
      void promise.then((stop) => stop(), () => undefined);
    }
  };

  const dispose = () => {
    disposed = true;
    for (const promise of subscriptions.values()) void promise.then((stop) => stop(), () => undefined);
    subscriptions.clear();
  };

  return { sync, dispose };
};
