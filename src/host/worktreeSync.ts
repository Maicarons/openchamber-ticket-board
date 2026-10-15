import type { GuestWorktreesSnapshot, HostClient } from '@openchamber/sdk';
import { worktreeLinkState } from '../domain/unlink.ts';
import type { Task } from '../domain/task.ts';

export type WorktreeSyncHost = Pick<HostClient, 'onWorktrees'>;

/**
 * Watches the live worktree state behind every task that has one linked, and
 * reports the task when its worktree is deleted from the sidebar — the link
 * must not outlive what it points at. Same shape as `sessionSync`: one
 * subscription per distinct project among those tasks, released once no
 * watched task still needs it.
 */
export const createWorktreeSync = (
  host: WorktreeSyncHost,
  onWorktreeGone: (taskId: string) => void,
) => {
  const subscriptions = new Map<string, Promise<() => void>>();
  let tasksById = new Map<string, Task>();
  let disposed = false;

  const applySnapshot = (projectId: string, snapshot: GuestWorktreesSnapshot) => {
    if (disposed) return;
    for (const task of tasksById.values()) {
      if (task.projectId !== projectId || !task.worktree) continue;
      if (worktreeLinkState(task.worktree.directory, snapshot) === 'gone') onWorktreeGone(task.id);
    }
  };

  const watch = (projectId: string) => {
    const promise = host.onWorktrees(projectId, (snapshot) => applySnapshot(projectId, snapshot));
    subscriptions.set(projectId, promise);
    void promise.then((stop) => {
      if (disposed || !subscriptions.has(projectId)) stop();
    }, () => undefined);
  };

  /** Call whenever the task list changes (reload, link, create, delete, move). */
  const sync = (tasks: readonly Task[]) => {
    if (disposed) return;
    tasksById = new Map(tasks.map((task) => [task.id, task]));
    const needed = new Set(tasks.filter((task) => task.worktree && task.projectId).map((task) => task.projectId as string));
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
