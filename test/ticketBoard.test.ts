import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALL_FEATURES,
  boardTicketsFromFiles,
  contextFiles,
  featureNames,
  filterBoardTickets,
  frontierPaths,
  groupBoardColumns,
} from '../src/domain/ticketBoard.ts';
import { DEFAULT_TRIAGE_LABELS } from '../src/domain/triageLabels.ts';

const files = [
  { path: '.scratch/checkout/spec.md', content: '# Checkout spec\n' },
  { path: '.scratch/checkout/map.md', content: '# Checkout map\n' },
  { path: '.scratch/checkout/issues/01-model.md', content: '# 01: Model\n\nStatus: resolved\nType: task\n' },
  { path: '.scratch/checkout/issues/02-ui.md', content: '# 02: UI\n\nStatus: agent-ready\nType: task\nBlocked by: 01\n' },
  { path: '.scratch/checkout/issues/03-api.md', content: '# 03: API\n\nStatus: needs-triage\nType: task\n' },
  { path: '.scratch/other/issues/01-idea.md', content: '# 01: Idea\n\nStatus: ready-for-agent\nType: research\n' },
];

const labels = { ...DEFAULT_TRIAGE_LABELS, 'ready-for-agent': 'agent-ready' };
const entries = boardTicketsFromFiles(files, 'p1', '/repo', new Map(), labels);

test('the board turns only issue files into cards and reads the tracker vocabulary', () => {
  assert.equal(entries.length, 4);
  assert.deepEqual(entries.map((entry) => entry.ticket.number), ['01', '02', '03', '01']);
  assert.equal(entries[1]?.ticket.status, 'agent-ready');
  assert.equal(entries[1]?.ticket.warnings.length, 0);
});

test('frontier is computed per feature, never across unrelated efforts', () => {
  const frontier = frontierPaths(entries, labels);
  assert.deepEqual([...frontier].sort(), ['.scratch/checkout/issues/02-ui.md', '.scratch/other/issues/01-idea.md']);
});

test('the Next ticket leads Ready and the other feature keeps its own Next', () => {
  const columns = groupBoardColumns(entries, labels);
  assert.deepEqual(columns.ready.map((entry) => entry.ticket.path).sort(), [
    '.scratch/checkout/issues/02-ui.md',
    '.scratch/other/issues/01-idea.md',
  ]);
  assert.equal(columns.triage[0]?.ticket.path, '.scratch/checkout/issues/03-api.md');
  assert.equal(columns.done[0]?.ticket.path, '.scratch/checkout/issues/01-model.md');
});

test('features come from tickets and context, and specs/maps stay context', () => {
  assert.deepEqual(featureNames(entries, contextFiles(files, labels)), ['checkout', 'other']);
  assert.deepEqual(contextFiles(files, labels).map((ticket) => ticket.kind), ['spec', 'map']);
});

test('search looks at title, number, status, body and comments, without changing the frontier', () => {
  const found = filterBoardTickets(entries, { projectId: 'p1', feature: ALL_FEATURES, query: 'api' });
  assert.deepEqual(found.map((entry) => entry.ticket.path), ['.scratch/checkout/issues/03-api.md']);
  const scoped = filterBoardTickets(entries, { projectId: 'p1', feature: 'checkout', query: '' });
  assert.equal(scoped.length, 3);
  assert.deepEqual([...frontierPaths(scoped, labels)], ['.scratch/checkout/issues/02-ui.md']);
});
