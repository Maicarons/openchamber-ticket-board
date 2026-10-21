import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTicket } from '../src/domain/ticket.ts';
import { actionsForTicket, type ActionContext } from '../src/domain/ticketActions.ts';
import { ticketColumnLabel } from '../src/domain/ticketColumns.ts';
import { asLanguagePreference, resolveLanguage, translate } from '../src/i18n.ts';
import { DEFAULT_PREFS, parsePrefs } from '../src/store/prefs.ts';

test('auto follows a Chinese host locale; an explicit choice wins', () => {
  assert.equal(asLanguagePreference('zh'), 'zh');
  assert.equal(asLanguagePreference('fr'), 'auto');
  assert.equal(resolveLanguage('auto', 'zh-CN'), 'zh');
  assert.equal(resolveLanguage('auto', 'en-US'), 'en');
  assert.equal(resolveLanguage('auto', ''), 'en');
  assert.equal(resolveLanguage('auto', undefined), 'en');
  assert.equal(resolveLanguage('en', 'zh-CN'), 'en');
  assert.equal(resolveLanguage('zh', 'en-US'), 'zh');
});

test('translations interpolate placeholders in both languages', () => {
  assert.equal(
    translate('en', 'board.queue', { shown: 3, tickets: 'tickets', ready: 2 }),
    '3 tickets shown · 2 ready next',
  );
  assert.equal(
    translate('zh', 'board.queue', { shown: 3, tickets: '张工单', ready: 2 }),
    '显示 3 张工单 · 2 张可开始',
  );
  assert.equal(translate('zh', 'action.reason.blocked', { reasons: '01 未完成' }), '被阻塞：01 未完成');
});

test('column labels localize while ticket status values stay canonical', () => {
  assert.equal(ticketColumnLabel('ready'), 'Ready for agent');
  assert.equal(ticketColumnLabel('ready', 'zh'), '可交给智能体');
  assert.equal(ticketColumnLabel('done', 'zh'), '已完成');
});

test('skill actions and their disabled reasons follow the selected language', () => {
  const ticket = parseTicket(
    '.scratch/checkout/issues/02-blocked.md',
    '# 02: Blocked ticket\n\nStatus: ready-for-agent\nType: task\nBlocked by: 01\n',
  );
  const blocker = parseTicket('.scratch/checkout/issues/01-open.md', '# 01: Open ticket\n\nStatus: needs-info\n');
  const context: ActionContext = {
    feature: 'checkout',
    hasSpec: true,
    hasMap: false,
    specPath: '.scratch/checkout/spec.md',
    mapPath: null,
    siblings: [blocker, ticket],
  };
  const actions = actionsForTicket(ticket, context, 'zh');
  assert.equal(actions.find((action) => action.id === 'implement')?.label, '实现');
  assert.match(actions.find((action) => action.id === 'implement')?.disabledReason ?? '', /^被阻塞：/);
  assert.equal(actions.find((action) => action.id === 'to-tickets')?.label, '拆分为工单');
});

test('preferences default to auto and reject an unknown language', () => {
  assert.equal(DEFAULT_PREFS.language, 'auto');
  assert.equal(parsePrefs({ language: 'zh' }).language, 'zh');
  assert.equal(parsePrefs({ language: 'fr' }).language, 'auto');
  assert.deepEqual(parsePrefs(null), DEFAULT_PREFS);
});
