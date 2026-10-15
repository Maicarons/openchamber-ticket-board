import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StartSessionResult } from '@openchamber/sdk';
import {
  buildBaseBranchOptions,
  buildBaseBranchOptionsFromService,
  buildSessionWorktree,
  CUSTOM_BASE_BRANCH_OPTION,
  describeWorktreeOption,
  hasKnownBranches,
  parseBranchServiceResponse,
  parseGitRefOutput,
  resolveBaseBranch,
  resolveTaskWorktree,
} from '../src/domain/worktree.ts';

test('buildSessionWorktree maps the picker selection to the startSession shape', () => {
  assert.equal(buildSessionWorktree('root', '', undefined), false);
  assert.deepEqual(buildSessionWorktree('new', '', undefined), { kind: 'new' });
  assert.deepEqual(buildSessionWorktree('new', ' fix/login ', 'main'), { kind: 'new', name: 'fix/login', baseBranch: 'main' });
  assert.deepEqual(buildSessionWorktree('/repo/.worktrees/foo', '', undefined), { kind: 'existing', directory: '/repo/.worktrees/foo' });
});

test('buildBaseBranchOptions lists each distinct worktree branch, plus the default and custom options', () => {
  const worktrees = [
    { directory: '/a', name: 'a', branch: 'main', status: 'ready' as const },
    { directory: '/b', name: 'b', branch: 'develop', status: 'ready' as const },
    { directory: '/c', name: 'c', branch: 'main', status: 'pending' as const },
  ];
  assert.deepEqual(buildBaseBranchOptions(worktrees), [
    { id: '', label: 'Use project default' },
    { id: 'develop', label: 'develop' },
    { id: 'main', label: 'main' },
    { id: '__custom__', label: 'Custom branch…' },
  ]);
  assert.deepEqual(buildBaseBranchOptions([]), [{ id: '', label: 'Use project default' }, { id: '__custom__', label: 'Custom branch…' }]);
});

test('resolveBaseBranch picks the dropdown value, or the trimmed custom field when "Custom branch…" is selected', () => {
  assert.equal(resolveBaseBranch('', 'ignored'), undefined);
  assert.equal(resolveBaseBranch('main', 'ignored'), 'main');
  assert.equal(resolveBaseBranch(CUSTOM_BASE_BRANCH_OPTION, '  release/2.0  '), 'release/2.0');
  assert.equal(resolveBaseBranch(CUSTOM_BASE_BRANCH_OPTION, '   '), undefined);
});

test('resolveTaskWorktree prefers the host-reported worktree', () => {
  const success: StartSessionResult = { sessionId: 'ses_1', sent: 'sent', worktree: { directory: '/repo/.worktrees/x', name: 'x', branch: 'fix/x', status: 'ready' } };
  assert.deepEqual(resolveTaskWorktree(false, success), { directory: '/repo/.worktrees/x', branch: 'fix/x' });
});

test('resolveTaskWorktree falls back to the requested existing directory when the host omits it', () => {
  const success: StartSessionResult = { sessionId: 'ses_1', sent: 'sent' };
  const requested = { kind: 'existing' as const, directory: '/repo/.worktrees/x' };
  assert.deepEqual(resolveTaskWorktree(requested, success), { directory: '/repo/.worktrees/x', branch: null });
});

test('resolveTaskWorktree is null for project root and for a failed creation', () => {
  const success: StartSessionResult = { sessionId: 'ses_1', sent: 'sent' };
  assert.equal(resolveTaskWorktree(false, success), null);
  const failure: StartSessionResult = { sessionId: null, sent: 'skipped', directory: '/repo/.worktrees/x', worktree: { directory: '/repo/.worktrees/x', name: 'x', branch: 'x', status: 'pending' }, failure: 'bootstrap-failed' };
  assert.equal(resolveTaskWorktree(false, failure), null);
});

test('parseGitRefOutput reads local and remote branches, skipping each remote\'s own HEAD pointer', () => {
  const stdout = 'refs/heads/main\nrefs/heads/fix/login\nrefs/remotes/origin/main\nrefs/remotes/origin/HEAD\n';
  assert.deepEqual(parseGitRefOutput(stdout), [
    { name: 'main', kind: 'local' },
    { name: 'fix/login', kind: 'local' },
    { name: 'origin/main', kind: 'remote' },
  ]);
  assert.deepEqual(parseGitRefOutput(''), []);
});

test('buildBaseBranchOptionsFromService groups local before remote, preserves the given (recency) order within each, deduplicated', () => {
  const branches = [
    { name: 'fix/login', kind: 'local' as const },
    { name: 'origin/develop', kind: 'remote' as const },
    { name: 'main', kind: 'local' as const },
    { name: 'fix/login', kind: 'local' as const },
  ];
  assert.deepEqual(buildBaseBranchOptionsFromService(branches), [
    { id: '', label: 'Use project default' },
    { id: 'fix/login', label: 'fix/login', hint: undefined },
    { id: 'main', label: 'main', hint: undefined },
    { id: 'origin/develop', label: 'origin/develop', hint: 'remote' },
    { id: '__custom__', label: 'Custom branch…' },
  ]);
});

test('parseBranchServiceResponse accepts a valid answer and rejects anything else as unusable, not throwing', () => {
  assert.deepEqual(parseBranchServiceResponse('{"branches":[{"name":"main","kind":"local"},{"name":"origin/x","kind":"remote"},{"name":""},{"notAName":1}]}'), [
    { name: 'main', kind: 'local' },
    { name: 'origin/x', kind: 'remote' },
  ]);
  assert.equal(parseBranchServiceResponse('not json'), null);
  assert.equal(parseBranchServiceResponse('{"error":"not-a-repo"}'), null);
  assert.equal(parseBranchServiceResponse('[]'), null);
});

test('hasKnownBranches is false for a project with no existing worktrees — the common case', () => {
  assert.equal(hasKnownBranches([]), false);
  assert.equal(hasKnownBranches([{ directory: '/a', name: 'a', branch: 'main', status: 'ready' }]), true);
});

test('describeWorktreeOption disables anything not ready', () => {
  assert.deepEqual(describeWorktreeOption({ directory: '/d', name: 'd', branch: 'b', status: 'ready' }), { id: '/d', label: 'd', hint: 'ready', disabled: false });
  assert.equal(describeWorktreeOption({ directory: '/d', name: 'd', branch: 'b', status: 'pending' }).disabled, true);
});
