import { TRIAGE_ROLES, type TriageRole } from './ticket.ts';

/**
 * Matt's skills speak in five canonical triage roles; a repository may use
 * different label strings. `docs/agents/triage-labels.md` is the bridge. The
 * local board keeps showing the canonical role while reading and writing the
 * repository's own vocabulary.
 */
export const DEFAULT_TRIAGE_LABELS: Record<TriageRole, string> = {
  'needs-triage': 'needs-triage',
  'needs-info': 'needs-info',
  'ready-for-agent': 'ready-for-agent',
  'ready-for-human': 'ready-for-human',
  wontfix: 'wontfix',
};

export type TriageLabels = Record<TriageRole, string>;

const stripCode = (value: string): string =>
  value
    .trim()
    .replace(/^`+/, '')
    .replace(/`+$/, '')
    .trim();

const splitRow = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());

const roleOf = (value: string): TriageRole | null => {
  const text = stripCode(value).toLowerCase();
  return (TRIAGE_ROLES as readonly string[]).includes(text) ? (text as TriageRole) : null;
};

/**
 * Parse the mapping table from `docs/agents/triage-labels.md`.
 *
 * The documented table has the role in the left column and the repository's
 * actual label in the right column. We locate the columns by their header so
 * a translated or reordered table still works. A simple `needs-triage: label`
 * list is accepted too, because people edit these files by hand.
 *
 * Anything uncertain returns `null`: the caller then uses the defaults rather
 * than inventing a vocabulary.
 */
export const parseTriageLabels = (content: string | null | undefined): TriageLabels | null => {
  if (typeof content !== 'string' || !content.trim()) return null;
  const lines = content.split(/\r?\n/);
  let roleColumn = 0;
  let labelColumn = 1;
  let headerSeen = false;
  const found: Partial<Record<TriageRole, string>> = {};

  for (const line of lines) {
    if (!line.includes('|')) continue;
    const cells = splitRow(line);
    if (cells.length < 2) continue;
    if (!headerSeen && /role|label|skill|tracker/i.test(line)) {
      const trackerIndex = cells.findIndex((cell) => /tracker|actual|label in our|our label/i.test(cell));
      const roleIndex = cells.findIndex((cell) => /role|skill|canonical|mattpocock/i.test(cell));
      if (trackerIndex >= 0 && roleIndex >= 0) {
        roleColumn = roleIndex;
        labelColumn = trackerIndex;
        headerSeen = true;
      }
      continue;
    }
    if (/^[-: ]+$/.test(cells.join(''))) continue;
    const role = roleOf(cells[roleColumn] ?? '');
    if (!role) continue;
    const label = stripCode(cells[labelColumn] ?? '');
    if (label && label !== '—' && label !== '-') found[role] = label;
  }

  if (Object.keys(found).length === 0) {
    for (const line of lines) {
      const match = line.match(/^\s*(?:[-*]\s*)?`?(needs-triage|needs-info|ready-for-agent|ready-for-human|wontfix)`?\s*[:=-]\s*(.+?)\s*$/i);
      if (!match) continue;
      const role = match[1]?.toLowerCase() as TriageRole | undefined;
      const label = stripCode(match[2] ?? '');
      if (role && label && (TRIAGE_ROLES as readonly string[]).includes(role)) found[role] = label;
    }
  }

  if (Object.keys(found).length === 0) return null;
  return { ...DEFAULT_TRIAGE_LABELS, ...found };
};

/** The canonical role a Status/label value represents, if it is one. */
export const triageRoleForStatus = (
  status: string | null | undefined,
  labels: TriageLabels = DEFAULT_TRIAGE_LABELS,
): TriageRole | null => {
  if (!status) return null;
  const value = status.trim().toLowerCase();
  const direct = roleOf(value);
  if (direct) return direct;
  for (const role of TRIAGE_ROLES) {
    if (labels[role].toLowerCase() === value) return role;
  }
  return null;
};

/** The string to write to a ticket's `Status:` line for a canonical role. */
export const statusForTriageRole = (role: TriageRole, labels: TriageLabels = DEFAULT_TRIAGE_LABELS): string =>
  labels[role] || DEFAULT_TRIAGE_LABELS[role];
