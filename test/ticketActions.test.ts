import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTicket } from '../src/domain/ticket.ts';
import { actionsForTicket, type ActionContext } from '../src/domain/ticketActions.ts';

const ticket = (number: string, status: string, blockedBy = '', feature = 'checkout') =>
  parseTicket(`.scratch/${feature}/issues/${number}-sample.md`, `# ${number}: Sample ticket\n\nStatus: ${status}\nType: task\nBlocked by: ${blockedBy}\n`);

const first = ticket('01', 'resolved');
const second = ticket('02', 'ready-for-agent', '01');
const third = ticket('03', 'ready-for-agent', '', 'other');

const context = (siblings = [first, second]): ActionContext => ({
  feature: 'checkout',
  hasSpec: true,
  hasMap: true,
  specPath: '.scratch/checkout/spec.md',
  mapPath: '.scratch/checkout/map.md',
  siblings,
});

test('the frontier implement prompt names the skill, ticket and feature', () => {
  const actions = actionsForTicket(second, context());
  const implement = actions.find((action) => action.id === 'implement');
  assert.equal(implement?.disabledReason, null);
  assert.match(implement?.prompt ?? '', /^\/implement \.scratch\/checkout\/issues\/02-sample\.md/);
  assert.match(implement?.prompt ?? '', /Ticket: 02 — Sample ticket/);
  assert.match(implement?.prompt ?? '', /Feature: checkout/);
});

test('a blocked ticket disables implement and says which blocker is open', () => {
  const open = parseTicket('.scratch/checkout/issues/01-open.md', '# Open\n\nStatus: needs-info\n');
  const dependent = parseTicket('.scratch/checkout/issues/02-dependent.md', '# Dependent\n\nStatus: ready-for-agent\nBlocked by: 01\n');
  const action = actionsForTicket(dependent, context([open, dependent])).find((candidate) => candidate.id === 'implement');
  assert.ok(action?.disabledReason);
  assert.match(action.disabledReason, /Blocked:/);
  assert.match(action.disabledReason, /Open/);
});

test('a claimed ticket is in Ready but is not offered to another implementer', () => {
  const claimed = ticket('04', 'claimed');
  const action = actionsForTicket(claimed, context([claimed])).find((candidate) => candidate.id === 'implement');
  assert.match(action?.disabledReason ?? '', /claimed/i);
});

test('every action carries a reason when it is unavailable, instead of a silent click', () => {
  const actions = actionsForTicket(first, context());
  assert.ok(actions.every((action) => action.disabledReason !== null || action.prompt.includes(action.skill)));
  const spec = actions.find((action) => action.id === 'implement-spec');
  assert.equal(spec?.disabledReason, null);
  assert.match(spec?.prompt ?? '', /\.scratch\/checkout\/spec\.md/);
});

test('brainstorming actions still work when a feature has no spec yet', () => {
  const actions = actionsForTicket(third, {
    ...context([third]),
    feature: 'other',
    hasSpec: false,
    hasMap: false,
    specPath: null,
    mapPath: null,
  });
  assert.equal(actions.find((action) => action.id === 'to-tickets')?.disabledReason, 'No spec.md in .scratch/other/ yet.');
  assert.equal(actions.find((action) => action.id === 'wayfinder')?.disabledReason, null);
});
