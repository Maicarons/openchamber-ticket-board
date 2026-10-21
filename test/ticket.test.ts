import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  isClaimedStatus,
  isResolvedStatus,
  parseBlockedBy,
  parseTicketContent,
  parseTicketPath,
  ticketRef,
} from '../src/domain/ticket.ts';

const fixture = (name: string): string => readFileSync(new URL(`./fixtures/matt/${name}`, import.meta.url), 'utf8');

test('parseTicketPath understands the canonical feature layout and the flat legacy one', () => {
  assert.deepEqual(parseTicketPath('.scratch/kanban/issues/03-next-card.md'), {
    path: '.scratch/kanban/issues/03-next-card.md',
    kind: 'ticket',
    feature: 'kanban',
    number: '03',
    numberValue: 3,
    slug: 'next-card',
  });
  assert.equal(parseTicketPath('.scratch/kanban/map.md').kind, 'map');
  assert.equal(parseTicketPath('.scratch/kanban/map.md').feature, 'kanban');
  assert.equal(parseTicketPath('.scratch/kanban/spec.md').kind, 'spec');
  assert.deepEqual(parseTicketPath('.scratch/issues/01-flat.md'), {
    path: '.scratch/issues/01-flat.md',
    kind: 'ticket',
    feature: '',
    number: '01',
    numberValue: 1,
    slug: 'flat',
  });
  assert.equal(parseTicketPath('.scratch\\kanban\\issues\\01-a.md').path, '.scratch/kanban/issues/01-a.md');
});

test('a real claimed ticket from the deck fixtures parses every field', () => {
  const raw = fixture('02-real-claimed.md');
  const ticket = parseTicketContent('.scratch/demo/issues/02-real-claimed.md', raw);
  assert.equal(ticket.title, 'Hello World');
  assert.equal(ticket.status, 'claimed');
  assert.equal(ticket.type, 'task');
  assert.deepEqual(ticket.blockedBy, [{ number: '02', value: 2 }]);
  assert.match(ticket.comments, /First comment\./);
  assert.equal(ticket.answer, 'Answer body.');
  assert.equal(ticket.category, null);
  assert.equal(ticket.content, raw);
  assert.deepEqual(ticket.conflicts, []);
});

test('a real empty ticket has no blockers and no sections', () => {
  const ticket = parseTicketContent('.scratch/demo/issues/03-real-empty.md', fixture('03-real-empty.md'));
  assert.equal(ticket.status, 'ready-for-agent');
  assert.equal(ticket.type, 'task');
  assert.deepEqual(ticket.blockedBy, []);
  assert.equal(ticket.comments, '');
  assert.equal(ticket.answer, '');
  assert.equal(ticket.warnings.length, 0);
});

test('real feature tickets keep non-ASCII titles and skip an empty second Answer', () => {
  const ticket = parseTicketContent(
    '.scratch/04-real-feature/issues/01-issue-tracker-markdown.md',
    fixture('04-real-feature/issues/01-issue-tracker-markdown.md'),
  );
  assert.equal(ticket.feature, '04-real-feature');
  assert.equal(ticket.number, '01');
  assert.equal(ticket.title, '初始化 issue tracker：本地 Markdown 后端与目录约定');
  assert.equal(ticket.status, 'resolved');
  assert.equal(ticket.type, 'task');
  assert.deepEqual(ticket.blockedBy, []);
  assert.match(ticket.answer, /后端 = \*\*本地 Markdown\*\*/);
  assert.equal((ticket.answer.match(/## Answer/g) ?? []).length, 0);
  assert.equal(ticket.labels.includes('wayfinder:task'), true);
});

test('parseBlockedBy accepts NN, #NN, None and ignores prose', () => {
  assert.deepEqual(parseBlockedBy('01, 02'), [
    { number: '01', value: 1 },
    { number: '02', value: 2 },
  ]);
  assert.deepEqual(parseBlockedBy('#7, #12'), [
    { number: '7', value: 7 },
    { number: '12', value: 12 },
  ]);
  assert.deepEqual(parseBlockedBy('None (can start immediately)'), []);
  assert.deepEqual(parseBlockedBy('-'), []);
  assert.deepEqual(parseBlockedBy('—'), []);
  assert.deepEqual(parseBlockedBy(''), []);
  assert.deepEqual(parseBlockedBy('03 and 04'), [
    { number: '03', value: 3 },
    { number: '04', value: 4 },
  ]);
  assert.deepEqual(parseBlockedBy('01, 01'), [{ number: '01', value: 1 }]);
});

test('status helpers use the tracker vocabulary, including wontfix as finished', () => {
  assert.equal(isResolvedStatus('resolved'), true);
  assert.equal(isResolvedStatus('wontfix'), true);
  assert.equal(isResolvedStatus('closed'), true);
  assert.equal(isResolvedStatus('ready-for-agent'), false);
  assert.equal(isClaimedStatus('claimed'), true);
  assert.equal(isClaimedStatus('ready-for-agent'), false);
  assert.equal(ticketRef({ number: '02', numberValue: 2 }), '02');
  assert.equal(ticketRef({ number: '2', numberValue: 2 }, 'issue'), '#2');
});

test('unfamiliar or contradictory fields become warnings/conflicts, never a throw', () => {
  const ticket = parseTicketContent(
    '.scratch/d/issues/01-x.md',
    '# Look at this\n\nStatus: doing\nStatus: ready-for-human\nType: chat\nBlocked by: 99\n',
  );
  assert.equal(ticket.status, 'doing');
  assert.equal(ticket.type, 'chat');
  assert.deepEqual(ticket.blockedBy, [{ number: '99', value: 99 }]);
  assert.match(ticket.conflicts.join('\n'), /Conflicting Status/);
  assert.match(ticket.warnings.join('\n'), /Unknown Type/);
  assert.match(ticket.warnings.join('\n'), /Unrecognised Status/);
});

test('a title is a name, never just the file id', () => {
  const ticket = parseTicketContent('.scratch/d/issues/07-fix-login.md', '# 07: Fix the login redirect\n\nStatus: ready-for-agent\n');
  assert.equal(ticket.title, 'Fix the login redirect');
  const noHeading = parseTicketContent('.scratch/d/issues/08-clean-up-cache.md', 'Status: ready-for-agent\n');
  assert.equal(noHeading.title, 'Clean up cache');
  assert.match(noHeading.warnings.join('\n'), /No H1/);
});
