import type { GuestSessionsSnapshot, HostClient } from '@openchamber/sdk';
import { isUnlinkedSession, attentionForSession, DEFAULT_ATTENTION_OPTIONS, type AttentionOptions } from '../domain/sessionSignal.ts';

export type OrphanSessionsHost = Pick<HostClient, 'onProjects' | 'onSessions'>;

export type UnlinkedSession = {
  projectId: string;
  session: { id: string; title: string; createdAt: number };
  needsAttention: boolean;
};

/**
 * Watches every registered project for a real session that no ticket points
 * at. The board never turns such a session into a ticket on its own — the
 * ticket file is the source of truth — but it can offer it when the person
 * opens a ticket to link one.
 */
export const watchUnlinkedSessions = (
  host: OrphanSessionsHost,
  getLinkedSessionIds: () => ReadonlySet<string>,
  onFound: (found: UnlinkedSession) => void,
  options: AttentionOptions = DEFAULT_ATTENTION_OPTIONS,
) => {
  let disposed = false;
  const projectSubs = new Map<string, Promise<() => void>>();

  const applySnapshot = (projectId: string, snapshot: GuestSessionsSnapshot) => {
    if (disposed) return;
    const linked = getLinkedSessionIds();
    for (const session of snapshot.sessions) {
      if (!isUnlinkedSession(session, linked)) continue;
      onFound({
        projectId,
        session: { id: session.id, title: session.title, createdAt: session.createdAt },
        needsAttention: attentionForSession(session.activity, session.outcome, options) === true,
      });
    }
  };

  const watchProject = (projectId: string) => {
    if (projectSubs.has(projectId)) return;
    const promise = host.onSessions(projectId, (snapshot) => applySnapshot(projectId, snapshot));
    projectSubs.set(projectId, promise);
    void promise.then((stop) => {
      if (disposed || !projectSubs.has(projectId)) stop();
    }, () => undefined);
  };

  const stopProjectsPromise = host.onProjects((snapshot) => {
    if (disposed) return;
    const ids = new Set(snapshot.projects.map((project) => project.id));
    for (const id of ids) watchProject(id);
    for (const [id, promise] of projectSubs) {
      if (ids.has(id)) continue;
      projectSubs.delete(id);
      void promise.then((stop) => stop(), () => undefined);
    }
  });

  const dispose = () => {
    disposed = true;
    void stopProjectsPromise.then((stop) => stop(), () => undefined);
    for (const promise of projectSubs.values()) void promise.then((stop) => stop(), () => undefined);
    projectSubs.clear();
  };

  return { dispose };
};
