import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTicketContent, type Ticket } from '../src/domain/ticket.ts';
import {
  frontierTicket,
  frontierTickets,
  groupTicketColumns,
  isFrontierCandidate,
  resolveBlockers,
  ticketColumn,
} from '../src/domain/ticketColumns.ts';

const fixture = (name: string): string => readFileSync(new URL(`./fixtures/matt/${name}`, import.meta.url), 'utf8');

let nextNumber = 1;
const make = (
  status: string | null,
  extra: { blockedBy?: number[]; feature?: string; number?: number; title?: string } = {},
): Ticket => {
  const number = extra.number ?? nextNumber++;
  const feature = extra.feature ?? 'demo';
  const path = `.scratch/${feature}/issues/${String(number).padStart(2, '0')}-ticket.md`;
  const blocked = extra.blockedBy?.map((value) => String(value).padStart(2, '0')).join(', ') ?? '';
  return parseTicketContent(
    path,
    `# ${extra.title ?? `Ticket ${number}`}\n\nStatus: ${status ?? ''}\nType: task\nBlocked by: ${blocked}\n`,
  );
};

test('columns follow status, then blocking, with wontfix folded into Done', () => {
  const a = make('ready-for-agent', { number: 1 });
  const b = make('ready-for-agent', { number: 2, blockedBy: [1] });
  const c = make('needs-triage', { number: 3 });
  const d = make('needs-info', { number: 4 });
  const e = make('ready-for-human', { number: 5 });
  const f = make('resolved', { number: 6 });
  const g = make('wontfix', { number: 7 });
  const h = make(null, { number: 8 });
  const claimed = make('claimed', { number: 9 });
  const blockedClaim = make('claimed', { number: 10, blockedBy: [1] });
  const all = [a, b, c, d, e, f, g, h, claimed, blockedClaim];
  const columns = groupTicketColumns(all);
  assert.deepEqual(columns.triage.map((t) => t.numberValue), [3, 8]);
  assert.deepEqual(columns['needs-info'].map((t) => t.numberValue), [4]);
  assert.deepEqual(columns.human.map((t) => t.numberValue), [5]);
  assert.deepEqual(columns.done.map((t) => t.numberValue), [6, 7]);
  assert.deepEqual(columns.blocked.map((t) => t.numberValue), [2, 10]);
  assert.deepEqual(columns.ready.map((t) => t.numberValue), [1, 9]);
});

test('the frontier is the lowest unblocked, unclaimed, actionable ticket', () => {
  const done = make('resolved', { number: 1 });
  const first = make('ready-for-agent', { number: 2 });
  const claimed = make('claimed', { number: 3 });
  const blocked = make('ready-for-agent', { number: 4, blockedBy: [2] });
  const untriaged = make('needs-triage', { number: 5 });
  const all = [untriaged, blocked, claimed, first, done];
  assert.equal(frontierTicket(all)?.numberValue, 2);
  assert.deepEqual(frontierTickets(all).map((t) => t.numberValue), [2]);
  assert.equal(isFrontierCandidate(claimed, all), false);
  assert.equal(isFrontierCandidate(untriaged, all), false);
  assert.equal(isFrontierCandidate(blocked, all), false);
});

test('resolving a blocker moves the dependent ticket from Blocked to Ready', () => {
  const a = make('ready-for-agent', { number: 1 });
  const b = make('ready-for-agent', { number: 2, blockedBy: [1] });
  assert.equal(ticketColumn(b, [a, b]), 'blocked');
  assert.deepEqual(resolveBlockers(b, [a, b]).open.map((blocker) => blocker.ref.number), ['01']);
  const resolvedA = make('resolved', { number: 1 });
  assert.equal(ticketColumn(b, [resolvedA, b]), 'ready');
  assert.equal(frontierTicket([resolvedA, b])?.numberValue, 2);
});

test('a missing blocker never becomes a frontier', () => {
  const b = make('ready-for-agent', { number: 2, blockedBy: [99] });
  assert.equal(ticketColumn(b, [b]), 'blocked');
  assert.deepEqual(resolveBlockers(b, [b]).missing.map((blocker) => blocker.ref.number), ['99']);
  assert.equal(frontierTicket([b]), null);
});

test('blocker numbers resolve within their own feature only', () => {
  const other = make('ready-for-agent', { number: 2, feature: 'other' });
  const mine = make('resolved', { number: 2, feature: 'mine' });
  const dependent = make('ready-for-agent', { number: 3, feature: 'mine', blockedBy: [2] });
  assert.equal(ticketColumn(dependent, [other, mine, dependent]), 'ready');
  const withOtherOnly = make('ready-for-agent', { number: 3, feature: 'mine', blockedBy: [2] });
  assert.equal(ticketColumn(withOtherOnly, [other, withOtherOnly]), 'blocked');
});

test('the frontier card leads the Ready column', () => {
  const one = make('ready-for-agent', { number: 1 });
  const two = make('ready-for-agent', { number: 2 });
  const columns = groupTicketColumns([two, one]);
  assert.deepEqual(columns.ready.map((t) => t.numberValue), [1, 2]);
  assert.equal(frontierTicket([two, one])?.numberValue, 1);
});

test('real fixtures land where their Status says', () => {
  const claimed = parseTicketContent('.scratch/demo/issues/02.md', fixture('02-real-claimed.md'));
  const ready = parseTicketContent('.scratch/demo/issues/03.md', fixture('03-real-empty.md'));
  const resolved = parseTicketContent('.scratch/04-real-feature/issues/01-issue-tracker-markdown.md', fixture('04-real-feature/issues/01-issue-tracker-markdown.md'));
  const columns = groupTicketColumns([claimed, ready, resolved]);
  assert.deepEqual(columns.ready.map((t) => t.number), ['03']);
  assert.deepEqual(columns.done.map((t) => t.title), ['初始化 issue tracker：本地 Markdown 后端与目录约定']);
  assert.equal(frontierTicket([claimed, ready, resolved])?.numberValue, 3);
  assert.equal(frontierTicket([claimed]), null, 'a claimed ticket is not the next action');
});
