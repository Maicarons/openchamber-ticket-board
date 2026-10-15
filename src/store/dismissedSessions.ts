import type { HostClient } from '@openchamber/sdk';

type Storage = Pick<HostClient, 'storage'>;

export const DISMISSED_SESSIONS_KEY = 'dismissed-sessions';

/** Session ids whose task was deliberately deleted; keep them out of auto-adoption across reloads. */
export const loadDismissedSessions = async (host: Storage): Promise<Set<string>> => {
  const value = await host.storage.get(DISMISSED_SESSIONS_KEY);
  if (!Array.isArray(value)) return new Set();
  return new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0));
};

export const saveDismissedSessions = (host: Storage, sessionIds: ReadonlySet<string>) =>
  host.storage.set(DISMISSED_SESSIONS_KEY, [...sessionIds]);
