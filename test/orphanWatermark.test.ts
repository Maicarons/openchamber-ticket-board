import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { HostClient, JsonValue } from '@openchamber/sdk';
import { loadOrphanWatermark, saveOrphanWatermark } from '../src/store/orphanWatermark.ts';

const fakeHost = () => {
  const data = new Map<string, JsonValue>();
  const host: Pick<HostClient, 'storage'> = {
    storage: {
      get: async (key) => data.get(key),
      set: async (key, value) => { data.set(key, value); },
      delete: async (key) => { data.delete(key); },
      keys: async () => [...data.keys()],
    },
  };
  return { host, data };
};

test('no watermark yet is null, not zero', async () => {
  const { host } = fakeHost();
  assert.equal(await loadOrphanWatermark(host), null);
});

test('a saved watermark round-trips', async () => {
  const { host } = fakeHost();
  await saveOrphanWatermark(host, 1234567);
  assert.equal(await loadOrphanWatermark(host), 1234567);
});

test('a non-numeric stored value is treated as missing, not thrown', async () => {
  const { host, data } = fakeHost();
  data.set('orphan-watermark', 'not-a-number' as unknown as JsonValue);
  assert.equal(await loadOrphanWatermark(host), null);
});
