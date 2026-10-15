import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionLinkState, worktreeLinkState, type SessionsView, type WorktreesView } from '../src/domain/unlink.ts';

const sessionView = (overrides: Partial<SessionsView> = {}): SessionsView => ({ state: 'ready', coverage: [], sessions: [], ...overrides });
const worktreeView = (overrides: Partial<WorktreesView> = {}): WorktreesView => ({ state: 'ready', worktrees: [], ...overrides });

const present = (id: string, directory = '/repo') => ({ id, directory, archivedAt: null as number | null });

test('sessionLinkState: a present, unarchived session is linked', () => {
  assert.equal(sessionLinkState('ses_1', null, sessionView({ sessions: [present('ses_1')] })), 'linked');
});

test('sessionLinkState: an archived session is gone, even though it is still listed', () => {
  assert.equal(sessionLinkState('ses_1', null, sessionView({ sessions: [{ ...present('ses_1'), archivedAt: 99 }] })), 'gone');
});

test('sessionLinkState: absence from a fully loaded snapshot is gone', () => {
  assert.equal(sessionLinkState('ses_1', null, sessionView()), 'gone');
  assert.equal(sessionLinkState('ses_1', '/repo', sessionView()), 'gone');
});

test('sessionLinkState: absence from an unfinished snapshot is unknown, never gone', () => {
  assert.equal(sessionLinkState('ses_1', null, sessionView({ state: 'loading' })), 'unknown');
  assert.equal(sessionLinkState('ses_1', null, sessionView({ state: 'error' })), 'unknown');
});

test('sessionLinkState: absence is unknown while the session directory it was last seen in is still loading', () => {
  const coverage = [{ directory: '/repo/.worktrees/x', state: 'loading' as const }];
  assert.equal(sessionLinkState('ses_1', '/repo/.worktrees/x', sessionView({ coverage })), 'unknown');
  assert.equal(sessionLinkState('ses_1', '/repo/.worktrees/x', sessionView({ coverage: [{ directory: '/repo/.worktrees/x', state: 'ready' as const }] })), 'gone');
});

test('sessionLinkState: with no known directory, one not-ready coverage entry anywhere is unknown; all ready is gone', () => {
  assert.equal(sessionLinkState('ses_1', null, sessionView({ coverage: [{ directory: '/other', state: 'loading' as const }] })), 'unknown');
  assert.equal(sessionLinkState('ses_1', null, sessionView({ coverage: [{ directory: '/other', state: 'ready' as const }] })), 'gone');
});

test('sessionLinkState: a ready coverage entry for a different directory does not block a known-directory absence', () => {
  const coverage = [
    { directory: '/repo/.worktrees/x', state: 'ready' as const },
    { directory: '/elsewhere', state: 'loading' as const },
  ];
  assert.equal(sessionLinkState('ses_1', '/repo/.worktrees/x', sessionView({ coverage })), 'gone');
});

test('worktreeLinkState: present and on disk is linked; pending and invalid are not deletions', () => {
  assert.equal(worktreeLinkState('/d', worktreeView({ worktrees: [{ directory: '/d', status: 'ready' }] })), 'linked');
  assert.equal(worktreeLinkState('/d', worktreeView({ worktrees: [{ directory: '/d', status: 'pending' }] })), 'linked');
  assert.equal(worktreeLinkState('/d', worktreeView({ worktrees: [{ directory: '/d', status: 'invalid' }] })), 'linked');
});

test('worktreeLinkState: absent from a finished snapshot, or reported missing, is gone', () => {
  assert.equal(worktreeLinkState('/d', worktreeView()), 'gone');
  assert.equal(worktreeLinkState('/d', worktreeView({ worktrees: [{ directory: '/d', status: 'missing' }] })), 'gone');
});

test('worktreeLinkState: an unfinished snapshot is unknown, never gone', () => {
  assert.equal(worktreeLinkState('/d', worktreeView({ state: 'loading' })), 'unknown');
  assert.equal(worktreeLinkState('/d', worktreeView({ state: 'error' })), 'unknown');
});
