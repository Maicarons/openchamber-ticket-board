import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HostRequestError, type GuestProject, type GuestSessionsSnapshot } from '@openchamber/sdk';
import { describeHostError, describeStartSessionDelivery, fetchSessions, fetchWorktrees, projectForDirectory, type WorkspaceHost } from '../src/host/workspace.ts';

const project = (id: string, directory: string): GuestProject => ({ id, name: id, directory });

const sessionsHost = (snapshots: GuestSessionsSnapshot[], onSubscribe?: () => void): WorkspaceHost => ({
  onProjects: async () => () => {},
  onWorktrees: async () => () => {},
  openSession: async () => {},
  onSessions: async (_projectId, listener) => {
    onSubscribe?.();
    for (const snapshot of snapshots) listener(snapshot);
    return () => {};
  },
});

test('fetchSessions resolves on the first ready snapshot, newest first, parents only', async () => {
  const host = sessionsHost([
    { kind: 'sessions', projectId: 'p1', state: 'loading', coverage: [], sessions: [] },
    {
      kind: 'sessions', projectId: 'p1', state: 'ready', coverage: [],
      sessions: [
        { id: 'a', title: 'A', projectId: 'p1', directory: '/x', parentId: null, createdAt: 1, updatedAt: 10, archivedAt: null, worktree: null, activity: 'idle', outcome: null, items: [] },
        { id: 'b', title: 'B', projectId: 'p1', directory: '/x', parentId: null, createdAt: 1, updatedAt: 20, archivedAt: null, worktree: null, activity: 'idle', outcome: null, items: [] },
        { id: 'sub', title: 'sub', projectId: 'p1', directory: '/x', parentId: 'a', createdAt: 1, updatedAt: 30, archivedAt: null, worktree: null, activity: 'idle', outcome: null, items: [] },
        { id: 'arch', title: 'arch', projectId: 'p1', directory: '/x', parentId: null, createdAt: 1, updatedAt: 40, archivedAt: 99, worktree: null, activity: 'idle', outcome: null, items: [] },
      ],
    },
  ]);
  const result = await fetchSessions(host, 'p1');
  assert.equal(result.complete, true);
  assert.deepEqual(result.sessions.map((s) => s.id), ['b', 'a']);
});

test('fetchSessions reports incomplete on an error snapshot instead of throwing', async () => {
  const host = sessionsHost([{ kind: 'sessions', projectId: 'p1', state: 'error', coverage: [], sessions: [] }]);
  const result = await fetchSessions(host, 'p1');
  assert.equal(result.complete, false);
  assert.deepEqual(result.sessions, []);
});

test('fetchSessions releases its subscription once settled', async () => {
  let released = false;
  const host: WorkspaceHost = {
    onProjects: async () => () => {},
    onWorktrees: async () => () => {},
    openSession: async () => {},
    onSessions: async (_id, listener) => {
      listener({ kind: 'sessions', projectId: 'p1', state: 'ready', coverage: [], sessions: [] });
      return () => { released = true; };
    },
  };
  await fetchSessions(host, 'p1');
  assert.equal(released, true);
});

test('fetchWorktrees resolves on the first ready snapshot and releases its subscription', async () => {
  let released = false;
  const host: WorkspaceHost = {
    onProjects: async () => () => {},
    onSessions: async () => () => {},
    openSession: async () => {},
    onWorktrees: async (_id, listener) => {
      listener({ kind: 'worktrees', projectId: 'p1', state: 'ready', worktrees: [{ directory: '/d', name: 'd', branch: 'b', status: 'ready' }] });
      return () => { released = true; };
    },
  };
  const result = await fetchWorktrees(host, 'p1');
  assert.equal(result.complete, true);
  assert.deepEqual(result.worktrees, [{ directory: '/d', name: 'd', branch: 'b', status: 'ready' }]);
  assert.equal(released, true);
});

test('projectForDirectory matches exact and nested worktree paths, else null', () => {
  const projects = [project('a', '/repo/a'), project('b', '/repo/b')];
  assert.equal(projectForDirectory(projects, '/repo/a')?.id, 'a');
  assert.equal(projectForDirectory(projects, '/repo/a/.worktrees/foo')?.id, 'a');
  assert.equal(projectForDirectory(projects, '/other'), null);
  assert.equal(projectForDirectory(projects, null), null);
});

test('describeHostError gives an actionable message for known codes and falls back otherwise', () => {
  assert.match(describeHostError(new HostRequestError('NOT_GRANTED', 'x')), /permission/);
  assert.match(describeHostError(new HostRequestError('HOST_TIMEOUT', 'x')), /did not answer/);
  assert.equal(describeHostError(new Error('boom')), 'boom');
  assert.equal(describeHostError('plain'), 'plain');
});

test('describeStartSessionDelivery is null only when the description was actually sent', () => {
  assert.equal(describeStartSessionDelivery('sent'), null);
  assert.match(describeStartSessionDelivery('no-model') ?? '', /model/);
  assert.match(describeStartSessionDelivery('skipped') ?? '', /skipped/);
  assert.match(describeStartSessionDelivery('failed') ?? '', /failed/);
});
