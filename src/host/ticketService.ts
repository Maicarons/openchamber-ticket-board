import type { HostClient } from '@openchamber/sdk';
import { DEFAULT_TRIAGE_LABELS, parseTriageLabels, type TriageLabels } from '../domain/triageLabels.ts';
import { translate, type Language } from '../i18n.ts';

export type TicketServiceHost = Pick<HostClient, 'serviceRequest'>;

export type TicketFileData = { path: string; content: string; mtimeMs: number };

export type TicketBundle =
  | {
      state: 'ready';
      files: TicketFileData[];
      triageLabels: TriageLabels;
      triageLabelsSource: string | null;
      complete: boolean;
      warnings: string[];
    }
  | { state: 'unconfigured'; message: string }
  | { state: 'unavailable'; message: string };

export type TrackerInfo = {
  kind: 'local' | 'github' | 'gitlab' | 'none';
  configured: boolean;
  reason: string | null;
  remoteHost: string | null;
};

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

/** `serviceRequest` carries JSON as text in both directions. */
const parseBody = (body: string): Record<string, unknown> | null => {
  try {
    const parsed: unknown = JSON.parse(body);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const filesOf = (value: unknown): TicketFileData[] | null => {
  if (!Array.isArray(value)) return null;
  const files: TicketFileData[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const record = item as Record<string, unknown>;
    if (typeof record.path !== 'string' || typeof record.content !== 'string') return null;
    files.push({
      path: record.path,
      content: record.content,
      mtimeMs: typeof record.mtimeMs === 'number' ? record.mtimeMs : 0,
    });
  }
  return files;
};

const errorText = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
};

/**
 * Reads every markdown file under the project's `.scratch`. A service that is
 * not approved, not running, or not supported degrades to an explanatory
 * empty state — never a thrown error the board has to recover from.
 */
export const fetchTicketBundle = async (
  host: TicketServiceHost,
  directory: string,
  language: Language = 'en',
): Promise<TicketBundle> => {
  try {
    const result = await host.serviceRequest({ method: 'GET', path: '/tickets', query: { directory } });
    if (result.status !== 200) {
      return { state: 'unavailable', message: translate(language, 'service.answered', { status: result.status }) };
    }
    const record = parseBody(result.body);
    if (!record) return { state: 'unavailable', message: translate(language, 'service.unreadable') };
    if (record.configured !== true) {
      return { state: 'unconfigured', message: translate(language, 'service.noScratch') };
    }
    const files = filesOf(record.files);
    if (!files) return { state: 'unavailable', message: translate(language, 'service.malformed') };
    const rawLabels = typeof record.triageLabels === 'string' ? record.triageLabels : null;
    return {
      state: 'ready',
      files,
      triageLabels: parseTriageLabels(rawLabels) ?? DEFAULT_TRIAGE_LABELS,
      triageLabelsSource: rawLabels,
      complete: record.complete === true,
      warnings: stringArray(record.warnings),
    };
  } catch (error) {
    return {
      state: 'unavailable',
      message: translate(language, 'service.unavailable', { error: errorText(error) }),
    };
  }
};

export const fetchTrackerInfo = async (
  host: TicketServiceHost,
  directory: string,
  language: Language = 'en',
): Promise<TrackerInfo> => {
  try {
    const result = await host.serviceRequest({ method: 'GET', path: '/tracker', query: { directory } });
    if (result.status !== 200) {
      return { kind: 'none', configured: false, reason: translate(language, 'tracker.couldNotDetect'), remoteHost: null };
    }
    const record = parseBody(result.body);
    if (!record) {
      return { kind: 'none', configured: false, reason: translate(language, 'tracker.unreadable'), remoteHost: null };
    }
    const kind = record.kind === 'local' || record.kind === 'github' || record.kind === 'gitlab' ? record.kind : 'none';
    const remote = record.remote && typeof record.remote === 'object' && !Array.isArray(record.remote)
      ? (record.remote as Record<string, unknown>)
      : null;
    return {
      kind,
      configured: record.configured === true,
      reason: typeof record.reason === 'string' ? record.reason : null,
      remoteHost: typeof remote?.host === 'string' ? remote.host : null,
    };
  } catch (error) {
    return {
      kind: 'none',
      configured: false,
      reason: translate(language, 'service.unavailable', { error: errorText(error) }),
      remoteHost: null,
    };
  }
};

export type WriteResult = { ok: true } | { ok: false; conflict: boolean; message: string };

/**
 * Writes exactly the previewed bytes. The service compares `expected` with
 * what is on disk first; a 409 means somebody else changed the ticket and the
 * board must reload rather than overwrite them.
 */
export const writeTicketFile = async (
  host: TicketServiceHost,
  directory: string,
  path: string,
  content: string,
  expected: string,
  language: Language = 'en',
): Promise<WriteResult> => {
  try {
    const result = await host.serviceRequest({
      method: 'POST',
      path: '/ticket/write',
      body: JSON.stringify({ directory, path, content, expected }),
    });
    if (result.status === 200) return { ok: true };
    const body = parseBody(result.body);
    const localized =
      result.status === 409
        ? translate(language, 'write.conflict')
        : result.status === 404
          ? translate(language, 'write.notFound')
          : result.status === 413
            ? translate(language, 'write.tooLarge')
            : result.status === 400
              ? translate(language, 'write.badRequest')
              : translate(language, 'write.failed', { status: result.status });
    return {
      ok: false,
      conflict: result.status === 409,
      message: typeof body?.error === 'string' && result.status !== 400 ? body.error : localized,
    };
  } catch (error) {
    return {
      ok: false,
      conflict: false,
      message: translate(language, 'service.unavailable', { error: errorText(error) }),
    };
  }
};

export type CommitResult = { ok: true; commit: string } | { ok: false; message: string };

export const commitTicketFile = async (
  host: TicketServiceHost,
  directory: string,
  path: string,
  message: string,
  language: Language = 'en',
): Promise<CommitResult> => {
  try {
    const result = await host.serviceRequest({
      method: 'POST',
      path: '/ticket/commit',
      body: JSON.stringify({ directory, path, message }),
    });
    const body = parseBody(result.body);
    if (result.status === 200 && typeof body?.commit === 'string') return { ok: true, commit: body.commit };
    const localized =
      result.status === 409
        ? translate(language, 'commit.nothing')
        : result.status === 400
          ? translate(language, 'commit.badRequest')
          : translate(language, 'commit.failed', { status: result.status });
    return {
      ok: false,
      message: typeof body?.error === 'string' && result.status !== 400 ? body.error : localized,
    };
  } catch (error) {
    return {
      ok: false,
      message: translate(language, 'service.unavailable', { error: errorText(error) }),
    };
  }
};
