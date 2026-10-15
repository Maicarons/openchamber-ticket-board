import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statusForSession } from '../src/domain/sync.ts';

test('a task marked Done is never moved, regardless of activity', () => {
  for (const activity of ['running', 'retrying', 'waiting-question', 'waiting-permission', 'idle'] as const) {
    assert.equal(statusForSession('done', activity, 'completed'), null);
    assert.equal(statusForSession('done', activity, 'failed'), null);
  }
});

test('running or retrying moves to in_progress from anywhere except done', () => {
  for (const status of ['backlog', 'todo', 'review'] as const) {
    assert.equal(statusForSession(status, 'running', null), 'in_progress');
    assert.equal(statusForSession(status, 'retrying', null), 'in_progress');
  }
  assert.equal(statusForSession('in_progress', 'running', null), null, 'no redundant write when already there');
});

test('a clarifying question moves to review', () => {
  assert.equal(statusForSession('in_progress', 'waiting-question', null), 'review');
  assert.equal(statusForSession('todo', 'waiting-question', null), 'review');
  assert.equal(statusForSession('review', 'waiting-question', null), null);
});

test('a permission prompt moves to review only when the option is enabled', () => {
  assert.equal(statusForSession('in_progress', 'waiting-permission', null, { waitingPermissionMeansReview: true, failedMeansReview: true }), 'review');
  assert.equal(statusForSession('in_progress', 'waiting-permission', null, { waitingPermissionMeansReview: false, failedMeansReview: true }), null);
});

test('idle with a completed outcome moves to review; a null outcome does nothing', () => {
  assert.equal(statusForSession('in_progress', 'idle', 'completed'), 'review');
  assert.equal(statusForSession('review', 'idle', 'completed'), null);
  assert.equal(statusForSession('in_progress', 'idle', null), null);
});

test('idle with a failed outcome moves to review only when the option is enabled', () => {
  assert.equal(statusForSession('in_progress', 'idle', 'failed', { waitingPermissionMeansReview: true, failedMeansReview: true }), 'review');
  assert.equal(statusForSession('in_progress', 'idle', 'failed', { waitingPermissionMeansReview: true, failedMeansReview: false }), null);
});

test('an unknown activity never moves the task', () => {
  assert.equal(statusForSession('todo', 'unknown', null), null);
});
