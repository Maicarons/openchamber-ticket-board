import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GuestProjectsSnapshot, GuestSessionRecord, GuestSessionsSnapshot } from '@openchamber/sdk';
import { watchOrphanSessions, type OrphanSessionsHost } from '../src/host/orphanSessions.ts';

const session = (id: string, overrides: Partial<GuestSessionRecord> = {}): GuestSessionRecord => ({
  id, title: id, projectId: 'p1', directory: '/x', parentId: null, createdAt: 1000, updatedAt: 1000, archivedAt: null, worktree: null, activity: 'running', outcome: null, items: [],
  ...overrides,
});

const fakeHost = () => {
  const projectListeners: Array<(snapshot: GuestProjectsSnapshot) => void> = [];
  const sessionListeners = new Map<string, (snapshot: GuestSessionsSnapshot) => void>();
  const sessionUnsubscribed: string[] = [];
  const host: OrphanSessionsHost = {
    onProjects: async (listener) => {
      projectListeners.push(listener);
      return () => { projectListeners.splice(projectListeners.indexOf(listener), 1); };
    },
    onSessions: async (projectId, listener) => {
      sessionListeners.set(projectId, listener);
      return () => { sessionUnsubscribed.push(projectId); sessionListeners.delete(projectId); };
    },
  };
  return {
    host,
    pushProjects: (snapshot: GuestProjectsSnapshot) => projectListeners.forEach((l) => l(snapshot)),
    pushSessions: (projectId: string, snapshot: GuestSessionsSnapshot) => sessionListeners.get(projectId)?.(snapshot),
    sessionUnsubscribed,
  };
};

const projectsSnapshot = (ids: string[]): GuestProjectsSnapshot => ({
  kind: 'projects', state: 'ready', projects: ids.map((id) => ({ id, name: id, directory: `/${id}` })),
});

const sessionsSnapshot = (projectId: string, sessions: GuestSessionRecord[]): GuestSessionsSnapshot => ({
  kind: 'sessions', projectId, state: 'ready', coverage: [], sessions,
});

test('reports an adoptable session with its implied status and createdAt, across every registered project', async () => {
  const { host, pushProjects, pushSessions } = fakeHost();
  const found: Array<{ projectId: string; id: string; status: string; createdAt: number }> = [];
  const watcher = watchOrphanSessions(host, () => new Set(), (f) => found.push({ projectId: f.projectId, id: f.session.id, status: f.status, createdAt: f.session.createdAt }));
  pushProjects(projectsSnapshot(['p1', 'p2']));
  await Promise.resolve();
  pushSessions('p1', sessionsSnapshot('p1', [session('ses_a', { createdAt: 500 })]));
  pushSessions('p2', sessionsSnapshot('p2', [session('ses_b', { activity: 'waiting-question', createdAt: 700 })]));
  assert.deepEqual(found.sort((a, b) => a.id.localeCompare(b.id)), [
    { projectId: 'p1', id: 'ses_a', status: 'in_progress', createdAt: 500 },
    { projectId: 'p2', id: 'ses_b', status: 'review', createdAt: 700 },
  ]);
  watcher.dispose();
});

test('every snapshot is checked, not just the first — so a session not active enough yet is still caught once it starts running', async () => {
  const { host, pushProjects, pushSessions } = fakeHost();
  const found: string[] = [];
  const watcher = watchOrphanSessions(host, () => new Set(), (f) => found.push(f.status));
  pushProjects(projectsSnapshot(['p1']));
  await Promise.resolve();
  pushSessions('p1', sessionsSnapshot('p1', [session('ses_new', { activity: 'idle', outcome: null })]));
  pushSessions('p1', sessionsSnapshot('p1', [session('ses_new', { activity: 'running' })]));
  assert.deepEqual(found, ['in_progress']);
  watcher.dispose();
});

test('a session already linked to a task is never reported', async () => {
  const { host, pushProjects, pushSessions } = fakeHost();
  const found: unknown[] = [];
  const watcher = watchOrphanSessions(host, () => new Set(['ses_a']), (f) => found.push(f));
  pushProjects(projectsSnapshot(['p1']));
  await Promise.resolve();
  pushSessions('p1', sessionsSnapshot('p1', [session('ses_a')]));
  assert.deepEqual(found, []);
  watcher.dispose();
});

test('dropping a project releases its session subscription', async () => {
  const { host, pushProjects, sessionUnsubscribed } = fakeHost();
  const watcher = watchOrphanSessions(host, () => new Set(), () => {});
  pushProjects(projectsSnapshot(['p1', 'p2']));
  await Promise.resolve();
  pushProjects(projectsSnapshot(['p1']));
  await Promise.resolve();
  assert.deepEqual(sessionUnsubscribed, ['p2']);
  watcher.dispose();
});

test('dispose releases every subscription', async () => {
  const { host, pushProjects, sessionUnsubscribed } = fakeHost();
  const watcher = watchOrphanSessions(host, () => new Set(), () => {});
  pushProjects(projectsSnapshot(['p1']));
  await Promise.resolve();
  watcher.dispose();
  await Promise.resolve();
  assert.deepEqual(sessionUnsubscribed, ['p1']);
});
