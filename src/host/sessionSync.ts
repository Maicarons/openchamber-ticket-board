import type { GuestSessionsSnapshot, HostClient } from '@openchamber/sdk';
import { attentionForSession, DEFAULT_ATTENTION_OPTIONS, type AttentionOptions } from '../domain/sessionSignal.ts';
import { sessionLinkState, type SessionGoneReason } from '../domain/unlink.ts';
import type { TicketWorktree } from '../domain/ticketIndex.ts';

export type SessionSyncHost = Pick<HostClient, 'onSessions'>;

/** The narrow shape the session watcher needs from a ticket link. */
export type WatchedTicket = {
  /** `${projectId}\u0000${path}` */
  id: string;
  projectId: string;
  sessionId: string | null;
  worktree: TicketWorktree | null;
};

/**
 * Watches the live session behind every linked ticket. Reports attention
 * changes (never ticket status) and the disappearance of the session itself —
 * the link must not outlive what it points at. One subscription per project,
 * released as soon as no watched ticket needs it.
 */
export const createSessionSync = (
  host: SessionSyncHost,
  options: AttentionOptions,
  onAttention: (ticketId: string, needsAttention: boolean) => void,
  onSessionGone?: (ticketId: string, sessionId: string, reason: SessionGoneReason) => void,
) => {
  const subscriptions = new Map<string, Promise<() => void>>();
  let ticketsById = new Map<string, WatchedTicket>();
  /** Last-seen directory per session id, so an absent session's per-directory coverage can still be checked. */
  const sessionDirectories = new Map<string, string>();
  let disposed = false;

  const applySnapshot = (projectId: string, snapshot: GuestSessionsSnapshot) => {
    if (disposed) return;
    for (const session of snapshot.sessions) sessionDirectories.set(session.id, session.directory);
    for (const ticket of ticketsById.values()) {
      if (ticket.projectId !== projectId || !ticket.sessionId) continue;
      const linkState = sessionLinkState(ticket.sessionId, sessionDirectories.get(ticket.sessionId) ?? null, snapshot);
      if (onSessionGone && (linkState === 'deleted' || linkState === 'archived')) {
        onSessionGone(ticket.id, ticket.sessionId, linkState);
        continue;
      }
      const session = snapshot.sessions.find((candidate) => candidate.id === ticket.sessionId);
      if (!session) continue;
      const attention = attentionForSession(session.activity, session.outcome, options);
      if (attention !== null) onAttention(ticket.id, attention);
    }
  };

  const watch = (projectId: string) => {
    const promise = host.onSessions(projectId, (snapshot) => applySnapshot(projectId, snapshot));
    subscriptions.set(projectId, promise);
    void promise.then((stop) => {
      if (disposed || !subscriptions.has(projectId)) stop();
    }, () => undefined);
  };

  /** Call whenever the index changes (reload, link, unlink, delete). */
  const sync = (tickets: readonly WatchedTicket[]) => {
    if (disposed) return;
    ticketsById = new Map(tickets.map((ticket) => [ticket.id, ticket]));
    const needed = new Set(tickets.filter((ticket) => ticket.sessionId && ticket.projectId).map((ticket) => ticket.projectId));
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

export { DEFAULT_ATTENTION_OPTIONS };
