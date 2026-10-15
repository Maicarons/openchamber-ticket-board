import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GuestSessionRecord, GuestSessionsSnapshot } from '@openchamber/sdk';
import { createTask, type TaskStatus } from '../src/domain/task.ts';
import { DEFAULT_SYNC_OPTIONS } from '../src/domain/sync.ts';
import { createSessionSync, type SessionSyncHost } from '../src/host/sessionSync.ts';

const session = (id: string, activity: GuestSessionRecord['activity'], outcome: GuestSessionRecord['outcome'] = null): GuestSessionRecord => ({
  id, title: id, projectId: 'p1', directory: '/x', parentId: null, createdAt: 1, updatedAt: 1, archivedAt: null, worktree: null, activity, outcome, items: [],
});

const snapshot = (projectId: string, sessions: GuestSessionRecord[], state: GuestSessionsSnapshot['state'] = 'ready'): GuestSessionsSnapshot => ({
  kind: 'sessions', projectId, state, coverage: [], sessions,
});

/** Records subscriptions and lets the test push snapshots and track unsubscribes. */
const fakeHost = () => {
  const listeners = new Map<string, (snapshot: GuestSessionsSnapshot) => void>();
  const unsubscribed: string[] = [];
  const host: SessionSyncHost = {
    onSessions: async (projectId, listener) => {
      listeners.set(projectId, listener);
      return () => { unsubscribed.push(projectId); listeners.delete(projectId); };
    },
  };
  return { host, push: (projectId: string, snap: GuestSessionsSnapshot) => listeners.get(projectId)?.(snap), listeners, unsubscribed };
};

test('a running session moves its linked task to in_progress', async () => {
  const { host, push } = fakeHost();
  const changes: Array<[string, string]> = [];
  const sync = createSessionSync(host, DEFAULT_SYNC_OPTIONS, (id, status) => changes.push([id, status]));
  const task = { ...createTask({ title: 't', projectId: 'p1' }, 1), sessionId: 'ses_1' };
  sync.sync([task]);
  await Promise.resolve();
  push('p1', snapshot('p1', [session('ses_1', 'running')]));
  assert.deepEqual(changes, [[task.id, 'in_progress']]);
});

test('only one subscription per project even with several linked tasks', async () => {
  const { host, push } = fakeHost();
  const changes: Array<[string, string]> = [];
  const sync = createSessionSync(host, DEFAULT_SYNC_OPTIONS, (id, status) => changes.push([id, status]));
  const a = { ...createTask({ title: 'a', projectId: 'p1' }, 1), id: 't_a000001', sessionId: 'ses_a' };
  const b = { ...createTask({ title: 'b', projectId: 'p1' }, 2), id: 't_b000002', sessionId: 'ses_b' };
  sync.sync([a, b]);
  await Promise.resolve();
  push('p1', snapshot('p1', [session('ses_a', 'idle', 'completed'), session('ses_b', 'waiting-question')]));
  assert.deepEqual(new Set(changes.map(([id]) => id)), new Set([a.id, b.id]));
  assert.deepEqual(changes.find(([id]) => id === a.id), [a.id, 'review']);
  assert.deepEqual(changes.find(([id]) => id === b.id), [b.id, 'review']);
});

test('dropping the last task for a project releases its subscription', async () => {
  const { host, unsubscribed } = fakeHost();
  const sync = createSessionSync(host, DEFAULT_SYNC_OPTIONS, () => {});
  const task = { ...createTask({ title: 't', projectId: 'p1' }, 1), sessionId: 'ses_1' };
  sync.sync([task]);
  await Promise.resolve();
  sync.sync([]);
  await Promise.resolve();
  assert.deepEqual(unsubscribed, ['p1']);
});

test('a done task does not get moved even while its session keeps running', async () => {
  const { host, push } = fakeHost();
  const changes: unknown[] = [];
  const sync = createSessionSync(host, DEFAULT_SYNC_OPTIONS, (...args) => changes.push(args));
  const task = { ...createTask({ title: 't', projectId: 'p1', status: 'done' as const }, 1), sessionId: 'ses_1' };
  sync.sync([task]);
  await Promise.resolve();
  push('p1', snapshot('p1', [session('ses_1', 'running')]));
  assert.deepEqual(changes, []);
});

test('dispose releases every open subscription', async () => {
  const { host, unsubscribed } = fakeHost();
  const sync = createSessionSync(host, DEFAULT_SYNC_OPTIONS, () => {});
  const task = { ...createTask({ title: 't', projectId: 'p1' }, 1), sessionId: 'ses_1' };
  sync.sync([task]);
  await Promise.resolve();
  sync.dispose();
  await Promise.resolve();
  assert.deepEqual(unsubscribed, ['p1']);
});

test('an archived session reports gone, with no status change', async () => {
  const { host, push } = fakeHost();
  const changes: Array<[string, TaskStatus]> = [];
  const gone: Array<[string, string, string]> = [];
  const sync = createSessionSync(host, DEFAULT_SYNC_OPTIONS, (id, status) => changes.push([id, status]), (id, sessionId, reason) => gone.push([id, sessionId, reason]));
  const task = { ...createTask({ title: 't', projectId: 'p1' }, 1), sessionId: 'ses_1' };
  sync.sync([task]);
  await Promise.resolve();
  push('p1', snapshot('p1', [{ ...session('ses_1', 'idle', 'completed'), archivedAt: 99 }]));
  assert.deepEqual(gone, [[task.id, 'ses_1', 'archived']]);
  assert.deepEqual(changes, []);
});

test('a session absent from a ready snapshot reports gone', async () => {
  const { host, push } = fakeHost();
  const gone: Array<[string, string, string]> = [];
  const sync = createSessionSync(host, DEFAULT_SYNC_OPTIONS, () => {}, (id, sessionId, reason) => gone.push([id, sessionId, reason]));
  const task = { ...createTask({ title: 't', projectId: 'p1' }, 1), sessionId: 'ses_1' };
  sync.sync([task]);
  await Promise.resolve();
  push('p1', snapshot('p1', []));
  assert.deepEqual(gone, [[task.id, 'ses_1', 'deleted']]);
});

test('a session absent from a loading snapshot reports nothing', async () => {
  const { host, push } = fakeHost();
  const gone: Array<[string, string, string]> = [];
  const sync = createSessionSync(host, DEFAULT_SYNC_OPTIONS, () => {}, (id, sessionId, reason) => gone.push([id, sessionId, reason]));
  const task = { ...createTask({ title: 't', projectId: 'p1' }, 1), sessionId: 'ses_1' };
  sync.sync([task]);
  await Promise.resolve();
  push('p1', snapshot('p1', [], 'loading'));
  assert.deepEqual(gone, []);
});

test('once the caller clears the link, the same absence reports nothing further', async () => {
  const { host, push } = fakeHost();
  const gone: Array<[string, string]> = [];
  const sync = createSessionSync(host, DEFAULT_SYNC_OPTIONS, () => {}, (id, sessionId) => gone.push([id, sessionId]));
  const task = { ...createTask({ title: 't', projectId: 'p1' }, 1), sessionId: 'ses_1' };
  sync.sync([task]);
  await Promise.resolve();
  push('p1', snapshot('p1', []));
  assert.equal(gone.length, 1);
  // What the board does in response: the task list with the link cleared.
  sync.sync([{ ...task, sessionId: null }]);
  push('p1', snapshot('p1', []));
  assert.equal(gone.length, 1);
});

test('absence is not trusted while the directory the session was last seen in is still loading', async () => {
  const { host, push } = fakeHost();
  const gone: Array<[string, string, string]> = [];
  const sync = createSessionSync(host, DEFAULT_SYNC_OPTIONS, () => {}, (id, sessionId, reason) => gone.push([id, sessionId, reason]));
  const task = { ...createTask({ title: 't', projectId: 'p1' }, 1), sessionId: 'ses_1' };
  sync.sync([task]);
  await Promise.resolve();
  // First a snapshot that shows the session, remembering its directory...
  push('p1', { kind: 'sessions', projectId: 'p1', state: 'ready', coverage: [{ directory: '/wt', state: 'ready' }], sessions: [{ ...session('ses_1', 'running'), directory: '/wt' }] });
  assert.deepEqual(gone, []);
  // ...then its directory flips to loading while the session is absent: not provably gone.
  push('p1', { kind: 'sessions', projectId: 'p1', state: 'ready', coverage: [{ directory: '/wt', state: 'loading' }], sessions: [] });
  assert.deepEqual(gone, []);
  // ...and once coverage is ready again, the absence is trusted.
  push('p1', { kind: 'sessions', projectId: 'p1', state: 'ready', coverage: [{ directory: '/wt', state: 'ready' }], sessions: [] });
  assert.deepEqual(gone, [[task.id, 'ses_1', 'deleted']]);
});
