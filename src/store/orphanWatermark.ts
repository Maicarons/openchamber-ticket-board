import type { HostClient } from '@openchamber/sdk';

type Storage = Pick<HostClient, 'storage'>;

const KEY = 'orphan-watermark';

/**
 * The single point in time "going forward" means. A page-type extension
 * can't run continuously — starting a session is itself a navigation that
 * closes this page if it was open — so detecting a new session can only
 * happen the next time the board is reopened, by comparing its real
 * `createdAt` against this persisted cutoff rather than anything held only
 * in memory while the page was mounted.
 */
export const loadOrphanWatermark = async (host: Storage): Promise<number | null> => {
  const value = await host.storage.get(KEY);
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

export const saveOrphanWatermark = (host: Storage, timestamp: number) => host.storage.set(KEY, timestamp);
