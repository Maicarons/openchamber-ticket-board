import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchServiceBranches, type BranchServiceHost } from '../src/host/branchService.ts';

const hostWith = (impl: BranchServiceHost['serviceRequest']): BranchServiceHost => ({ serviceRequest: impl });

test('fetchServiceBranches returns options built from a successful answer', async () => {
  const host = hostWith(async () => ({ status: 200, body: '{"branches":[{"name":"main","kind":"local"}]}' }));
  const options = await fetchServiceBranches(host, '/repo');
  assert.deepEqual(options, [
    { id: '', label: 'Use project default' },
    { id: 'main', label: 'main', hint: undefined },
  ]);
});

test('fetchServiceBranches is null — not thrown — when the service is unavailable, errors, or answers oddly', async () => {
  assert.equal(await fetchServiceBranches(hostWith(async () => { throw new Error('NO_SERVICE'); }), '/repo'), null);
  assert.equal(await fetchServiceBranches(hostWith(async () => ({ status: 422, body: '{"error":"not-a-repo"}' })), '/repo'), null);
  assert.equal(await fetchServiceBranches(hostWith(async () => ({ status: 200, body: 'not json' })), '/repo'), null);
});
