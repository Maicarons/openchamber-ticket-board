/**
 * The board's only persistent state: the link between one ticket and the
 * OpenCode session (and worktree) working on it. Ticket status, dependencies
 * and prose stay in the ticket file; nothing here duplicates them.
 *
 * The index is keyed by project and repository-relative ticket path. A path
 * alone is not unique across projects, and a project id alone is not unique
 * within one.
 */
export type TicketWorktree = { directory: string; branch: string | null };

export type TicketLink = {
  schemaVersion: 1;
  projectId: string;
  path: string;
  sessionId: string | null;
  worktree: TicketWorktree | null;
  sourceBranch: string | null;
  needsAttentionSince: number | null;
  updatedAt: number;
};

export const TICKET_LINK_SCHEMA_VERSION = 1 as const;
export const TICKET_INDEX_PREFIX = 'ticket-index:';

const MAX_ID = 512;
const MAX_PATH = 2048;

export const ticketLinkKey = (projectId: string, path: string): string =>
  `${TICKET_INDEX_PREFIX}${encodeURIComponent(projectId)}:${encodeURIComponent(path)}`;

const text = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.length > 0 && value.length <= max ? value : null;

const numberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const worktreeOf = (value: unknown): TicketWorktree | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const directory = text(record.directory, MAX_PATH);
  if (!directory) return null;
  const branch = record.branch === null ? null : text(record.branch, MAX_ID);
  return { directory, branch };
};

/** A stored record made by an older or newer version is ignored, never partly trusted. */
export const parseTicketLink = (value: unknown): TicketLink | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== TICKET_LINK_SCHEMA_VERSION) return null;
  const projectId = text(record.projectId, MAX_ID);
  const path = text(record.path, MAX_PATH);
  if (!projectId || !path) return null;
  const sessionId = record.sessionId === null ? null : text(record.sessionId, MAX_ID);
  return {
    schemaVersion: TICKET_LINK_SCHEMA_VERSION,
    projectId,
    path,
    sessionId,
    worktree: worktreeOf(record.worktree),
    sourceBranch: record.sourceBranch === null ? null : text(record.sourceBranch, MAX_ID),
    needsAttentionSince: numberOrNull(record.needsAttentionSince),
    updatedAt: numberOrNull(record.updatedAt) ?? 0,
  };
};

export const sameTicket = (a: Pick<TicketLink, 'projectId' | 'path'>, b: Pick<TicketLink, 'projectId' | 'path'>): boolean =>
  a.projectId === b.projectId && a.path === b.path;

/**
 * Index keys that no longer name a discovered ticket.
 *
 * `complete` is the guard that matters: an incomplete scan (service down, one
 * directory unreadable, the file budget hit) must never delete a link just
 * because this snapshot cannot see its ticket. Returns storage keys, not
 * links, so the caller can delete exactly those records.
 */
export const orphanLinkKeys = (
  links: readonly TicketLink[],
  discovered: ReadonlySet<string>,
  complete: boolean,
): string[] => {
  if (!complete) return [];
  return links
    .filter((link) => !discovered.has(`${link.projectId}\u0000${link.path}`))
    .map((link) => ticketLinkKey(link.projectId, link.path));
};

export const discoveredKey = (projectId: string, path: string): string => `${projectId}\u0000${path}`;
