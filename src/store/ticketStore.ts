import type { HostClient, JsonValue } from '@openchamber/sdk';
import {
  parseTicketLink,
  TICKET_INDEX_PREFIX,
  ticketLinkKey,
  type TicketLink,
} from '../domain/ticketIndex.ts';

type Storage = Pick<HostClient, 'storage'>;

const READ_BATCH = 16;

export type TicketIndexLoad = { links: TicketLink[]; failedKeys: string[] };

/** Reads every ticket link. One record per ticket, so two projects never share a record. */
export const loadTicketLinks = async (host: Storage): Promise<TicketIndexLoad> => {
  const keys = (await host.storage.keys()).filter((key) => key.startsWith(TICKET_INDEX_PREFIX));
  const links: TicketLink[] = [];
  const failedKeys: string[] = [];
  for (let offset = 0; offset < keys.length; offset += READ_BATCH) {
    await Promise.all(keys.slice(offset, offset + READ_BATCH).map(async (key) => {
      try {
        const link = parseTicketLink(await host.storage.get(key));
        if (!link) throw new Error('invalid ticket link');
        if (ticketLinkKey(link.projectId, link.path) !== key) throw new Error('ticket link key mismatch');
        links.push(link);
      } catch {
        failedKeys.push(key);
      }
    }));
  }
  return { links, failedKeys };
};

export const saveTicketLink = async (host: Storage, link: TicketLink): Promise<void> => {
  const checked = parseTicketLink(link);
  if (!checked) throw new Error('Refusing to save an invalid ticket link');
  await host.storage.set(ticketLinkKey(checked.projectId, checked.path), checked as unknown as JsonValue);
};

export const deleteTicketLink = (host: Storage, projectId: string, path: string) =>
  host.storage.delete(ticketLinkKey(projectId, path));
