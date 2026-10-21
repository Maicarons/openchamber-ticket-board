import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTicketContent } from '../src/domain/ticket.ts';
import {
  appendTicketAnswer,
  appendTicketComment,
  applyTicketEdit,
  formatBlockedByRefs,
  isWritableTicketPath,
  previewTicketEdit,
  previewTicketEdits,
  setTicketBlockedBy,
  setTicketStatus,
  TicketEditError,
} from '../src/domain/ticketEdit.ts';

const fixture = (name: string): string => readFileSync(new URL(`./fixtures/matt/${name}`, import.meta.url), 'utf8');
const lines = (text: string): string[] => text.split(/\r?\n/);
const addedLines = (diff: string): string[] =>
  diff
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1));
const removedLines = (diff: string): string[] =>
  diff
    .split('\n')
    .filter((line) => line.startsWith('-') && !line.startsWith('---'))
    .map((line) => line.slice(1));

test('changing Status rewrites exactly that line', () => {
  const before = fixture('02-real-claimed.md');
  const after = setTicketStatus(before, 'ready-for-agent');
  assert.equal(after.includes('Status: ready-for-agent'), true);
  assert.equal(after.includes('Status: claimed'), false);
  const oldLines = lines(before);
  const newLines = lines(after);
  assert.equal(oldLines.length, newLines.length);
  const changed = oldLines.map((line, index) => (line === newLines[index] ? -1 : index)).filter((index) => index >= 0);
  assert.equal(changed.length, 1);
  assert.match(oldLines[changed[0] ?? 0] ?? '', /^Status:/);
  assert.equal(applyTicketEdit(parseTicketContent('.scratch/d/issues/02-x.md', before), { kind: 'status', status: 'ready-for-agent' }), after);
});

test('bold field styles keep their emphasis and spacing', () => {
  const before = '# A ticket\n\n**Status:** ready-for-agent\n**Blocked by:** 01\n\nBody.\n';
  const after = setTicketStatus(before, 'claimed');
  assert.equal(after.includes('**Status:** claimed'), true);
  assert.equal(after.includes('**Blocked by:** 01'), true);
  const blocked = setTicketBlockedBy(after, [2, 3]);
  assert.equal(blocked.includes('**Status:** claimed'), true);
  assert.equal(blocked.includes('**Blocked by:** 02, 03'), true);
  assert.equal(blocked.includes('Body.'), true);
});

test('CRLF tickets stay CRLF and untouched lines keep their bytes', () => {
  const before = '# CRLF\r\n\r\nStatus: claimed\r\nBlocked by: 01\r\n\r\nBody text.  \r\n';
  const after = setTicketStatus(before, 'resolved');
  assert.equal(after, '# CRLF\r\n\r\nStatus: resolved\r\nBlocked by: 01\r\n\r\nBody text.  \r\n');
  const eols = after.match(/\r\n/g) ?? [];
  assert.equal(eols.length, 6);
  assert.equal(/[^\r]\n/.test(after), false);
});

test('a missing Status line is added; a conflict is refused', () => {
  const added = setTicketStatus('# No status\n\nBody.\n', 'needs-triage');
  assert.match(added, /^# No status\n\nStatus: needs-triage\n/);
  assert.match(added, /Body\./);

  const conflict = '# Two\n\nStatus: needs-triage\nStatus: ready-for-human\n';
  assert.throws(
    () => setTicketStatus(conflict, 'ready-for-agent'),
    (error: unknown) => error instanceof TicketEditError && error.code === 'conflict',
  );
});

test('Blocked by writes NN, clears to None, and refuses self-blocking', () => {
  const before = '# A\n\nStatus: ready-for-agent\nBlocked by: 01\n';
  assert.equal(setTicketBlockedBy(before, []).includes('Blocked by: None (can start immediately)'), true);
  assert.equal(setTicketBlockedBy(before, [2, '03', { number: '04', value: 4 }]).includes('Blocked by: 02, 03, 04'), true);
  assert.equal(formatBlockedByRefs([1, '02', { number: '02', value: 2 }]), '01, 02');

  const ticket = parseTicketContent('.scratch/d/issues/02-x.md', before);
  assert.throws(
    () => applyTicketEdit(ticket, { kind: 'blockedBy', blockedBy: [2] }),
    (error: unknown) => error instanceof TicketEditError && error.code === 'invalid',
  );
});

test('a comment is appended under the existing ## Comments, before ## Answer', () => {
  const before = fixture('02-real-claimed.md');
  const after = appendTicketComment(before, 'Please add a regression test.', 'local', '2026-10-21T00:00:00.000Z');
  assert.match(after, /### local — 2026-10-21T00:00:00.000Z\nPlease add a regression test\./);
  assert.equal(after.indexOf('Please add a regression test.') < after.indexOf('## Answer'), true);
  assert.equal(after.includes('First comment.'), true);
  assert.equal(after.includes('Answer body.'), true);
  const diff = previewTicketEdit(parseTicketContent('.scratch/d/issues/02-x.md', before), {
    kind: 'comment',
    body: 'Please add a regression test.',
    author: 'local',
    at: '2026-10-21T00:00:00.000Z',
  }).diff;
  assert.equal(removedLines(diff).length, 0);
  assert.match(addedLines(diff).join('\n'), /Please add a regression test/);
});

test('a comment section is created when the ticket has none', () => {
  const before = '# New\n\nStatus: needs-triage\n';
  const after = appendTicketComment(before, 'First thought.');
  assert.match(after, /\n## Comments\n\n### Board\nFirst thought\./);
  assert.equal(lines(after).slice(0, lines(before).length - 1).join('\n').startsWith('# New'), true);
});

test('answers append under ## Answer without touching the comment or body', () => {
  const before = fixture('02-real-claimed.md');
  const after = appendTicketAnswer(before, 'Resolved by the new parser.');
  assert.equal(after.includes('Answer body.'), true);
  assert.equal(after.includes('Resolved by the new parser.'), true);
  assert.equal(after.indexOf('Answer body.') < after.indexOf('Resolved by the new parser.'), true);
  assert.equal(after.includes('## Comments'), true);
  const diff = previewTicketEdit(parseTicketContent('.scratch/d/issues/02-x.md', before), {
    kind: 'answer',
    body: 'Resolved by the new parser.',
    at: '2026-10-21T00:00:00.000Z',
  }).diff;
  assert.equal(removedLines(diff).length, 0);
});

test('preview returns a reviewable diff and marks a no-op', () => {
  const ticket = parseTicketContent('.scratch/d/issues/02-x.md', fixture('02-real-claimed.md'));
  const preview = previewTicketEdit(ticket, { kind: 'status', status: 'resolved' });
  assert.equal(preview.changed, true);
  assert.match(preview.diff, /^diff --git a\/\.scratch\/d\/issues\/02-x\.md b\//);
  assert.match(preview.diff, /-Status: claimed/);
  assert.match(preview.diff, /\+Status: resolved/);
  assert.equal(preview.summary, 'Status: claimed → resolved');

  const noop = previewTicketEdit(ticket, { kind: 'status', status: 'claimed' });
  assert.equal(noop.changed, false);
  assert.equal(noop.diff, '');
});

test('an answer and its resolving Status change are one diff and one save', () => {
  const ticket = parseTicketContent('.scratch/d/issues/02-x.md', fixture('02-real-claimed.md'));
  const preview = previewTicketEdits(ticket, [
    { kind: 'answer', body: 'The parser won.', at: '2026-10-21T00:00:00.000Z' },
    { kind: 'status', status: 'resolved' },
  ]);
  assert.equal(preview.changed, true);
  assert.match(preview.after, /## Answer[\s\S]*The parser won\./);
  assert.match(preview.after, /Status: resolved/);
  assert.match(preview.summary, /Append an answer/);
  assert.match(preview.summary, /Status: claimed .* resolved/);
  assert.equal(removedLines(preview.diff).includes('Status: claimed'), true);
});

test('only a ticket file under .scratch can be written', () => {
  assert.equal(isWritableTicketPath('.scratch/d/issues/01-x.md'), true);
  assert.equal(isWritableTicketPath('.scratch/d/map.md'), false);
  assert.equal(isWritableTicketPath('.scratch/d/spec.md'), false);
  assert.equal(isWritableTicketPath('src/domain/ticket.ts'), false);
  assert.equal(isWritableTicketPath('.scratch/../outside.md'), false);
  assert.equal(isWritableTicketPath('/tmp/x.md'), false);
  assert.equal(isWritableTicketPath('G:\\repo\\.scratch\\d\\issues\\01-x.md'), false);
});
