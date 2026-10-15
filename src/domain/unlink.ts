/**
 * Link health: whether what a task points at — its session, or its worktree —
 * still exists on the host. The answer is only ever trusted as "gone" when
 * the snapshot provably finished loading; anything less is "unknown", and a
 * caller must never unlink on "unknown" — an incomplete list is not a
 * disappearance, and unlinking loses the link permanently.
 */
export type LinkState = 'linked' | 'gone' | 'unknown';

export type LoadState = 'loading' | 'ready' | 'error';

/** The narrow structural shape of a sessions snapshot the logic below needs. */
export type SessionsView = {
  state: LoadState;
  coverage: ReadonlyArray<{ directory: string; state: LoadState }>;
  sessions: ReadonlyArray<{ id: string; directory: string; archivedAt: number | null }>;
};

/** The narrow structural shape of a worktrees snapshot the logic below needs. */
export type WorktreesView = {
  state: LoadState;
  worktrees: ReadonlyArray<{ directory: string; status: 'ready' | 'pending' | 'invalid' | 'missing' }>;
};

/**
 * Whether a linked session still exists. An archived session (`archivedAt`)
 * counts as gone — the sidebar's archive breaks the link just like a delete.
 * An absent one counts as gone only when the snapshot finished loading and,
 * for the directory the session was last seen in, coverage finished too:
 * a session missing from a snapshot that hasn't read its directory yet
 * proves nothing. `directory` is `null` when unknown, in which case every
 * coverage entry must be ready before absence is trusted.
 */
export const sessionLinkState = (sessionId: string, directory: string | null, view: SessionsView): LinkState => {
  const found = view.sessions.find((session) => session.id === sessionId);
  if (found) return found.archivedAt === null ? 'linked' : 'gone';
  if (view.state !== 'ready') return 'unknown';
  if (directory !== null) {
    const entry = view.coverage.find((coverage) => coverage.directory === directory);
    if (entry && entry.state !== 'ready') return 'unknown';
    return 'gone';
  }
  return view.coverage.some((coverage) => coverage.state !== 'ready') ? 'unknown' : 'gone';
};

/**
 * Whether a task's worktree still exists. Deleted means absent from a
 * finished snapshot, or present but reported `missing` (its directory is
 * gone from disk) — either way the link has nothing left to point at.
 */
export const worktreeLinkState = (directory: string, view: WorktreesView): LinkState => {
  if (view.state !== 'ready') return 'unknown';
  const found = view.worktrees.find((worktree) => worktree.directory === directory);
  if (!found) return 'gone';
  return found.status === 'missing' ? 'gone' : 'linked';
};
