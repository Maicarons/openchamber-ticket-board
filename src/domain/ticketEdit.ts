import { buildUnifiedDiff } from './unifiedDiff.ts';
import {
  normalizeTicketPath,
  parseBlockedBy,
  parseTicketField,
  splitTicketLines,
  type BlockedByRef,
  type Ticket,
  type TicketField,
} from './ticket.ts';

/**
 * The only writes the board is allowed to make. Every one either replaces the
 * value span of one existing field line or appends a new block under
 * `## Comments` / `## Answer`; no function re-serialises the ticket body.
 */
export type TicketEdit =
  | { kind: 'status'; status: string }
  | { kind: 'blockedBy'; blockedBy: readonly (string | number | BlockedByRef)[] }
  | { kind: 'comment'; body: string; author: string; at: string }
  | { kind: 'answer'; body: string; at: string };

export type TicketEditPreview = {
  path: string;
  before: string;
  after: string;
  diff: string;
  changed: boolean;
  summary: string;
};

export type TicketEditErrorCode = 'conflict' | 'invalid' | 'not-writable';

export class TicketEditError extends Error {
  readonly code: TicketEditErrorCode;

  constructor(code: TicketEditErrorCode, message: string) {
    super(message);
    this.name = 'TicketEditError';
    this.code = code;
  }
}

type Line = { text: string; eol: string };

const joinLines = (lines: readonly Line[]): string => lines.map((line) => line.text + line.eol).join('');

const dominantEol = (lines: readonly Line[], fallback: '\n' | '\r\n'): string => {
  let crlf = 0;
  let lf = 0;
  for (const line of lines) {
    if (line.eol === '\r\n') crlf += 1;
    else if (line.eol === '\n') lf += 1;
  }
  if (crlf > lf) return '\r\n';
  if (lf > 0) return '\n';
  return fallback;
};

/** A ticket file is the only thing the board may write, and only under `.scratch/`. */
export const isWritableTicketPath = (rawPath: string): boolean => {
  const path = normalizeTicketPath(rawPath);
  if (!path.endsWith('.md') || path.startsWith('/') || path.includes('..')) return false;
  if (!path.startsWith('.scratch/')) return false;
  const name = path.split('/').pop() ?? '';
  return !/^(map|spec)\.md$/i.test(name);
};

const assertWritable = (ticket: Ticket): void => {
  if (!isWritableTicketPath(ticket.path)) {
    throw new TicketEditError('not-writable', `${ticket.path} is not a ticket file under .scratch/`);
  }
  if (ticket.conflicts.length) {
    throw new TicketEditError('conflict', ticket.conflicts.join('; '));
  }
};

const commentsBoundary = (lines: readonly Line[]): number => {
  for (let index = 0; index < lines.length; index += 1) {
    if (/^##\s+(Comments|Answer)\s*$/i.test(lines[index]?.text ?? '')) return index;
  }
  return lines.length;
};

const findField = (lines: readonly Line[], label: TicketField['label']): TicketField | null => {
  const limit = commentsBoundary(lines);
  for (let index = 0; index < limit; index += 1) {
    const field = parseTicketField(lines[index]?.text ?? '', index);
    if (field?.label === label) return field;
  }
  return null;
};

const headingIndex = (lines: readonly Line[]): number => {
  for (let index = 0; index < lines.length; index += 1) {
    if (/^#\s+\S/.test(lines[index]?.text ?? '')) return index;
  }
  return -1;
};

/**
 * Insert a whole new line. Blank padding is added only around the inserted
 * line, so every pre-existing line still re-serialises byte-for-byte.
 */
const insertLine = (lines: Line[], index: number, text: string, eol: string, blankAfter = false): void => {
  if (index > 0) {
    const previous = lines[index - 1];
    if (previous && previous.eol === '') previous.eol = eol;
  }
  lines.splice(index, 0, { text, eol });
  if (blankAfter) lines.splice(index + 1, 0, { text: '', eol });
};

const replaceFieldValue = (lines: Line[], field: TicketField, value: string): void => {
  const line = lines[field.lineIndex];
  if (!line) throw new TicketEditError('invalid', `field ${field.label} moved while editing`);
  line.text = `${line.text.slice(0, field.valueStart)}${value}${line.text.slice(field.valueEnd)}`;
};

const insertField = (content: string, label: TicketField['label'], value: string): string => {
  const lines = splitTicketLines(content);
  const eol = dominantEol(lines, content.includes('\r\n') ? '\r\n' : '\n');
  const firstBodyLine = (from: number): number => {
    let at = Math.max(0, from);
    while (at < lines.length && (lines[at]?.text ?? '').trim() === '') at += 1;
    return at;
  };
  if (label === 'Status') {
    const heading = headingIndex(lines);
    const at = firstBodyLine(heading >= 0 ? heading + 1 : 0);
    const blankAfter = at < lines.length && (lines[at]?.text ?? '').trim() !== '';
    insertLine(lines, at, `Status: ${value}`, eol, blankAfter);
  } else {
    const status = findField(lines, 'Status');
    const type = findField(lines, 'Type');
    const anchor = status?.lineIndex ?? type?.lineIndex;
    if (anchor !== undefined) {
      insertLine(lines, anchor + 1, `Blocked by: ${value}`, eol);
    } else {
      const heading = headingIndex(lines);
      const at = firstBodyLine(heading >= 0 ? heading + 1 : 0);
      const blankAfter = at < lines.length && (lines[at]?.text ?? '').trim() !== '';
      insertLine(lines, at, `Blocked by: ${value}`, eol, blankAfter);
    }
  }
  return joinLines(lines);
};

export const setTicketStatus = (content: string, status: string): string => {
  const value = status.trim();
  if (!value || /[\r\n]/.test(value)) throw new TicketEditError('invalid', 'Status must be one line');
  const lines = splitTicketLines(content);
  const first = findField(lines, 'Status');
  if (!first) return insertField(content, 'Status', value);
  const all = lines
    .slice(0, commentsBoundary(lines))
    .map((line, index) => parseTicketField(line.text, index))
    .filter((field): field is TicketField => field?.label === 'Status');
  if (all.length > 1) {
    throw new TicketEditError('conflict', 'This ticket has more than one Status line; fix the file first');
  }
  replaceFieldValue(lines, first, value);
  return joinLines(lines);
};

export const formatBlockedByRefs = (refs: readonly (string | number | BlockedByRef)[]): string => {
  const seen = new Set<number>();
  const values: number[] = [];
  for (const ref of refs) {
    const parsed =
      typeof ref === 'number'
        ? ref
        : typeof ref === 'string'
          ? (parseBlockedBy(ref)[0]?.value ?? Number.NaN)
          : ref.value;
    if (!Number.isInteger(parsed) || parsed <= 0 || seen.has(parsed)) continue;
    seen.add(parsed);
    values.push(parsed);
  }
  if (!values.length) return 'None (can start immediately)';
  return values.map((value) => String(value).padStart(2, '0')).join(', ');
};

export const setTicketBlockedBy = (content: string, refs: readonly (string | number | BlockedByRef)[]): string => {
  const value = formatBlockedByRefs(refs);
  const lines = splitTicketLines(content);
  const first = findField(lines, 'Blocked by');
  if (!first) return insertField(content, 'Blocked by', value);
  replaceFieldValue(lines, first, value);
  return joinLines(lines);
};

const sectionHeading = (name: 'Comments' | 'Answer'): RegExp => new RegExp(`^##\\s+${name}\\s*$`, 'i');

/** Index of the last line belonging to the last matching section, before the next H2. */
const sectionEnd = (lines: readonly Line[], name: 'Comments' | 'Answer'): { heading: number; end: number } | null => {
  let found: { heading: number; end: number } | null = null;
  const pattern = sectionHeading(name);
  for (let index = 0; index < lines.length; index += 1) {
    if (!pattern.test(lines[index]?.text ?? '')) continue;
    let end = index + 1;
    while (end < lines.length && !/^##\s+/.test(lines[end]?.text ?? '')) end += 1;
    found = { heading: index, end };
    index = end - 1;
  }
  return found;
};

const insertBlock = (content: string, name: 'Comments' | 'Answer', block: string): string => {
  const lines = splitTicketLines(content);
  const eol = dominantEol(lines, content.includes('\r\n') ? '\r\n' : '\n');
  const blockLines = block.split('\n');
  const section = sectionEnd(lines, name);
  if (!section) {
    const needsLeadingBlank = lines.length > 0 && (lines[lines.length - 1]?.text ?? '').trim() !== '';
    const start = lines.length;
    if (needsLeadingBlank) lines.push({ text: '', eol });
    lines.push({ text: `## ${name}`, eol }, { text: '', eol });
    for (const [offset, text] of blockLines.entries()) {
      lines.push({ text, eol: offset === blockLines.length - 1 ? eol : eol });
    }
    if (start > 0) {
      const previous = lines[start - 1];
      if (previous && previous.eol === '') previous.eol = eol;
    }
    return joinLines(lines);
  }

  const before = lines[section.end - 1];
  if (before && before.eol === '') before.eol = eol;
  const needsLeadingBlank = section.end > section.heading + 1 && (lines[section.end - 1]?.text ?? '').trim() !== '';
  const needsTrailingBlank = section.end < lines.length && (lines[section.end]?.text ?? '').trim() !== '';
  const inserted: Line[] = [];
  if (needsLeadingBlank) inserted.push({ text: '', eol });
  for (const text of blockLines) inserted.push({ text, eol });
  if (needsTrailingBlank) inserted.push({ text: '', eol });
  lines.splice(section.end, 0, ...inserted);
  return joinLines(lines);
};

export const appendTicketComment = (content: string, body: string, author = 'Board', at = ''): string => {
  const text = body.trim();
  if (!text) throw new TicketEditError('invalid', 'A comment needs text');
  const heading = at ? `### ${author} — ${at}` : `### ${author}`;
  return insertBlock(content, 'Comments', `${heading}\n${text}`);
};

export const appendTicketAnswer = (content: string, body: string): string => {
  const text = body.trim();
  if (!text) throw new TicketEditError('invalid', 'An answer needs text');
  return insertBlock(content, 'Answer', text);
};

const describe = (ticket: Ticket, edit: TicketEdit): string => {
  switch (edit.kind) {
    case 'status':
      return `Status: ${ticket.status ?? '(none)'} → ${edit.status}`;
    case 'blockedBy':
      return `Blocked by: ${ticket.blockedBy.map((ref) => ref.number).join(', ') || '(none)'} → ${formatBlockedByRefs(edit.blockedBy)}`;
    case 'comment':
      return 'Append a comment under ## Comments';
    case 'answer':
      return 'Append an answer under ## Answer';
  }
};

export const applyTicketEdit = (ticket: Ticket, edit: TicketEdit): string => {
  assertWritable(ticket);
  switch (edit.kind) {
    case 'status': {
      if (edit.status === ticket.status) return ticket.content;
      return setTicketStatus(ticket.content, edit.status);
    }
    case 'blockedBy': {
      const selfBlocked = edit.blockedBy.some((ref) => {
        const value =
          typeof ref === 'number'
            ? ref
            : typeof ref === 'string'
              ? (parseBlockedBy(ref)[0]?.value ?? Number.NaN)
              : ref.value;
        return value === ticket.numberValue;
      });
      if (selfBlocked) throw new TicketEditError('invalid', 'A ticket cannot be blocked by itself');
      return setTicketBlockedBy(ticket.content, edit.blockedBy);
    }
    case 'comment':
      return appendTicketComment(ticket.content, edit.body, edit.author, edit.at);
    case 'answer':
      return appendTicketAnswer(ticket.content, edit.body);
  }
};

/**
 * Produce exactly what would be written, plus a unified diff for the
 * confirmation step. Nothing touches disk here.
 */
export const previewTicketEdit = (ticket: Ticket, edit: TicketEdit): TicketEditPreview => {
  const after = applyTicketEdit(ticket, edit);
  return {
    path: ticket.path,
    before: ticket.content,
    after,
    diff: buildUnifiedDiff(ticket.path, ticket.content, after),
    changed: after !== ticket.content,
    summary: describe(ticket, edit),
  };
};
