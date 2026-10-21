import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_TRIAGE_LABELS, parseTriageLabels, statusForTriageRole, triageRoleForStatus } from '../src/domain/triageLabels.ts';

test('the documented triage table maps every role to the tracker vocabulary', () => {
  const parsed = parseTriageLabels(`
# Triage Labels

| Label in mattpocock/skills | Label in our tracker | Meaning |
| -------------------------- | -------------------- | ------- |
| \`needs-triage\`             | \`triage-me\`          | evaluate |
| \`needs-info\`               | \`waiting\`            | ask |
| \`ready-for-agent\`          | \`agent-ready\`        | AFK |
| \`ready-for-human\`          | \`human-only\`         | person |
| \`wontfix\`                  | \`never\`              | no |
`);
  assert.deepEqual(parsed, {
    'needs-triage': 'triage-me',
    'needs-info': 'waiting',
    'ready-for-agent': 'agent-ready',
    'ready-for-human': 'human-only',
    wontfix: 'never',
  });
});

test('a hand-written role: label list works too', () => {
  assert.deepEqual(parseTriageLabels('- needs-triage: inbox\n- wontfix: won\'t fix'), {
    ...DEFAULT_TRIAGE_LABELS,
    'needs-triage': 'inbox',
    wontfix: "won't fix",
  });
});

test('missing or unreadable labels fall back to the canonical roles', () => {
  assert.equal(parseTriageLabels(null), null);
  assert.equal(parseTriageLabels(''), null);
  assert.equal(parseTriageLabels('no table here'), null);
  assert.deepEqual(DEFAULT_TRIAGE_LABELS, {
    'needs-triage': 'needs-triage',
    'needs-info': 'needs-info',
    'ready-for-agent': 'ready-for-agent',
    'ready-for-human': 'ready-for-human',
    wontfix: 'wontfix',
  });
});

test('status values read and write through the tracker vocabulary', () => {
  const labels = { ...DEFAULT_TRIAGE_LABELS, 'ready-for-agent': 'agent-ready' };
  assert.equal(triageRoleForStatus('agent-ready', labels), 'ready-for-agent');
  assert.equal(triageRoleForStatus('ready-for-agent', labels), 'ready-for-agent');
  assert.equal(triageRoleForStatus('claimed', labels), null);
  assert.equal(statusForTriageRole('ready-for-agent', labels), 'agent-ready');
});
