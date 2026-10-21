import { parseTicket, type Ticket } from './ticket.ts';
import {
  TICKET_COLUMNS,
  frontierTickets,
  groupTicketColumns,
  ticketColumn,
  type TicketColumn,
  type TicketColumns,
} from './ticketColumns.ts';
import { DEFAULT_TRIAGE_LABELS, triageRoleForStatus, statusForTriageRole, type TriageLabels } from './triageLabels.ts';
import type { TicketLink } from './ticketIndex.ts';

/** One ticket together with the project it was read from and its session link. */
export type BoardTicket = {
  ticket: Ticket;
  projectId: string;
  projectDirectory: string;
  link: TicketLink | null;
};

export type TicketFile = { path: string; content: string; mtimeMs?: number };

export const ALL_FEATURES = '*';

export type BoardFilter = {
  projectId: string;
  feature: string;
  query: string;
};

export const DEFAULT_BOARD_FILTER: BoardFilter = { projectId: '', feature: ALL_FEATURES, query: '' };

/** Parse the files the service returned. A malformed file is still a card with warnings. */
export const boardTicketsFromFiles = (
  files: readonly TicketFile[],
  projectId: string,
  projectDirectory: string,
  links: ReadonlyMap<string, TicketLink> = new Map(),
  labels: TriageLabels = DEFAULT_TRIAGE_LABELS,
): BoardTicket[] =>
  files
    .map((file) => {
      const ticket = parseTicket(file.path, file.content, labels);
      return { ticket, projectId, projectDirectory, link: links.get(ticket.path) ?? null };
    })
    .filter((entry) => entry.ticket.kind === 'ticket');

/** Specs and maps are context, not cards. */
export const contextFiles = (
  files: readonly TicketFile[],
  labels: TriageLabels = DEFAULT_TRIAGE_LABELS,
): Ticket[] =>
  files
    .map((file) => parseTicket(file.path, file.content, labels))
    .filter((ticket) => ticket.kind !== 'ticket');

export const featureOf = (entry: Pick<BoardTicket, 'ticket'>): string => entry.ticket.feature;

export const featureNames = (
  tickets: readonly BoardTicket[],
  context: readonly Ticket[] = [],
): string[] => {
  const names = new Set<string>();
  for (const entry of tickets) if (entry.ticket.feature) names.add(entry.ticket.feature);
  for (const ticket of context) if (ticket.feature) names.add(ticket.feature);
  return [...names].sort((a, b) => a.localeCompare(b));
};

export const hasSpec = (context: readonly Ticket[], feature: string): boolean =>
  context.some((ticket) => ticket.kind === 'spec' && ticket.feature === feature);

export const hasMap = (context: readonly Ticket[], feature: string): boolean =>
  context.some((ticket) => ticket.kind === 'map' && ticket.feature === feature);

export const specFor = (context: readonly Ticket[], feature: string): Ticket | null =>
  context.find((ticket) => ticket.kind === 'spec' && ticket.feature === feature) ?? null;

export const mapFor = (context: readonly Ticket[], feature: string): Ticket | null =>
  context.find((ticket) => ticket.kind === 'map' && ticket.feature === feature) ?? null;

/** The siblings whose Blocked by numbers can resolve this ticket. */
export const siblingsOf = (entry: BoardTicket, all: readonly BoardTicket[]): Ticket[] =>
  all
    .filter((candidate) => candidate.projectId === entry.projectId && candidate.ticket.feature === entry.ticket.feature)
    .map((candidate) => candidate.ticket);

export const columnOf = (
  entry: BoardTicket,
  all: readonly BoardTicket[],
  labels: TriageLabels = DEFAULT_TRIAGE_LABELS,
): TicketColumn => ticketColumn(entry.ticket, siblingsOf(entry, all), labels);

export const groupBoardColumns = (
  tickets: readonly BoardTicket[],
  labels: TriageLabels = DEFAULT_TRIAGE_LABELS,
): Record<TicketColumn, BoardTicket[]> => {
  const byFeature = new Map<string, BoardTicket[]>();
  for (const entry of tickets) {
    const key = `${entry.projectId}\u0000${entry.ticket.feature}`;
    const list = byFeature.get(key) ?? [];
    list.push(entry);
    byFeature.set(key, list);
  }
  const columns = Object.fromEntries(TICKET_COLUMNS.map((column) => [column, [] as BoardTicket[]])) as Record<TicketColumn, BoardTicket[]>;
  const frontier = frontierPaths(tickets, labels);
  for (const group of byFeature.values()) {
    const groups = groupTicketColumns(group.map((entry) => entry.ticket), labels);
    const byPath = new Map(group.map((entry) => [entry.ticket.path, entry]));
    for (const column of TICKET_COLUMNS) {
      for (const ticket of groups[column]) {
        const entry = byPath.get(ticket.path);
        if (entry) columns[column].push(entry);
      }
    }
  }
  const compare = (a: BoardTicket, b: BoardTicket): number => {
    const an = a.ticket.numberValue;
    const bn = b.ticket.numberValue;
    if (an !== null && bn !== null && an !== bn) return an - bn;
    if (an !== null && bn === null) return -1;
    if (an === null && bn !== null) return 1;
    return a.ticket.path.localeCompare(b.ticket.path);
  };
  for (const column of TICKET_COLUMNS) {
    columns[column].sort((a, b) => {
      if (column === 'ready') {
        const af = frontier.has(a.ticket.path) ? 0 : 1;
        const bf = frontier.has(b.ticket.path) ? 0 : 1;
        if (af !== bf) return af - bf;
      }
      return compare(a, b);
    });
  }
  return columns;
};

/** The frontier is per feature/effort, never one global lowest number across unrelated efforts. */
export const frontierPaths = (
  tickets: readonly BoardTicket[],
  labels: TriageLabels = DEFAULT_TRIAGE_LABELS,
): Set<string> => {
  const paths = new Set<string>();
  const byFeature = new Map<string, Ticket[]>();
  for (const entry of tickets) {
    const key = `${entry.projectId}\u0000${entry.ticket.feature}`;
    const list = byFeature.get(key) ?? [];
    list.push(entry.ticket);
    byFeature.set(key, list);
  }
  for (const list of byFeature.values()) {
    const next = frontierTickets(list, labels)[0];
    if (next) paths.add(next.path);
  }
  return paths;
};

export const matchesQuery = (entry: BoardTicket, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const { ticket } = entry;
  return [
    ticket.title,
    ticket.path,
    ticket.slug,
    ticket.number ?? '',
    ticket.status ?? '',
    ticket.type ?? '',
    ticket.comments,
    ticket.answer,
  ].some((value) => value.toLowerCase().includes(needle));
};

export const filterBoardTickets = (
  tickets: readonly BoardTicket[],
  filter: BoardFilter,
): BoardTicket[] =>
  tickets.filter((entry) =>
    (!filter.projectId || entry.projectId === filter.projectId) &&
    (filter.feature === ALL_FEATURES || entry.ticket.feature === filter.feature) &&
    matchesQuery(entry, filter.query));

/**
 * Drag is a status change, never an ordering change: a ticket's place comes
 * from its number and the frontier rule. Columns that are derived from other
 * data cannot be a write target.
 */
export type DropTarget = { column: TicketColumn; status: string | null; reason: string | null };

export const dropTargetFor = (
  column: TicketColumn,
  labels: TriageLabels = DEFAULT_TRIAGE_LABELS,
): DropTarget => {
  switch (column) {
    case 'triage':
      return { column, status: statusForTriageRole('needs-triage', labels), reason: null };
    case 'needs-info':
      return { column, status: statusForTriageRole('needs-info', labels), reason: null };
    case 'ready':
      return { column, status: statusForTriageRole('ready-for-agent', labels), reason: null };
    case 'human':
      return { column, status: statusForTriageRole('ready-for-human', labels), reason: null };
    case 'done':
      return { column, status: 'resolved', reason: null };
    case 'blocked':
      return { column, status: null, reason: 'Blocked is derived from Blocked by; change the Blocked by line instead.' };
  }
};

export const statusLabel = (status: string | null, labels: TriageLabels = DEFAULT_TRIAGE_LABELS): string => {
  if (!status) return 'No status';
  const role = triageRoleForStatus(status, labels);
  if (role === 'ready-for-agent') return 'ready-for-agent';
  return status;
};

export const ticketIsDone = (entry: BoardTicket): boolean => columnOf(entry, [entry]) === 'done';

export type { TicketColumns };
