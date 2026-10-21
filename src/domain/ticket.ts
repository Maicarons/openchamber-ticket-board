/**
 * Matt Pocock's local-markdown ticket format, read without inventing a second
 * shape. One feature is `.scratch/<feature>/`; its tickets are one file each
 * at `.scratch/<feature>/issues/<NN>-<slug>.md`; a wayfinder map is
 * `.scratch/<effort>/map.md` and its child tickets are those issue files.
 *
 * Everything here is pure text parsing. The file is the source of truth, so
 * `content` is kept byte-for-byte and the field records remember where each
 * value starts and ends — that is what lets `ticketEdit.ts` change one line
 * without re-serialising the rest of the ticket.
 */

export const TICKET_TYPES = ['research', 'prototype', 'grilling', 'task'] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

export const TRIAGE_ROLES = ['needs-triage', 'needs-info', 'ready-for-agent', 'ready-for-human', 'wontfix'] as const;
export type TriageRole = (typeof TRIAGE_ROLES)[number];

export const TICKET_CATEGORIES = ['bug', 'enhancement'] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

/** Status values that mean the ticket is finished, including a wontfix. */
const RESOLVED_STATUSES = new Set(['resolved', 'closed', 'done', 'wontfix', 'cancelled', 'canceled']);
const CLAIMED_STATUSES = new Set(['claimed', 'in-progress', 'in_progress']);

export type TicketFileKind = 'ticket' | 'map' | 'spec';

export type TicketFieldLabel = 'Status' | 'Type' | 'Blocked by' | 'Labels' | 'Assignees';

export type TicketField = {
  label: TicketFieldLabel;
  /** Zero-based line index in the original file. */
  lineIndex: number;
  /** The whole original line, including any `**` emphasis and trailing spaces. */
  raw: string;
  /** The trimmed value, e.g. `ready-for-agent`. */
  value: string;
  /** Offsets into `raw`; only this span is replaced when the value changes. */
  valueStart: number;
  valueEnd: number;
};

export type BlockedByRef = {
  /** Digits as written, without a leading `#` (e.g. `02` or `12`). */
  number: string;
  /** Numeric value used to match tickets regardless of zero padding. */
  value: number;
};

export type TicketPathInfo = {
  path: string;
  kind: TicketFileKind;
  /** Feature/effort directory name. Empty for a map or ticket with no feature directory. */
  feature: string;
  number: string | null;
  numberValue: number | null;
  slug: string;
};

export type Ticket = {
  path: string;
  kind: TicketFileKind;
  feature: string;
  number: string | null;
  numberValue: number | null;
  slug: string;
  /** The ticket's name: its H1 with a leading `NN:` removed, never just an id. */
  title: string;
  heading: string | null;
  /** Lower-cased Status value, or null when the file has no Status line. */
  status: string | null;
  /** Lower-cased Type value, or null. */
  type: string | null;
  labels: string[];
  blockedBy: BlockedByRef[];
  category: TicketCategory | null;
  content: string;
  lineEnding: '\n' | '\r\n';
  fields: {
    status: TicketField | null;
    type: TicketField | null;
    blockedBy: TicketField | null;
  };
  /** The text under `## Comments`, all occurrences joined; empty when absent. */
  comments: string;
  /** The text under `## Answer`, all non-empty occurrences joined; empty when absent. */
  answer: string;
  warnings: string[];
  /** Contradictions a person has to resolve before the board may write. */
  conflicts: string[];
};

const FIELD_LABELS: readonly TicketFieldLabel[] = ['Blocked by', 'Status', 'Type', 'Labels', 'Assignees'];
const FIELD_LABEL_PATTERN = FIELD_LABELS.map((label) => label.replace(/\s+/g, '\\s+')).join('|');
const FIELD_RE = new RegExp(`^(\\s*)(\\*\\*)?(${FIELD_LABEL_PATTERN})(?=\\s|\\*|:)`, 'i');
const H1_RE = /^#\s+(.+?)\s*$/;
const H2_RE = /^##\s+(.+?)\s*$/;
const FENCE_RE = /^\s*(```|~~~)/;

export const normalizeTicketPath = (path: string): string => {
  const slashed = path.replace(/\\/g, '/');
  const withoutPrefix = slashed.replace(/^\.\//, '');
  // Keep `..` visible rather than resolving it: callers validate containment.
  return withoutPrefix.replace(/\/+/g, '/');
};

const baseName = (path: string): string => {
  const parts = normalizeTicketPath(path).split('/');
  return parts[parts.length - 1] ?? '';
};

const stripMarkdownExtension = (name: string): string => name.replace(/\.md$/i, '');

const parseNumber = (name: string): { number: string | null; numberValue: number | null } => {
  const match = stripMarkdownExtension(name).match(/^(\d{1,4})(?:[-_.\s]|$)/);
  if (!match) return { number: null, numberValue: null };
  const number = match[1] ?? '';
  return { number, numberValue: Number(number) };
};

const slugOf = (name: string): string => stripMarkdownExtension(name).replace(/^\d{1,4}[-_.\s]+/, '');

/**
 * Classify a repository-relative path. `.scratch/<feature>/issues/NN-slug.md`,
 * `.scratch/<feature>/map.md` and `.scratch/<feature>/spec.md` are the
 * canonical forms. The older flat `.scratch/issues/NN-slug.md` form is read
 * too, with an empty feature, so an existing setup is not invisible to the
 * board.
 */
export const parseTicketPath = (rawPath: string): TicketPathInfo => {
  const path = normalizeTicketPath(rawPath);
  const parts = path.split('/');
  const name = parts[parts.length - 1] ?? '';
  const scratchAt = parts.lastIndexOf('.scratch');
  const afterScratch = scratchAt >= 0 ? parts.slice(scratchAt + 1) : [];
  const scope = (): string => {
    if (scratchAt < 0) return parts.length > 1 ? (parts[parts.length - 2] ?? '') : '';
    // `.scratch/<feature>/...` -> feature; `.scratch/issues/...` -> no feature.
    if (afterScratch.length >= 2 && afterScratch[0] !== 'issues') return afterScratch[0] ?? '';
    return '';
  };
  const isMap = /^map\.md$/i.test(name);
  const isSpec = /^spec\.md$/i.test(name);
  const isIssue = afterScratch.length >= 1 && (afterScratch[0] === 'issues' || afterScratch[0] === 'tickets');
  const { number, numberValue } = isMap || isSpec ? { number: null, numberValue: null } : parseNumber(name);
  return {
    path,
    kind: isMap ? 'map' : isSpec ? 'spec' : isIssue || numberValue !== null ? 'ticket' : 'spec',
    feature: scope(),
    number,
    numberValue,
    slug: isMap ? 'map' : isSpec ? 'spec' : slugOf(name),
  };
};

/**
 * Parse a field line without assuming one emphasis style. Accepts
 * `Status: x`, `**Status:** x`, `**Status**: x` and `Status : x`; the offsets
 * always point at the value itself so a write leaves the label untouched.
 */
export const parseTicketField = (line: string, lineIndex = 0): TicketField | null => {
  const head = FIELD_RE.exec(line);
  if (!head) return null;
  const labelText = (head[3] ?? '').replace(/\s+/g, ' ').toLowerCase();
  const label = FIELD_LABELS.find((candidate) => candidate.toLowerCase() === labelText);
  if (!label) return null;

  let cursor = head[0].length;
  const skipSpace = () => {
    while (cursor < line.length && (line[cursor] === ' ' || line[cursor] === '\t')) cursor += 1;
  };
  skipSpace();
  if (line.startsWith(':**', cursor)) {
    cursor += 3;
  } else if (line.startsWith('**', cursor)) {
    cursor += 2;
    skipSpace();
    if (line[cursor] === ':') cursor += 1;
    else return null;
  } else if (line[cursor] === ':') {
    cursor += 1;
  } else {
    return null;
  }
  skipSpace();

  const raw = line;
  const valueStart = cursor;
  let valueEnd = line.length;
  while (valueEnd > valueStart && (line[valueEnd - 1] === ' ' || line[valueEnd - 1] === '\t')) valueEnd -= 1;
  return {
    label,
    lineIndex,
    raw,
    value: line.slice(valueStart, valueEnd),
    valueStart,
    valueEnd,
  };
};

export const parseBlockedBy = (value: string): BlockedByRef[] => {
  const trimmed = value.trim();
  if (!trimmed || /^(none|n\/a)\b/i.test(trimmed) || /^[—–-]$/.test(trimmed)) return [];
  const refs: BlockedByRef[] = [];
  const seen = new Set<number>();
  for (const chunk of trimmed.replace(/\s+and\s+/gi, ',').split(/[,;]/)) {
    const match = chunk.trim().match(/^#?\s*(\d{1,4})\b/);
    if (!match) continue;
    const number = match[1] ?? '';
    const parsed = Number(number);
    if (!Number.isFinite(parsed) || seen.has(parsed)) continue;
    seen.add(parsed);
    refs.push({ number, value: parsed });
  }
  return refs;
};

const splitLabels = (value: string): string[] =>
  value
    .split(/[,;]/)
    .map((label) => label.trim())
    .filter(Boolean);

type LineRecord = { text: string; eol: string };

/** Split while remembering each line's own terminator, so untouched lines rejoin byte-identical. */
export const splitTicketLines = (content: string): LineRecord[] => {
  const lines: LineRecord[] = [];
  let at = 0;
  while (at < content.length) {
    let end = at;
    while (end < content.length && content[end] !== '\n' && content[end] !== '\r') end += 1;
    const text = content.slice(at, end);
    let eol = '';
    if (content[end] === '\r' && content[end + 1] === '\n') {
      eol = '\r\n';
      end += 2;
    } else if (content[end] === '\r') {
      eol = '\r';
      end += 1;
    } else if (content[end] === '\n') {
      eol = '\n';
      end += 1;
    }
    lines.push({ text, eol });
    at = end;
  }
  return lines;
};

export const detectLineEnding = (content: string): '\n' | '\r\n' => (content.includes('\r\n') ? '\r\n' : '\n');

const lineTexts = (content: string): string[] => splitTicketLines(content).map((line) => line.text);

const firstHeading = (lines: readonly string[], depth: 1 | 2): { index: number; text: string } | null => {
  let fenced = false;
  const pattern = depth === 1 ? H1_RE : H2_RE;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (FENCE_RE.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const match = line.match(pattern);
    if (match) return { index, text: match[1] ?? '' };
  }
  return null;
};

/** Section bodies are read from every occurrence; an empty second Answer is simply ignored. */
const sectionBodies = (lines: readonly string[], name: string): string[] => {
  const heading = new RegExp(`^##\\s+${name}\\s*$`, 'i');
  const bodies: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!heading.test(lines[index] ?? '')) continue;
    let end = index + 1;
    while (end < lines.length && !H2_RE.test(lines[end] ?? '')) end += 1;
    const body = lines.slice(index + 1, end).join('\n').trim();
    if (body) bodies.push(body);
    index = end - 1;
  }
  return bodies;
};

const headingTitle = (heading: string, fallback: string): string => {
  const withoutNumber = heading.replace(/^\d{1,4}\s*[:.\-–—]\s*/, '').trim();
  return withoutNumber || heading.trim() || fallback;
};

const fallbackTitle = (slug: string): string => {
  const words = slug.replace(/[-_]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Untitled ticket';
};

export const isResolvedStatus = (status: string | null | undefined): boolean =>
  status !== null && status !== undefined && RESOLVED_STATUSES.has(status.trim().toLowerCase());

export const isClaimedStatus = (status: string | null | undefined): boolean =>
  status !== null && status !== undefined && CLAIMED_STATUSES.has(status.trim().toLowerCase());

export const isTriageRole = (status: string | null | undefined): status is TriageRole =>
  status !== null && status !== undefined && (TRIAGE_ROLES as readonly string[]).includes(status);

/**
 * Parse one ticket file. Malformed or unfamiliar content never throws: it is
 * returned with warnings so a board can show the card and explain what it
 * could not understand. Only a non-string content or empty path is a caller
 * error.
 */
export const parseTicketContent = (rawPath: string, content: string, vocabulary: Readonly<Record<string, string>> = {}): Ticket => {
  if (typeof content !== 'string') throw new Error('ticket content must be text');
  const info = parseTicketPath(rawPath);
  const lines = lineTexts(content);
  const fields: Ticket['fields'] = { status: null, type: null, blockedBy: null };
  const allFields: TicketField[] = [];

  // Fields are part of the ticket's pre-comment body. Scanning the whole file
  // would treat a `Status:` example inside a comment as the ticket's status.
  let fieldLimit = lines.length;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (/^##\s+(Comments|Answer)\s*$/i.test(line)) {
      fieldLimit = index;
      break;
    }
  }
  for (let index = 0; index < fieldLimit; index += 1) {
    const field = parseTicketField(lines[index] ?? '', index);
    if (field) allFields.push(field);
  }

  const warnings: string[] = [];
  const conflicts: string[] = [];
  const byLabel = (label: TicketFieldLabel) => allFields.filter((field) => field.label === label);
  const statusFields = byLabel('Status');
  const typeFields = byLabel('Type');
  const blockedFields = byLabel('Blocked by');
  const labelFields = byLabel('Labels');

  if (statusFields.length > 1) {
    const values = new Set(statusFields.map((field) => field.value.trim().toLowerCase()));
    if (values.size > 1) conflicts.push(`Conflicting Status lines: ${[...values].join(', ')}`);
    else warnings.push(`Status is written ${statusFields.length} times`);
  }
  if (blockedFields.length > 1) {
    warnings.push(`Blocked by is written ${blockedFields.length} times`);
  }
  if (typeFields.length > 1) warnings.push(`Type is written ${typeFields.length} times`);
  fields.status = statusFields[0] ?? null;
  fields.type = typeFields[0] ?? null;
  fields.blockedBy = blockedFields[0] ?? null;

  const rawStatus = fields.status?.value.trim() ?? '';
  const status = rawStatus ? rawStatus.toLowerCase() : null;
  const rawType = fields.type?.value.trim() ?? '';
  const type = rawType ? rawType.toLowerCase() : null;
  if (type && !(TICKET_TYPES as readonly string[]).includes(type)) {
    warnings.push(`Unknown Type "${rawType}"`);
  }

  const labels = [...new Set(labelFields.flatMap((field) => splitLabels(field.value)))];
  const category =
    labels
      .map((label) => label.toLowerCase())
      .find((label): label is TicketCategory => (TICKET_CATEGORIES as readonly string[]).includes(label)) ?? null;

  const blockedBy = fields.blockedBy ? parseBlockedBy(fields.blockedBy.value) : [];
  if (blockedBy.some((ref) => info.numberValue !== null && ref.value === info.numberValue)) {
    warnings.push('Ticket lists itself in Blocked by');
  }

  const heading = firstHeading(lines, 1);
  if (!heading) warnings.push('No H1 title; using the file name');
  const title = headingTitle(heading?.text ?? '', fallbackTitle(info.slug));
  const comments = sectionBodies(lines, 'Comments').join('\n\n');
  const answer = sectionBodies(lines, 'Answer').join('\n\n');

  if (
    status &&
    !isTriageRole(status) &&
    !isResolvedStatus(status) &&
    !isClaimedStatus(status) &&
    !Object.values(vocabulary).some((label) => label.trim().toLowerCase() === status)
  ) {
    warnings.push(`Unrecognised Status "${rawStatus}"`);
  }

  return {
    path: info.path,
    kind: info.kind,
    feature: info.feature,
    number: info.number,
    numberValue: info.numberValue,
    slug: info.slug,
    title,
    heading: heading?.text ?? null,
    status,
    type,
    labels,
    blockedBy,
    category,
    content,
    lineEnding: detectLineEnding(content),
    fields,
    comments,
    answer,
    warnings,
    conflicts,
  };
};

export const parseTicket = (rawPath: string, content: string, vocabulary: Readonly<Record<string, string>> = {}): Ticket =>
  parseTicketContent(rawPath, content, vocabulary);

/** A name first, always; the id is a fallback for a file with no heading. */
export const ticketName = (ticket: Pick<Ticket, 'title'>): string => ticket.title;

/** `01` locally, `#42` when the tracker uses issue numbers. */
export const ticketRef = (ticket: Pick<Ticket, 'number' | 'numberValue'>, style: 'local' | 'issue' = 'local'): string => {
  if (ticket.numberValue === null) return '';
  return style === 'issue' ? `#${ticket.numberValue}` : (ticket.number ?? String(ticket.numberValue).padStart(2, '0'));
};

export const ticketPathLabel = (ticket: Pick<Ticket, 'path'>): string => ticket.path;

export const sameFeature = (ticket: Pick<Ticket, 'feature'>, feature: string): boolean => ticket.feature === feature;
