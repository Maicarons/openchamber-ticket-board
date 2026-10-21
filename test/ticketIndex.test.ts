import assert from 'node:assert/strict';
import test from 'node:test';
import {
  discoveredKey,
  orphanLinkKeys,
  parseTicketLink,
  ticketLinkKey,
  type TicketLink,
} from '../src/domain/ticketIndex.ts';

const link = (projectId: string, path: string, sessionId: string | null = null): TicketLink => ({
  schemaVersion: 1,
  projectId,
  path,
  sessionId,
  worktree: null,
  sourceBranch: null,
  needsAttentionSince: null,
  updatedAt: 1,
});

test('a ticket link key is reversible and never ambiguous across projects', () => {
  const key = ticketLinkKey('proj:with:colons', '.scratch/feature/issues/01-x.md');
  assert.match(key, /^ticket-index:/);
  assert.notEqual(key, ticketLinkKey('proj', 'with:colons/.scratch/feature/issues/01-x.md'));
  assert.equal(decodeURIComponent(key.split(':').slice(2).join(':')), '.scratch/feature/issues/01-x.md');
});

test('malformed or foreign records are ignored, never partly trusted', () => {
  assert.equal(parseTicketLink(null), null);
  assert.equal(parseTicketLink({ ...link('p', '.scratch/a/issues/01.md'), schemaVersion: 2 }), null);
  assert.equal(parseTicketLink({ ...link('p', '.scratch/a/issues/01.md'), projectId: '' }), null);
  assert.equal(parseTicketLink({ ...link('p', '.scratch/a/issues/01.md'), path: 42 }), null);
  assert.deepEqual(parseTicketLink({ ...link('p', '.scratch/a/issues/01.md'), worktree: { directory: '/wt', branch: 'b' } })?.worktree, {
    directory: '/wt',
    branch: 'b',
  });
});

test('orphan cleanup requires a complete snapshot', () => {
  const links = [link('p', '.scratch/a/issues/01.md'), link('p', '.scratch/a/issues/02.md')];
  const discovered = new Set([discoveredKey('p', '.scratch/a/issues/01.md')]);
  assert.deepEqual(orphanLinkKeys(links, discovered, false), []);
  assert.deepEqual(orphanLinkKeys(links, discovered, true), [
    ticketLinkKey('p', '.scratch/a/issues/02.md'),
  ]);
});

test('a link in another project is never called an orphan by this project snapshot', () => {
  const links = [link('other', '.scratch/a/issues/01.md')];
  assert.deepEqual(orphanLinkKeys(links, new Set(), true), [ticketLinkKey('other', '.scratch/a/issues/01.md')]);
});
