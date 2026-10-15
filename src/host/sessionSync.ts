import type { GuestSessionsSnapshot, HostClient } from '@openchamber/sdk';
import { statusForSession, type SyncOptions } from '../domain/sync.ts';
import type { Task, TaskStatus } from '../domain/task.ts';

export type SessionSyncHost = Pick<HostClient, 'onSessions'>;

/**
 * Watches the live session state behind every task that has one linked, and
 * reports the status change it implies. Subscribes once per distinct
 * project among those tasks (not once per task) and tears a project's
 * subscription down once no watched task still needs it.
 */
export const createSessionSync = (
  host: SessionSyncHost,
  options: SyncOptions,
  onStatusChange: (taskId: string, next: TaskStatus) => void,
) => {
  const subscriptions = new Map<string, Promise<() => void>>();
  let tasksById = new Map<string, Task>();
  let disposed = false;

  const applySnapshot = (projectId: string, snapshot: GuestSessionsSnapshot) => {
    if (disposed) return;
    for (const session of snapshot.sessions) {
      for (const task of tasksById.values()) {
        if (task.projectId !== projectId || task.sessionId !== session.id) continue;
        const next = statusForSession(task.status, session.activity, session.outcome, options);
        if (next) onStatusChange(task.id, next);
      }
    }
  };

  const watch = (projectId: string) => {
    const promise = host.onSessions(projectId, (snapshot) => applySnapshot(projectId, snapshot));
    subscriptions.set(projectId, promise);
    void promise.then((stop) => {
      if (disposed || !subscriptions.has(projectId)) stop();
    }, () => undefined);
  };

  /** Call whenever the task list changes (reload, link, create, delete, move). */
  const sync = (tasks: readonly Task[]) => {
    if (disposed) return;
    tasksById = new Map(tasks.map((task) => [task.id, task]));
    const needed = new Set(tasks.filter((task) => task.sessionId && task.projectId).map((task) => task.projectId as string));
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
