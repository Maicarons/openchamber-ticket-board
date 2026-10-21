import assert from 'node:assert/strict';
import test from 'node:test';
import { attentionForSession, isUnlinkedSession } from '../src/domain/sessionSignal.ts';

test('a running agent clears attention; a question, finish, failure or permission prompt raises it', () => {
  assert.equal(attentionForSession('running', null), false);
  assert.equal(attentionForSession('retrying', null), false);
  assert.equal(attentionForSession('waiting-question', null), true);
  assert.equal(attentionForSession('waiting-permission', null), true);
  assert.equal(attentionForSession('idle', 'completed'), true);
  assert.equal(attentionForSession('idle', 'failed'), true);
  assert.equal(attentionForSession('idle', null), false);
});

test('the attention options can ignore a permission prompt or a failure', () => {
  const options = { waitingPermissionMeansReview: false, failedMeansReview: false };
  assert.equal(attentionForSession('waiting-permission', null, options), null);
  assert.equal(attentionForSession('idle', 'failed', options), null);
  assert.equal(attentionForSession('idle', 'completed', options), true);
});

test('only a real, top-level, unarchived session with no ticket is unlinked', () => {
  const linked = new Set(['linked']);
  assert.equal(isUnlinkedSession({ id: 'a', parentId: null, archivedAt: null }, linked), true);
  assert.equal(isUnlinkedSession({ id: 'linked', parentId: null, archivedAt: null }, linked), false);
  assert.equal(isUnlinkedSession({ id: 'a', parentId: 'parent', archivedAt: null }, linked), false);
  assert.equal(isUnlinkedSession({ id: 'a', parentId: null, archivedAt: 1 }, linked), false);
});
