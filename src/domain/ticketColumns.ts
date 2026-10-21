import {
  isClaimedStatus,
  isResolvedStatus,
  type BlockedByRef,
  type Ticket,
} from './ticket.ts';

/**
 * The board's six columns, in the order a person reads a queue. These are
 * derived from the ticket file, never stored: Status, Blocked by and the
 * blockers' own Status are the only inputs.
 */
export const TICKET_COLUMNS = ['triage', 'needs-info', 'ready', 'blocked', 'human', 'done'] as const;
export type TicketColumn = (typeof TICKET_COLUMNS)[number];

export const TICKET_COLUMN_LABELS: Record<TicketColumn, string> = {
  triage: 'Needs triage',
  'needs-info': 'Needs info',
  ready: 'Ready for agent',
  blocked: 'Blocked',
  human: 'Needs human',
  done: 'Done',
};

export type BlockerResolution = {
  ref: BlockedByRef;
  ticket: Ticket | null;
  /** A missing blocker is not resolved: an incomplete snapshot must not invent a frontier. */
  resolved: boolean;
};

export type BlockedState = {
  blocked: boolean;
  blockers: BlockerResolution[];
  /** Blockers whose ticket is present but not resolved/closed/wontfix. */
  open: BlockerResolution[];
  /** Blockers that name no ticket in the loaded snapshot. */
  missing: BlockerResolution[];
  resolved: BlockerResolution[];
};

const byNumberThenPath = (a: Ticket, b: Ticket): number => {
  const an = a.numberValue;
  const bn = b.numberValue;
  if (an !== null && bn !== null && an !== bn) return an - bn;
  if (an !== null && bn === null) return -1;
  if (an === null && bn !== null) return 1;
  return a.path.localeCompare(b.path);
};

/**
 * Resolve a ticket's Blocked by refs against the tickets currently loaded.
 * When the ticket belongs to a feature, only that feature's tickets count, so
 * two features' `02` files can never be confused.
 */
export const resolveBlockers = (ticket: Ticket, siblings: readonly Ticket[]): BlockedState => {
  const candidates = siblings.filter((candidate) => candidate.feature === ticket.feature);
  const byNumber = new Map<number, Ticket>();
  for (const candidate of candidates) {
    if (candidate.numberValue === null) continue;
    if (!byNumber.has(candidate.numberValue)) byNumber.set(candidate.numberValue, candidate);
  }
  const blockers = ticket.blockedBy.map((ref): BlockerResolution => {
    const blocker = byNumber.get(ref.value) ?? null;
    return { ref, ticket: blocker, resolved: blocker !== null && isResolvedStatus(blocker.status) };
  });
  const open = blockers.filter((blocker) => blocker.ticket !== null && !blocker.resolved);
  const missing = blockers.filter((blocker) => blocker.ticket === null);
  return {
    blocked: open.length > 0 || missing.length > 0,
    blockers,
    open,
    missing,
    resolved: blockers.filter((blocker) => blocker.resolved),
  };
};

const statusColumn = (status: string | null): TicketColumn => {
  if (status === 'needs-info') return 'needs-info';
  if (status === 'ready-for-human') return 'human';
  if (status === 'ready-for-agent' || isClaimedStatus(status)) return 'ready';
  // An untriaged ticket, an empty Status line and an unfamiliar status all
  // belong where a person can evaluate them, not in a made-up column.
  return 'triage';
};

/**
 * A ticket lands in exactly one column:
 * 1. finished statuses (including wontfix) are Done;
 * 2. any unfinished ticket whose Blocked by is not all resolved is Blocked;
 * 3. otherwise its Status picks the lane.
 */
export const ticketColumn = (ticket: Ticket, siblings: readonly Ticket[] = [ticket]): TicketColumn => {
  if (isResolvedStatus(ticket.status)) return 'done';
  if (resolveBlockers(ticket, siblings).blocked) return 'blocked';
  return statusColumn(ticket.status);
};

export const isFrontierCandidate = (ticket: Ticket, siblings: readonly Ticket[] = [ticket]): boolean => {
  if (isResolvedStatus(ticket.status)) return false;
  if (isClaimedStatus(ticket.status)) return false;
  if (ticketColumn(ticket, siblings) !== 'ready') return false;
  return !resolveBlockers(ticket, siblings).blocked;
};

/** Frontier order is the tracker's own: lowest ticket number first. */
export const frontierTickets = (tickets: readonly Ticket[]): Ticket[] =>
  tickets.filter((ticket) => isFrontierCandidate(ticket, tickets)).sort(byNumberThenPath);

/** The one card marked "Next". */
export const frontierTicket = (tickets: readonly Ticket[]): Ticket | null => frontierTickets(tickets)[0] ?? null;

export type TicketColumns = Record<TicketColumn, Ticket[]>;

/**
 * Group tickets into the six columns. `ready` leads with the frontier card so
 * the next action is always the first thing in its lane; every other column
 * stays in ticket-number order.
 */
export const groupTicketColumns = (tickets: readonly Ticket[]): TicketColumns => {
  const columns = Object.fromEntries(TICKET_COLUMNS.map((column) => [column, [] as Ticket[]])) as TicketColumns;
  const frontier = frontierTicket(tickets);
  for (const ticket of tickets) columns[ticketColumn(ticket, tickets)].push(ticket);
  for (const column of TICKET_COLUMNS) {
    const list = columns[column];
    list.sort(byNumberThenPath);
    if (column !== 'ready' || !frontier) continue;
    const index = list.findIndex((ticket) => ticket.path === frontier.path);
    if (index > 0) {
      const [next] = list.splice(index, 1);
      if (next) list.unshift(next);
    }
  }
  return columns;
};

/** Human-readable blocker reasons for a card's title/tooltip. */
export const blockingReasons = (ticket: Ticket, siblings: readonly Ticket[]): string[] => {
  const state = resolveBlockers(ticket, siblings);
  return state.blockers
    .filter((blocker) => !blocker.resolved)
    .map((blocker) =>
      blocker.ticket
        ? `${blocker.ticket.title} (#${blocker.ref.number}) is still open`
        : `Ticket #${blocker.ref.number} is not in the loaded snapshot`,
    );
};

export const isBlocked = (ticket: Ticket, siblings: readonly Ticket[]): boolean =>
  resolveBlockers(ticket, siblings).blocked;

/** Ticket number as a stable, zero-padded label for cards. */
export const numberOf = (ticket: Pick<Ticket, 'numberValue' | 'number'>): string => {
  if (ticket.numberValue === null) return '';
  return ticket.number ?? String(ticket.numberValue).padStart(2, '0');
};
