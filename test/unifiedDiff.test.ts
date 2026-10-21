import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildUnifiedDiff } from '../src/domain/unifiedDiff.ts';

test('an unchanged file has no diff to confirm', () => {
  assert.equal(buildUnifiedDiff('.scratch/d/issues/01-x.md', '# A\n\nStatus: claimed\n', '# A\n\nStatus: claimed\n'), '');
});

test('a one-line change produces a git-shaped unified diff', () => {
  const diff = buildUnifiedDiff('.scratch/d/issues/01-x.md', 'a\nb\nc\n', 'a\nB\nc\n');
  assert.equal(
    diff,
    [
      'diff --git a/.scratch/d/issues/01-x.md b/.scratch/d/issues/01-x.md',
      '--- a/.scratch/d/issues/01-x.md',
      '+++ b/.scratch/d/issues/01-x.md',
      '@@ -1,3 +1,3 @@',
      ' a',
      '-b',
      '+B',
      ' c',
    ].join('\n'),
  );
});

test('separated edits produce separate hunks with correct line numbers', () => {
  const before = Array.from({ length: 20 }, (_, index) => `line-${index + 1}`);
  const after = [...before];
  after[1] = 'TWO';
  after[15] = 'SIXTEEN';
  const diff = buildUnifiedDiff('ticket.md', before.join('\n'), after.join('\n'));
  assert.match(diff, /^@@ -1,5 \+1,5 @@/m);
  assert.match(diff, /^@@ -13,7 \+13,7 @@/m);
  assert.match(diff, /^-line-2$/m);
  assert.match(diff, /^\+TWO$/m);
  assert.match(diff, /^-line-16$/m);
  assert.match(diff, /^\+SIXTEEN$/m);
});

test('insertions at the beginning use a zero-length old range', () => {
  const diff = buildUnifiedDiff('ticket.md', '', '# First ticket\n');
  assert.match(diff, /@@ -0,0 \+1 @@/);
  assert.match(diff, /^\+# First ticket$/m);
  const inserted = buildUnifiedDiff('ticket.md', 'a\nb\n', 'new\na\nb\n');
  assert.match(inserted, /@@ -1,2 \+1,3 @@/);
  assert.match(inserted, /^\+new$/m);
});

test('deletions at the end use a zero-length new range', () => {
  const diff = buildUnifiedDiff('ticket.md', 'a\nb\n', 'a\n');
  assert.match(diff, /@@ -1,2 \+1 @@/);
  assert.match(diff, /^-b$/m);
});

test('CRLF and LF versions of the same text do not look edited', () => {
  assert.equal(buildUnifiedDiff('ticket.md', 'a\r\nb\r\n', 'a\nb\n'), '');
});
