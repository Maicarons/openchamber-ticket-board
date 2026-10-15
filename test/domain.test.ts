import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPatch, createTask, newTaskId, parseTask, type Task } from '../src/domain/task.ts';
import { ALL_PROJECTS, byReviewUrgency, NO_PROJECT, groupColumns, planDrop, rankAtEnd } from '../src/domain/board.ts';

const make = (title: string, extra: Partial<Task> = {}, rank = 1024): Task => ({
  ...createTask({ title }, rank, 1000, newTaskId(1000 + Math.floor(Math.random() * 1e6))),
  ...extra,
});

test('createTask trims, defaults to backlog, and round-trips through parseTask', () => {
  const task = createTask({ title: '  Fix login  ', description: 'details', projectId: ' p1 ' }, 1024, 5000);
  assert.equal(task.title, 'Fix login');
  assert.equal(task.status, 'backlog');
  assert.equal(task.projectId, 'p1');
  assert.equal(task.sessionId, null);
  assert.deepEqual(parseTask(JSON.parse(JSON.stringify(task))), task);
});

test('createTask rejects an empty or oversized title', () => {
  assert.throws(() => createTask({ title: '   ' }, 1), /needs a title/);
  assert.throws(() => createTask({ title: 'x'.repeat(201) }, 1), /limited/);
});

test('parseTask rejects malformed records instead of guessing', () => {
  const good = createTask({ title: 'ok' }, 1, 1);
  assert.throws(() => parseTask(null));
  assert.throws(() => parseTask({ ...good, status: 'doing' }), /status/);
  assert.throws(() => parseTask({ ...good, id: '../evil' }), /id/);
  assert.throws(() => parseTask({ ...good, schemaVersion: 2 }), /schema/);
});

test('parseTask treats a record saved before needsAttentionSince existed as null, not unreadable', () => {
  const good = createTask({ title: 'old record' }, 1, 1);
  const { needsAttentionSince, ...withoutField } = good;
  assert.equal(parseTask(withoutField).needsAttentionSince, null);
  assert.equal(parseTask({ ...good, needsAttentionSince: 500 }).needsAttentionSince, 500);
  assert.throws(() => parseTask({ ...good, needsAttentionSince: 'soon' }), /needsAttentionSince/);
});

test('applyPatch sets and clears needsAttentionSince', () => {
  const task = createTask({ title: 'a' }, 1, 100);
  assert.equal(applyPatch(task, { needsAttentionSince: 500 }).needsAttentionSince, 500);
  assert.equal(applyPatch(task, { needsAttentionSince: null }).needsAttentionSince, null);
});

test('applyPatch updates only patched fields and bumps updatedAt', () => {
  const task = createTask({ title: 'a' }, 1, 100);
  const next = applyPatch(task, { status: 'in_progress', sessionId: 'ses_123' }, 200);
  assert.equal(next.status, 'in_progress');
  assert.equal(next.sessionId, 'ses_123');
  assert.equal(next.title, 'a');
  assert.equal(next.updatedAt, 200);
  assert.equal(applyPatch(next, { sessionId: null }, 300).sessionId, null);
  assert.throws(() => applyPatch(task, { status: 'nope' as never }));
});

test('groupColumns filters by project and query and sorts by rank', () => {
  const a = make('alpha', { projectId: 'p1', rank: 3 });
  const b = make('beta', { projectId: 'p1', rank: 1 });
  const c = make('gamma', { projectId: 'p2', status: 'done' });
  const d = make('delta', { projectId: null });
  const all = groupColumns([a, b, c, d], { projectId: ALL_PROJECTS, query: '' });
  assert.deepEqual(all.backlog.map((t) => t.title), ['beta', 'alpha', 'delta']);
  assert.deepEqual(all.done.map((t) => t.title), ['gamma']);
  const p1 = groupColumns([a, b, c, d], { projectId: 'p1', query: '' });
  assert.deepEqual(p1.backlog.map((t) => t.title), ['beta', 'alpha']);
  assert.equal(p1.done.length, 0);
  assert.deepEqual(groupColumns([a, b, c, d], { projectId: NO_PROJECT, query: '' }).backlog.map((t) => t.title), ['delta']);
  assert.deepEqual(groupColumns([a, b, c, d], { projectId: ALL_PROJECTS, query: 'ALP' }).backlog.map((t) => t.title), ['alpha']);
});

test('planDrop places between neighbours, at ends, and into empty columns', () => {
  const x = make('x', { rank: 100 });
  const y = make('y', { rank: 200 });
  const m = make('m', { rank: 999 });
  assert.equal(planDrop([], m.id, null).rank, 1024);
  assert.equal(planDrop([x, y], m.id, y.id).rank, 150);
  assert.equal(planDrop([x, y], m.id, x.id).rank, 100 - 1024);
  assert.equal(planDrop([x, y], m.id, null).rank, 200 + 1024);
  assert.equal(planDrop([x, y, m], m.id, y.id).rank, 150, 'moving within a column ignores its old slot');
});

test('planDrop rebalances when neighbours are too close and keeps order', () => {
  const x = make('x', { rank: 1 });
  const y = make('y', { rank: 1 + 1e-9 });
  const z = make('z', { rank: 5 });
  const m = make('m');
  const plan = planDrop([x, y, z], m.id, y.id);
  const ranks = new Map(plan.rebalance.map((entry) => [entry.id, entry.rank]));
  ranks.set(m.id, plan.rank);
  const order = [x, y, z, m].sort((a, b) => ranks.get(a.id)! - ranks.get(b.id)!).map((t) => t.title);
  assert.deepEqual(order, ['x', 'm', 'y', 'z']);
});

test('rankAtEnd appends after the highest rank in that status', () => {
  const x = make('x', { rank: 10, status: 'todo' });
  const y = make('y', { rank: 50, status: 'backlog' });
  assert.equal(rankAtEnd([x, y], 'todo'), 10 + 1024);
  assert.equal(rankAtEnd([x, y], 'review'), 1024);
});

test('byReviewUrgency puts the most recently unreviewed first, reviewed ones after, by rank', () => {
  const older = make('older unreviewed', { needsAttentionSince: 100, rank: 1 });
  const newer = make('newer unreviewed', { needsAttentionSince: 500, rank: 2 });
  const reviewedA = make('reviewed a', { needsAttentionSince: null, rank: 5 });
  const reviewedB = make('reviewed b', { needsAttentionSince: null, rank: 1 });
  const order = [reviewedA, older, reviewedB, newer].sort(byReviewUrgency).map((t) => t.title);
  assert.deepEqual(order, ['newer unreviewed', 'older unreviewed', 'reviewed b', 'reviewed a']);
});

test('groupColumns sorts only the review column by urgency; every other column stays rank-ordered', () => {
  const stale = make('stale', { status: 'review', needsAttentionSince: 100, rank: 999 });
  const fresh = make('fresh', { status: 'review', needsAttentionSince: 900, rank: 1 });
  const todoLow = make('todo-low', { status: 'todo', rank: 5 });
  const todoHigh = make('todo-high', { status: 'todo', rank: 1 });
  const columns = groupColumns([stale, fresh, todoLow, todoHigh], { projectId: ALL_PROJECTS, query: '' });
  assert.deepEqual(columns.review.map((t) => t.title), ['fresh', 'stale']);
  assert.deepEqual(columns.todo.map((t) => t.title), ['todo-high', 'todo-low']);
});
