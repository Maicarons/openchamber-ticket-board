import { HostRequestError, type GuestProject, type GuestSessionRecord, type GuestSessionsSnapshot, type GuestWorktree, type GuestWorktreesSnapshot, type HostClient, type StartSessionSent } from '@openchamber/sdk';
import { translate, type Language } from '../i18n.ts';

export type WorkspaceHost = Pick<HostClient, 'onProjects' | 'onSessions' | 'onWorktrees' | 'openSession'>;

export type ProjectsState = { state: 'loading' | 'ready' | 'error'; projects: GuestProject[] };

/** Live project list from OpenChamber. Returns an unsubscribe function. */
export const watchProjects = async (host: WorkspaceHost, listener: (state: ProjectsState) => void) =>
  host.onProjects((snapshot) => listener({ state: snapshot.state, projects: snapshot.projects }));

export type SessionsResult = { complete: boolean; sessions: GuestSessionRecord[]; allSessions: GuestSessionRecord[] };

/**
 * One-off session list for a project. Subscribes, resolves on the first
 * `ready`/`error` snapshot (or the last one seen after `timeoutMs`), then
 * releases the subscription so it never counts against the 32-per-frame cap.
 */
export const fetchSessions = (host: WorkspaceHost, projectId: string, timeoutMs = 8000): Promise<SessionsResult> =>
  new Promise((resolve, reject) => {
    let last: GuestSessionsSnapshot | null = null;
    let settled = false;
    let release: (() => void) | null = null;
    const finish = (snapshot: GuestSessionsSnapshot | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      release?.();
      const allSessions = (snapshot?.sessions ?? [])
        .filter((session) => session.parentId === null)
        .sort((a, b) => b.updatedAt - a.updatedAt);
      const sessions = allSessions.filter((session) => session.archivedAt === null);
      resolve({ complete: snapshot?.state === 'ready', sessions, allSessions });
    };
    const timer = setTimeout(() => finish(last), timeoutMs);
    host.onSessions(projectId, (snapshot) => {
      last = snapshot;
      if (snapshot.state !== 'loading') finish(snapshot);
    }).then((stop) => {
      release = stop;
      if (settled) stop();
    }, (error: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
  });

export type WorktreesResult = { complete: boolean; worktrees: GuestWorktree[] };

/** One-off worktree list for a project, same resolve/release pattern as `fetchSessions`. */
export const fetchWorktrees = (host: WorkspaceHost, projectId: string, timeoutMs = 8000): Promise<WorktreesResult> =>
  new Promise((resolve, reject) => {
    let last: GuestWorktreesSnapshot | null = null;
    let settled = false;
    let release: (() => void) | null = null;
    const finish = (snapshot: GuestWorktreesSnapshot | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      release?.();
      resolve({ complete: snapshot?.state === 'ready', worktrees: snapshot?.worktrees ?? [] });
    };
    const timer = setTimeout(() => finish(last), timeoutMs);
    host.onWorktrees(projectId, (snapshot) => {
      last = snapshot;
      if (snapshot.state !== 'loading') finish(snapshot);
    }).then((stop) => {
      release = stop;
      if (settled) stop();
    }, (error: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
  });

export const projectForDirectory = (projects: readonly GuestProject[], directory: string | null) => {
  if (!directory) return null;
  const exact = projects.find((project) => project.directory === directory);
  if (exact) return exact;
  return projects
    .filter((project) => directory.startsWith(`${project.directory}/`))
    .sort((a, b) => b.directory.length - a.directory.length)[0] ?? null;
};

export const describeHostError = (error: unknown, language: Language = 'en') => {
  if (error instanceof HostRequestError) {
    switch (error.code) {
      case 'NOT_GRANTED': return translate(language, 'error.notGranted');
      case 'DISABLED': return translate(language, 'error.disabled');
      case 'HOST_UNAVAILABLE': return translate(language, 'error.hostUnavailable');
      case 'HOST_TIMEOUT': return translate(language, 'error.timeout');
      case 'NOT_FOUND': return translate(language, 'error.notFound');
      default: return `${error.code}: ${error.message}`;
    }
  }
  return error instanceof Error ? error.message : String(error);
};

/**
 * Why `startSession`'s `text` (the ticket's prompt) might not have
 * reached the agent as its first message, even though the session itself
 * was created successfully. `null` means it was sent — nothing to tell the
 * user. The description stays safe on the ticket either way; it's not lost,
 * only not delivered automatically.
 */
export const describeStartSessionDelivery = (sent: StartSessionSent, language: Language = 'en'): string | null => {
  switch (sent) {
    case 'sent': return null;
    case 'no-model': return translate(language, 'delivery.noModel');
    case 'skipped': return translate(language, 'delivery.skipped');
    case 'failed': return translate(language, 'delivery.failed');
  }
};
