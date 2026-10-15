import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GuestWorktreesSnapshot } from '@openchamber/sdk';
import { createTask } from '../src/domain/task.ts';
import { createWorktreeSync, type WorktreeSyncHost } from '../src/host/worktreeSync.ts';

const worktree = (directory: string, status: GuestWorktreesSnapshot['worktrees'][number]['status'] = 'ready') => ({ directory, name: directory, branch: 'b', status });

const snapshot = (worktrees: GuestWorktreesSnapshot['worktrees'], state: GuestWorktreesSnapshot['state'] = 'ready'): GuestWorktreesSnapshot => ({
  kind: 'worktrees', projectId: 'p1', state, worktrees,
});

/** Records subscriptions and lets the test push snapshots and track unsubscribes. */
const fakeHost = () => {
  const listeners = new Map<string, (snapshot: GuestWorktreesSnapshot) => void>();
  const unsubscribed: string[] = [];
  const host: WorktreeSyncHost = {
    onWorktrees: async (projectId, listener) => {
      listeners.set(projectId, listener);
      return () => { unsubscribed.push(projectId); listeners.delete(projectId); };
    },
  };
  return { host, push: (projectId: string, snap: GuestWorktreesSnapshot) => listeners.get(projectId)?.(snap), unsubscribed };
};

const linkedTask = () => ({ ...createTask({ title: 't', projectId: 'p1' }, 1), worktree: { directory: '/wt', branch: 'fix/x' } as const });

test('a deleted worktree reports its task gone', async () => {
  const { host, push } = fakeHost();
  const gone: string[] = [];
  const sync = createWorktreeSync(host, (taskId) => gone.push(taskId));
  const task = linkedTask();
  sync.sync([task]);
  await Promise.resolve();
  push('p1', snapshot([]));
  assert.deepEqual(gone, [task.id]);
});

test('a worktree reported missing is gone; one still creating or invalid is not', async () => {
  const { host, push } = fakeHost();
  const gone: string[] = [];
  const sync = createWorktreeSync(host, (taskId) => gone.push(taskId));
  const task = linkedTask();
  sync.sync([task]);
  await Promise.resolve();
  push('p1', snapshot([worktree('/wt', 'missing')]));
  assert.deepEqual(gone, [task.id]);
});

test('a loading snapshot reports nothing', async () => {
  const { host, push } = fakeHost();
  const gone: string[] = [];
  const sync = createWorktreeSync(host, (taskId) => gone.push(taskId));
  const task = linkedTask();
  sync.sync([task]);
  await Promise.resolve();
  push('p1', snapshot([], 'loading'));
  assert.deepEqual(gone, []);
});

test('a ready snapshot with the worktree present reports nothing', async () => {
  const { host, push } = fakeHost();
  const gone: string[] = [];
  const sync = createWorktreeSync(host, (taskId) => gone.push(taskId));
  sync.sync([linkedTask()]);
  await Promise.resolve();
  push('p1', snapshot([worktree('/wt')]));
  assert.deepEqual(gone, []);
});

test('dropping the last worktree-linked task releases its subscription, and dispose releases the rest', async () => {
  const { host, push, unsubscribed } = fakeHost();
  const sync = createWorktreeSync(host, () => {});
  const task = linkedTask();
  sync.sync([task]);
  await Promise.resolve();
  // Tasks without a worktree don't need a subscription.
  sync.sync([{ ...task, worktree: null }]);
  await Promise.resolve();
  assert.deepEqual(unsubscribed, ['p1']);
  sync.sync([task]);
  await Promise.resolve();
  sync.dispose();
  await Promise.resolve();
  assert.deepEqual(unsubscribed, ['p1', 'p1']);
});
