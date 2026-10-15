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
export const CUSTOM_BASE_BRANCH_OPTION = '__custom__';

/**
 * Options for the "Base branch" dropdown. The SDK has no API to list a
 * repository's branches — only `GuestWorktree.branch`, one per *existing*
 * worktree — so the dropdown is built from those (deduplicated), plus
 * "Use project default" and a "Custom branch…" escape hatch for anything
 * not already checked out as a worktree.
 */
export const buildBaseBranchOptions = (worktrees: readonly GuestWorktree[]) => {
  const branches = [...new Set(worktrees.map((w) => w.branch).filter((b): b is string => Boolean(b)))].sort();
  return [
    { id: DEFAULT_BASE_BRANCH_OPTION, label: 'Use project default' },
    ...branches.map((branch) => ({ id: branch, label: branch })),
    { id: CUSTOM_BASE_BRANCH_OPTION, label: 'Custom branch…' },
  ];
};

/** Resolves the base-branch dropdown's selection (plus the custom text field, when shown) to what `buildSessionWorktree` expects. */
export const resolveBaseBranch = (selectedOption: string, customValue: string): string | undefined => {
  if (selectedOption === CUSTOM_BASE_BRANCH_OPTION) return customValue.trim() || undefined;
  return selectedOption || undefined;
};

/**
 * Whether the dropdown has any *real* branch to offer. Most projects won't
 * have an existing worktree the first time this is opened, so this is
 * commonly `false` — in which case the UI should default straight to the
 * "Custom branch…" text field rather than show a dropdown with nothing
 * useful in it.
 */
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

// --- Optional local git-branch service (contributes.service, permissions.exec: ["git"]) ---
// The SDK itself has no API to list a repository's branches (verified: no
// method on HostClient does this). A declared local service is the SDK's
// own sanctioned mechanism for "things a page cannot reach" — the official
// `git-graph-status` example uses the same pattern to read git history.
// This is read-only and only ever runs `git -C <directory> for-each-ref`.
// It's optional: every function here degrades to `null`/the worktree-based
// list on any failure, so a user who hasn't approved the service (or is on
// a platform that doesn't support services at all) still gets the fallback
// from `buildBaseBranchOptions` above, never an error.

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
 * remote, deduplicated. Preserves the order `branches` arrived in rather
 * than re-sorting alphabetically — the service lists them most-recently-active
 * first, a far more useful default than A→Z for picking a base branch.
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
  return [
    { id: DEFAULT_BASE_BRANCH_OPTION, label: 'Use project default' },
    ...local,
    ...remote,
    { id: CUSTOM_BASE_BRANCH_OPTION, label: 'Custom branch…' },
  ];
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
