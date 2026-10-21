import type { HostClient, JsonValue } from '@openchamber/sdk';
import { ALL_FEATURES } from '../domain/ticketBoard.ts';
import { asLanguagePreference, type LanguagePreference } from '../i18n.ts';

type Storage = Pick<HostClient, 'storage'>;

export const PREFS_KEY = 'prefs';

export type Prefs = {
  projectId: string;
  feature: string;
  query: string;
  /** `auto` follows the locale OpenChamber reports; `en` and `zh` override it. */
  language: LanguagePreference;
  /** Ticket whose detail view was open when the user left the board (e.g. via Open Chat). */
  openTicketPath: string | null;
};

export const DEFAULT_PREFS: Prefs = {
  projectId: '',
  feature: ALL_FEATURES,
  query: '',
  language: 'auto',
  openTicketPath: null,
};

const str = (value: unknown, max: number) => (typeof value === 'string' && value.length <= max ? value : null);

export const parsePrefs = (value: unknown): Prefs => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_PREFS };
  const record = value as Record<string, unknown>;
  return {
    projectId: str(record.projectId, 512) ?? '',
    feature: str(record.feature, 500) ?? ALL_FEATURES,
    query: str(record.query, 200) ?? '',
    language: asLanguagePreference(record.language),
    openTicketPath: str(record.openTicketPath, 2048),
  };
};

export const loadPrefs = async (host: Storage) => parsePrefs(await host.storage.get(PREFS_KEY));

export const savePrefs = (host: Storage, prefs: Prefs) =>
  host.storage.set(PREFS_KEY, parsePrefs(prefs) as unknown as JsonValue);
