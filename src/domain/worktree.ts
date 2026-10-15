import type { GuestSessionWorktree, GuestWorktree, StartSessionResult } from '@openchamber/sdk';
import type { TaskWorktree } from './task.ts';

export const DESTINATION_ROOT = 'root';
export const DESTINATION_NEW = 'new';

/**
 * Turns the "Session directory" picker's selection into the `worktree`
 * field `host.startSession` expects. `destination` is `root`, `new`, or an
 * existing worktree's directory (its id in the picker's options).
 * `baseBranch` is already resolved (see `resolveBaseBranch`) — `undefined`
 * means "use the project default", exactly what omitting it means to the host.
 */
export const buildSessionWorktree = (destination: string, branchName: string, baseBranch: string | undefined): GuestSessionWorktree => {
  if (destination === DESTINATION_ROOT) return false;
  if (destination === DESTINATION_NEW) {
    const request: { kind: 'new'; name?: string; baseBranch?: string } = { kind: 'new' };
    const name = branchName.trim();
    if (name) request.name = name;
    if (baseBranch) request.baseBranch = baseBranch;
    return request;
  }
  return { kind: 'existing', directory: destination };
};

export const DEFAULT_BASE_BRANCH_OPTION = '';

/** An empty selection means "use the project default" — exactly what omitting `baseBranch` means to the host. */
export const resolveBaseBranch = (selectedOption: string): string | undefined => selectedOption || undefined;

/**
 * A new branch can't be based on itself: either it doesn't exist yet (there's
 * nothing to base it on), or it already does (git refuses to create a branch
 * with a name already taken). `resolvedBaseBranch` is `resolveBaseBranch`'s
 * output — `undefined` ("use project default") is never a conflict, since we
 * don't know what that resolves to.
 */
export const branchNameConflictsWithBase = (branchName: string, resolvedBaseBranch: string | undefined): boolean =>
  resolvedBaseBranch !== undefined && branchName.trim() === resolvedBaseBranch;

/**
 * Options for the "Based on" dropdown, built from the project's existing
 * worktrees — the SDK has no API to list a repository's full branch set,
 * only `GuestWorktree.branch`, one per *existing* worktree. Used when the
 * local git-branch service (below) isn't approved or available.
 */
export const buildBaseBranchOptions = (worktrees: readonly GuestWorktree[]) => {
  const branches = [...new Set(worktrees.map((w) => w.branch).filter((b): b is string => Boolean(b)))].sort();
  return [{ id: DEFAULT_BASE_BRANCH_OPTION, label: 'Use project default' }, ...branches.map((branch) => ({ id: branch, label: branch }))];
};

/** Whether the dropdown has any real branch to offer beyond "Use project default". */
export const hasKnownBranches = (worktrees: readonly GuestWorktree[]): boolean => worktrees.some((w) => Boolean(w.branch));

/**
 * What to persist on the task once `startSession` returns successfully.
 * Prefers the host's own report of where the session ended up; falls back
 * to the directory we asked for when the host didn't echo one back (e.g. an
 * existing worktree we already knew the branch for isn't re-stated).
 */
export const resolveTaskWorktree = (requested: GuestSessionWorktree, result: StartSessionResult): TaskWorktree | null => {
  if (result.sessionId === null) return null;
  if (result.worktree) return { directory: result.worktree.directory, branch: result.worktree.branch };
  if (typeof requested === 'object' && requested.kind === 'existing') return { directory: requested.directory, branch: null };
  return null;
};

export const describeWorktreeOption = (worktree: GuestWorktree) => ({
  id: worktree.directory,
  label: worktree.name,
  hint: worktree.status,
  disabled: worktree.status !== 'ready',
});

/**
 * The local git-branch service (`contributes.service`, `permissions.exec:
 * ["git"]`) is the only way to list a repository's real branches — the SDK
 * has no API for this. It runs exactly one command, read-only:
 * `git for-each-ref`, for a project directory already known to the panel.
 * Every function below degrades to `null` on any failure (not approved,
 * not running, unsupported platform), so the caller always has the
 * worktree-derived fallback above, never an error.
 */
export type ServiceBranch = { name: string; kind: 'local' | 'remote' };

/** Parses `git for-each-ref --format=%(refname) refs/heads refs/remotes`, skipping each remote's own `HEAD` pointer. */
export const parseGitRefOutput = (stdout: string): ServiceBranch[] => {
  const branches: ServiceBranch[] = [];
  for (const line of stdout.split('\n').map((l) => l.trim()).filter(Boolean)) {
    if (line.startsWith('refs/heads/')) branches.push({ name: line.slice('refs/heads/'.length), kind: 'local' });
    else if (line.startsWith('refs/remotes/')) {
      const name = line.slice('refs/remotes/'.length);
      if (!name.endsWith('/HEAD')) branches.push({ name, kind: 'remote' });
    }
  }
  return branches;
};

/**
 * Local branches first (most likely what you want to branch from), then
 * remote, deduplicated. Preserves the order `branches` arrived in — the
 * service lists them most-recently-active first, more useful than A→Z for
 * picking a base branch.
 */
export const buildBaseBranchOptionsFromService = (branches: readonly ServiceBranch[]) => {
  const seen = new Set<string>();
  const local: Array<{ id: string; label: string; hint?: string }> = [];
  const remote: Array<{ id: string; label: string; hint?: string }> = [];
  for (const branch of branches) {
    if (!branch.name || seen.has(branch.name)) continue;
    seen.add(branch.name);
    const option = { id: branch.name, label: branch.name, hint: branch.kind === 'remote' ? 'remote' : undefined };
    (branch.kind === 'remote' ? remote : local).push(option);
  }
  return [{ id: DEFAULT_BASE_BRANCH_OPTION, label: 'Use project default' }, ...local, ...remote];
};

/** Validates the service's `GET /branches` body. `null` means it wasn't a usable answer — treat exactly like the service being unavailable. */
export const parseBranchServiceResponse = (body: string): ServiceBranch[] | null => {
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch { return null; }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as Record<string, unknown>).branches)) return null;
  const result: ServiceBranch[] = [];
  for (const entry of (parsed as { branches: unknown[] }).branches) {
    if (!entry || typeof entry !== 'object') continue;
    const name = (entry as Record<string, unknown>).name;
    const kind = (entry as Record<string, unknown>).kind;
    if (typeof name !== 'string' || !name.trim()) continue;
    result.push({ name: name.trim(), kind: kind === 'remote' ? 'remote' : 'local' });
  }
  return result;
};
