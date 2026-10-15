import type { GuestSessionsSnapshot, HostClient } from '@openchamber/sdk';
import { initialStatusForNewSession, isAdoptable } from '../domain/autoTask.ts';
import { DEFAULT_SYNC_OPTIONS, type SyncOptions } from '../domain/sync.ts';
import type { TaskStatus } from '../domain/task.ts';

export type OrphanSessionsHost = Pick<HostClient, 'onProjects' | 'onSessions'>;

export type OrphanFound = { projectId: string; session: { id: string; title: string; createdAt: number }; status: TaskStatus };

/**
 * Watches every registered project for a session with no task pointed at
 * it yet, and reports it — with the status its current activity implies —
 * on every snapshot, not just once. "Going forward only" (not for sessions
 * that pre-date this feature) is enforced by the caller comparing
 * `session.createdAt` against a persisted watermark (`store/orphanWatermark.ts`),
 * not by this watcher: a page-type extension can't stay running across the
 * navigation that starting a session itself causes, so there is no
 * reliable in-memory "first snapshot" to treat as a baseline here — only a
 * persisted cutoff survives the page closing and reopening.
 */
export const watchOrphanSessions = (
  host: OrphanSessionsHost,
  getLinkedSessionIds: () => ReadonlySet<string>,
  onFound: (found: OrphanFound) => void,
  options: SyncOptions = DEFAULT_SYNC_OPTIONS,
) => {
  let disposed = false;
  const projectSubs = new Map<string, Promise<() => void>>();

  const applySnapshot = (projectId: string, snapshot: GuestSessionsSnapshot) => {
    if (disposed) return;
    const linked = getLinkedSessionIds();
    for (const session of snapshot.sessions) {
      if (!isAdoptable(session, linked)) continue;
      const status = initialStatusForNewSession(session, options);
      if (status) onFound({ projectId, session: { id: session.id, title: session.title, createdAt: session.createdAt }, status });
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
