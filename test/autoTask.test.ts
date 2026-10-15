import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TASK_TITLE } from '../src/domain/task.ts';
import { initialStatusForNewSession, isAdoptable, sessionTitleForTask, titleForOrphanSession } from '../src/domain/autoTask.ts';

const base = { id: 'ses_1', title: 'Fix the thing', parentId: null, archivedAt: null, activity: 'running' as const, outcome: null };

test('a real top-level session with no task yet is adoptable', () => {
  assert.equal(isAdoptable(base, new Set()), true);
});

test('a session already linked to a task is not adoptable', () => {
  assert.equal(isAdoptable(base, new Set(['ses_1'])), false);
});

test('a subagent or an archived session is never adoptable', () => {
  assert.equal(isAdoptable({ ...base, parentId: 'ses_0' }, new Set()), false);
  assert.equal(isAdoptable({ ...base, archivedAt: 123 }, new Set()), false);
});

test('initialStatusForNewSession lands the task in In Progress while running, Review once it needs you', () => {
  assert.equal(initialStatusForNewSession({ activity: 'running', outcome: null }), 'in_progress');
  assert.equal(initialStatusForNewSession({ activity: 'retrying', outcome: null }), 'in_progress');
  assert.equal(initialStatusForNewSession({ activity: 'waiting-question', outcome: null }), 'review');
  assert.equal(initialStatusForNewSession({ activity: 'waiting-permission', outcome: null }), 'review');
  assert.equal(initialStatusForNewSession({ activity: 'idle', outcome: 'completed' }), 'review');
  assert.equal(initialStatusForNewSession({ activity: 'idle', outcome: 'failed' }), 'review');
});

test('initialStatusForNewSession is null for a session not active enough yet to adopt', () => {
  assert.equal(initialStatusForNewSession({ activity: 'idle', outcome: null }), null);
  assert.equal(initialStatusForNewSession({ activity: 'unknown', outcome: null }), null);
});

test('titleForOrphanSession uses a real title, trimmed, when there is one', () => {
  assert.equal(titleForOrphanSession({ id: 'ses_abcdefgh', title: '  Fix login  ' }), 'Fix login');
  assert.equal(titleForOrphanSession({ id: 'ses_abcdefgh', title: 'x'.repeat(300) }).length, 200);
});

test('titleForOrphanSession treats an empty title, or the host\'s id-as-title fallback, as "no title yet"', () => {
  assert.equal(titleForOrphanSession({ id: 'ses_abcdefgh', title: '   ' }, 'Example project'), 'New session in Example project');
  assert.equal(titleForOrphanSession({ id: 'ses_abcdefgh', title: 'ses_abcdefgh' }, 'Example project'), 'New session in Example project');
  assert.equal(titleForOrphanSession({ id: 'ses_abcdefgh', title: 'ses_abcdefgh' }, null), 'New session (ses_abcd)');
  assert.equal(titleForOrphanSession({ id: 'ses_abcdefgh', title: '' }), 'New session (ses_abcd)');
});

test('sessionTitleForTask uses a real, renamed title as-is', () => {
  assert.equal(sessionTitleForTask({ title: '  Fix login redirect  ', description: 'anything' }), 'Fix login redirect');
  assert.equal(sessionTitleForTask({ title: 'x'.repeat(300), description: '' }).length, 200);
});

test(`sessionTitleForTask derives from the description's first line when the title is still "${DEFAULT_TASK_TITLE}"`, () => {
  assert.equal(sessionTitleForTask({ title: DEFAULT_TASK_TITLE, description: 'Fix the login redirect bug\nmore detail below' }), 'Fix the login redirect bug');
  assert.equal(sessionTitleForTask({ title: `  ${DEFAULT_TASK_TITLE}  `, description: '  indented first line  \nrest' }), 'indented first line');
  assert.equal(sessionTitleForTask({ title: DEFAULT_TASK_TITLE, description: 'x'.repeat(300) }).length, 200);
});

test(`sessionTitleForTask falls back to "${DEFAULT_TASK_TITLE}" only when there is truly nothing else to go on`, () => {
  assert.equal(sessionTitleForTask({ title: DEFAULT_TASK_TITLE, description: '' }), DEFAULT_TASK_TITLE);
  assert.equal(sessionTitleForTask({ title: DEFAULT_TASK_TITLE, description: '   \n   ' }), DEFAULT_TASK_TITLE);
});
