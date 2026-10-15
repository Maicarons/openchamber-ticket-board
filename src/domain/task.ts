export const STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'done'] as const;
export type TaskStatus = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
};

export const TASK_SCHEMA_VERSION = 1;
export const TITLE_MAX = 200;
export const DESCRIPTION_MAX = 16000;
/** What `Add task` titles a brand-new, not-yet-edited task. Treated as "no real title yet" wherever that distinction matters (e.g. choosing a session's title). */
export const DEFAULT_TASK_TITLE = 'New task';
const REF_MAX = 512;
const ID_PATTERN = /^t_[a-z0-9]{6,40}$/;

export type TaskWorktree = { directory: string; branch: string | null };

export type Task = {
  schemaVersion: typeof TASK_SCHEMA_VERSION;
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  rank: number;
  projectId: string | null;
  sourceBranch: string | null;
  worktree: TaskWorktree | null;
  sessionId: string | null;
  createdAt: number;
  updatedAt: number;
  /**
   * Set when a status change you didn't make yourself (the live agent-status
   * sync, or auto-adopting a running session) lands the task in Review —
   * never by a status change you made yourself. Cleared the moment you open
   * the task, whether that's its chat or its detail popup. `null` means
   * nothing is waiting on your attention. A task saved before this field
   * existed simply has no marker, which is correct: it was never flagged.
   */
  needsAttentionSince: number | null;
};

export type TaskDraft = {
  title: string;
  description?: string;
  status?: TaskStatus;
  projectId?: string | null;
  sourceBranch?: string | null;
};

export type TaskPatch = Partial<
  Pick<Task, 'title' | 'description' | 'status' | 'projectId' | 'sourceBranch' | 'worktree' | 'sessionId' | 'rank' | 'needsAttentionSince'>
>;

export const isStatus = (value: unknown): value is TaskStatus =>
  typeof value === 'string' && (STATUSES as readonly string[]).includes(value);

export const newTaskId = (now = Date.now(), random: () => number = Math.random) => {
  const suffix = Array.from({ length: 6 }, () => Math.floor(random() * 36).toString(36)).join('');
  return `t_${now.toString(36)}${suffix}`;
};

const optionalRef = (value: unknown, field: string): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > REF_MAX) throw new Error(`${field} is too long`);
  return trimmed;
};

const cleanTitle = (value: unknown) => {
  if (typeof value !== 'string') throw new Error('Title must be text');
  const title = value.trim();
  if (!title) throw new Error('A task needs a title');
  if (title.length > TITLE_MAX) throw new Error(`Title is limited to ${TITLE_MAX} characters`);
  return title;
};

const cleanDescription = (value: unknown) => {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new Error('Description must be text');
  if (value.length > DESCRIPTION_MAX) throw new Error(`Description is limited to ${DESCRIPTION_MAX} characters`);
  return value;
};

const cleanWorktree = (value: unknown): TaskWorktree | null => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') throw new Error('worktree must be an object');
  const record = value as Record<string, unknown>;
  const directory = optionalRef(record.directory, 'worktree.directory');
  if (!directory) throw new Error('worktree.directory is required');
  return { directory, branch: optionalRef(record.branch, 'worktree.branch') };
};

const cleanTimestamp = (value: unknown, field: string) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`${field} must be a timestamp`);
  return value;
};

/** Like `cleanTimestamp`, but absent (a record saved before this field existed) is a valid `null`, not an error. */
const optionalTimestamp = (value: unknown, field: string): number | null => {
  if (value === null || value === undefined) return null;
  return cleanTimestamp(value, field);
};

export const createTask = (draft: TaskDraft, rank: number, now = Date.now(), id = newTaskId(now)): Task => ({
  schemaVersion: TASK_SCHEMA_VERSION,
  id,
  title: cleanTitle(draft.title),
  description: cleanDescription(draft.description),
  status: draft.status ?? 'backlog',
  rank,
  projectId: optionalRef(draft.projectId, 'projectId'),
  sourceBranch: optionalRef(draft.sourceBranch, 'sourceBranch'),
  worktree: null,
  sessionId: null,
  createdAt: now,
  updatedAt: now,
  needsAttentionSince: null,
});

export const applyPatch = (task: Task, patch: TaskPatch, now = Date.now()): Task => {
  const next: Task = { ...task, updatedAt: Math.max(now, task.updatedAt) };
  if ('title' in patch) next.title = cleanTitle(patch.title);
  if ('description' in patch) next.description = cleanDescription(patch.description);
  if ('status' in patch) {
    if (!isStatus(patch.status)) throw new Error('Unknown status');
    next.status = patch.status;
  }
  if ('projectId' in patch) next.projectId = optionalRef(patch.projectId, 'projectId');
  if ('sourceBranch' in patch) next.sourceBranch = optionalRef(patch.sourceBranch, 'sourceBranch');
  if ('worktree' in patch) next.worktree = cleanWorktree(patch.worktree);
  if ('sessionId' in patch) next.sessionId = optionalRef(patch.sessionId, 'sessionId');
  if ('rank' in patch) {
    if (typeof patch.rank !== 'number' || !Number.isFinite(patch.rank)) throw new Error('rank must be a number');
    next.rank = patch.rank;
  }
  if ('needsAttentionSince' in patch) next.needsAttentionSince = optionalTimestamp(patch.needsAttentionSince, 'needsAttentionSince');
  return next;
};

/** Validates an untrusted stored value. Throws with a reason when it is not a task. */
export const parseTask = (value: unknown): Task => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Task record is not an object');
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== TASK_SCHEMA_VERSION) throw new Error(`Unsupported task schema ${String(record.schemaVersion)}`);
  if (typeof record.id !== 'string' || !ID_PATTERN.test(record.id)) throw new Error('Task id is invalid');
  if (!isStatus(record.status)) throw new Error('Task status is invalid');
  if (typeof record.rank !== 'number' || !Number.isFinite(record.rank)) throw new Error('Task rank is invalid');
  return {
    schemaVersion: TASK_SCHEMA_VERSION,
    id: record.id,
    title: cleanTitle(record.title),
    description: cleanDescription(record.description),
    status: record.status,
    rank: record.rank,
    projectId: optionalRef(record.projectId, 'projectId'),
    sourceBranch: optionalRef(record.sourceBranch, 'sourceBranch'),
    worktree: cleanWorktree(record.worktree),
    sessionId: optionalRef(record.sessionId, 'sessionId'),
    createdAt: cleanTimestamp(record.createdAt, 'createdAt'),
    updatedAt: cleanTimestamp(record.updatedAt, 'updatedAt'),
    needsAttentionSince: optionalTimestamp(record.needsAttentionSince, 'needsAttentionSince'),
  };
};
