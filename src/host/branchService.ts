import type { HostClient } from '@openchamber/sdk';
import { buildBaseBranchOptionsFromService, parseBranchServiceResponse } from '../domain/worktree.ts';
import type { Language } from '../i18n.ts';

export type BranchServiceHost = Pick<HostClient, 'serviceRequest'>;

/**
 * Best-effort: the local git-branch service is an optional capability on
 * top of the base install, and may be unavailable (not approved, not
 * running, or this platform doesn't support services at all — VS Code and
 * mobile never do). Any failure here returns `null` rather than throwing,
 * so the caller always has a complete, working fallback — the
 * worktree-derived list from `buildBaseBranchOptions` — and this is never
 * surfaced to the user as an error.
 */
export const fetchServiceBranches = async (
  host: BranchServiceHost,
  directory: string,
  language: Language = 'en',
) => {
  try {
    const result = await host.serviceRequest({ method: 'GET', path: '/branches', query: { directory } });
    if (result.status !== 200) return null;
    const branches = parseBranchServiceResponse(result.body);
    return branches ? buildBaseBranchOptionsFromService(branches, language) : null;
  } catch {
    return null;
  }
};
