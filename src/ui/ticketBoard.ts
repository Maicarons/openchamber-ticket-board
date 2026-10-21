import type { GuestProject, GuestSessionWorktree, HostClient } from '@openchamber/sdk';
import { mountBanner, mountButton, mountSearchField, mountSelect, mountSpinner, mountTextField } from '@openchamber/sdk/ui';
import { ALL_FEATURES, boardTicketsFromFiles, columnOf, contextFiles, featureNames, filterBoardTickets, frontierPaths, groupBoardColumns, hasMap, hasSpec, mapFor, specFor, type BoardTicket } from '../domain/ticketBoard.ts';
import { TICKET_COLUMNS, ticketColumnLabel } from '../domain/ticketColumns.ts';
import { DEFAULT_TRIAGE_LABELS, statusForTriageRole } from '../domain/triageLabels.ts';
import { previewTicketEdits, type TicketEdit, type TicketEditPreview } from '../domain/ticketEdit.ts';
import { discoveredKey, orphanLinkKeys, ticketLinkKey, type TicketLink } from '../domain/ticketIndex.ts';
import { SETUP_PROMPT } from '../domain/ticketActions.ts';
import type { Ticket } from '../domain/ticket.ts';
import { asLanguagePreference, resolveLanguage, translator, type Language, type LanguagePreference } from '../i18n.ts';
import { deleteTicketLink, loadTicketLinks, saveTicketLink } from '../store/ticketStore.ts';
import { DEFAULT_PREFS, loadPrefs, savePrefs, type Prefs } from '../store/prefs.ts';
import { describeHostError, describeStartSessionDelivery, fetchSessions, fetchWorktrees, watchProjects } from '../host/workspace.ts';
import { fetchServiceBranches } from '../host/branchService.ts';
import { commitTicketFile, fetchTicketBundle, fetchTrackerInfo, writeTicketFile, type TicketBundle } from '../host/ticketService.ts';
import { createSessionSync } from '../host/sessionSync.ts';
import { createWorktreeSync } from '../host/worktreeSync.ts';
import { watchUnlinkedSessions } from '../host/orphanSessions.ts';
import { DEFAULT_ATTENTION_OPTIONS } from '../domain/sessionSignal.ts';
import type { SessionGoneReason } from '../domain/unlink.ts';
import { buildBaseBranchOptions, describeWorktreeOption, hasKnownBranches, resolveTicketWorktree } from '../domain/worktree.ts';
import { mountTicketDetail } from './ticketDetail.ts';
import { mountDiffDialog } from './diffDialog.ts';
import { injectStyles } from './styles.ts';
import { el } from './dom.ts';

export type BoardHost = Pick<
  HostClient,
  'storage' | 'onProjects' | 'onSessions' | 'onWorktrees' | 'openSession' | 'startSession' | 'serviceRequest' | 'toast' | 'setBadge'
>;

const EXTENSION_ID = 'kanban-board';

/** Commit messages are repository history, so they stay English regardless of the UI language. */
const COMMIT_ACTIONS = {
  move: 'move',
  fields: 'update fields of',
  blockedBy: 'set Blocked by for',
} as const;

/**
 * A stable, short id for the host's issue chip. Ticket paths and project ids
 * can be much longer than the host's id/URL limits, and they must not leak a
 * filesystem path into a session title. Two independent FNV-1a rounds keep the
 * chance of a collision negligible for one workspace.
 */
const stableRef = (value: string): string => {
  let a = 2166136261;
  let b = 5381;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    a = Math.imul(a ^ code, 16777619);
    b = Math.imul(b, 33) ^ code;
  }
  return `${(a >>> 0).toString(36).padStart(7, '0')}${(b >>> 0).toString(36).padStart(7, '0')}`;
};
const issueRef = (kind: string, value: string) => `${kind}-${stableRef(value)}`;
const ticketIssueId = (projectId: string, path: string) => issueRef('ticket', `${projectId}\u0000${path}`);
const ticketUrl = (projectId: string, path: string) => `https://kanban.local/tickets/${ticketIssueId(projectId, path)}`;
const linkId = (projectId: string, path: string) => `${projectId}\u0000${path}`;

type BoardState = {
  all: BoardTicket[];
  context: Ticket[];
  labels: typeof DEFAULT_TRIAGE_LABELS;
  complete: boolean;
  warnings: string[];
};

const emptyState = (): BoardState => ({ all: [], context: [], labels: DEFAULT_TRIAGE_LABELS, complete: true, warnings: [] });

export type BoardOptions = {
  /** OpenChamber's locale, used when the preference is `auto`. */
  locale: string;
  language: Language;
  languagePreference: LanguagePreference;
};

type BoardViewProps = {
  language: Language;
  languagePreference: LanguagePreference;
  onLanguageChange: (preference: LanguagePreference) => void;
};

/**
 * Changing the language remounts the view. That is deliberate: every control
 * was created with translated labels, and rebuilding the small board is safer
 * than trying to patch dozens of mounted widgets in place.
 */
export const mountTicketBoard = (host: BoardHost, root: Element, options: BoardOptions) => {
  let current: { dispose: () => void } | null = null;
  let disposed = false;
  const start = (languagePreference: LanguagePreference, language: Language) => {
    if (disposed) return;
    current?.dispose();
    current = mountBoardView(host, root, {
      language,
      languagePreference,
      onLanguageChange: (next) => start(next, resolveLanguage(next, options.locale)),
    });
  };
  start(options.languagePreference, options.language);
  return {
    dispose: () => {
      disposed = true;
      current?.dispose();
      current = null;
    },
  };
};

const mountBoardView = (host: BoardHost, root: Element, props: BoardViewProps) => {
  const t = translator(props.language);
  injectStyles();
  root.replaceChildren();

  const page = el('div', 'kb-page');
  root.append(page);
  const toolbar = el('div', 'kb-toolbar');
  page.append(toolbar);
  const projectWrap = el('div');
  const featureWrap = el('div');
  const searchWrap = el('div', 'grow');
  const languageWrap = el('div');
  toolbar.append(projectWrap, featureWrap, searchWrap, languageWrap);
  const refresh = mountButton(toolbar, { label: t('board.refresh'), variant: 'ghost', onClick: () => { void reload(); } });

  const bannerSlot = el('div');
  bannerSlot.hidden = true;
  page.append(bannerSlot);
  const banner = mountBanner(bannerSlot, { tone: 'error', title: '' });
  const showBanner = (title: string, body?: string, tone: 'error' | 'warning' | 'info' = 'error') => {
    bannerSlot.hidden = false;
    banner.update({ tone, title, body });
  };
  const clearBanner = () => { bannerSlot.hidden = true; };
  const notify = (error: unknown) => showBanner(t('board.somethingWrong'), describeHostError(error, props.language));

  const commitSlot = el('div', 'kb-commit-bar');
  commitSlot.hidden = true;
  page.append(commitSlot);
  let lastChange: { entry: BoardTicket; action: string } | null = null;
  const showCommit = (entry: BoardTicket, action: string) => {
    lastChange = { entry, action };
    commitSlot.hidden = false;
    commitSlot.replaceChildren();
    commitSlot.append(el('span', '', t('board.wrote', { path: entry.ticket.path })));
    mountButton(commitSlot, {
      label: t('board.commitThisChange'),
      size: 'sm',
      onClick: () => {
        void (async () => {
          if (!lastChange) return;
          const message = `tickets: ${lastChange.action} ${lastChange.entry.ticket.title}`.slice(0, 200);
          const result = await commitTicketFile(
            host,
            lastChange.entry.projectDirectory,
            lastChange.entry.ticket.path,
            message,
            props.language,
          );
          if (!result.ok) {
            showBanner(t('board.couldNotCommit'), result.message, 'warning');
            return;
          }
          commitSlot.hidden = true;
          lastChange = null;
          clearBanner();
          void host.toast({
            kind: 'info',
            message: t('board.committed', { subject: result.commit.split('\n')[0] ?? message }),
          }).catch(() => undefined);
        })();
      },
    });
    mountButton(commitSlot, {
      label: t('common.dismiss'),
      variant: 'ghost',
      size: 'sm',
      onClick: () => { commitSlot.hidden = true; lastChange = null; },
    });
  };

  const emptySlot = el('div');
  page.append(emptySlot);
  const columnsRoot = el('div', 'kb-columns');
  page.append(columnsRoot);
  const spinnerSlot = el('div');
  page.append(spinnerSlot);
  const footer = el('div', 'kb-row between kb-footer');
  page.append(footer);
  const queueNote = el('span', 'kb-muted', '');
  footer.append(queueNote);

  let projects: GuestProject[] = [];
  let prefs: Prefs = { ...DEFAULT_PREFS, language: props.languagePreference };
  let filter = { projectId: '', feature: ALL_FEATURES, query: '' };
  let state = emptyState();
  let links = new Map<string, TicketLink>();
  let detail: { dispose: () => void } | null = null;
  let diffDialog: { dispose: () => void } | null = null;
  let setupDialog: { dispose: () => void } | null = null;
  let draggingKey: string | null = null;
  let disposed = false;
  let loadGeneration = 0;
  let unlinkedSessions = new Map<string, { projectId: string; title: string }>();
  let startingAgents = 0;
  const attemptedSessions = new Set<string>();
  const lastAttention = new Map<string, boolean>();

  const projectName = (id: string) => projects.find((project) => project.id === id)?.name ?? id;
  const projectDirectory = (id: string) => projects.find((project) => project.id === id)?.directory ?? '';
  const linkOf = (entry: BoardTicket) => links.get(linkId(entry.projectId, entry.ticket.path)) ?? null;

  const allLinks = (): TicketLink[] => [...links.values()];
  const watched = () => allLinks().map((link) => ({
    id: linkId(link.projectId, link.path),
    projectId: link.projectId,
    sessionId: link.sessionId,
    worktree: link.worktree,
  }));

  const saveLink = async (link: TicketLink) => {
    await saveTicketLink(host, link);
    links.set(linkId(link.projectId, link.path), link);
    if (link.sessionId) unlinkedSessions.delete(link.sessionId);
  };

  const setEntries = (entries: BoardTicket[]) => {
    state = { ...state, all: entries };
    sessionSync.sync(watched());
    worktreeSync.sync(watched());
    render();
  };

  const persistOpen = (path: string | null): Promise<void> => {
    prefs = { ...prefs, openTicketPath: path };
    return savePrefs(host, prefs).catch(() => undefined);
  };

  const closeDetail = () => {
    detail?.dispose();
    detail = null;
    void persistOpen(null);
  };

  const reopen = async (path: string | null) => {
    await reload();
    if (path) openDetail(path);
  };

  const markReviewed = (entry: BoardTicket) => {
    const link = linkOf(entry);
    if (!link || link.needsAttentionSince === null) return;
    const updated = { ...link, needsAttentionSince: null, updatedAt: Date.now() } satisfies TicketLink;
    links.set(linkId(entry.projectId, entry.ticket.path), updated);
    setEntries(state.all);
    void saveTicketLink(host, updated).catch(notify);
  };

  // ----- writes: preview first, save second, never auto-commit -----
  const requestEdits = async (entry: BoardTicket, edits: TicketEdit[], action: string): Promise<void> => {
    const current = state.all.find((candidate) => candidate.projectId === entry.projectId && candidate.ticket.path === entry.ticket.path);
    if (!current) throw new Error(t('board.ticketGone'));
    const preview = previewTicketEdits(current.ticket, edits, props.language);
    if (!preview.changed) return;
    if (!current.projectDirectory) throw new Error(t('board.projectDirectoryUnknown'));

    await new Promise<void>((resolve) => {
      diffDialog?.dispose();
      diffDialog = mountDiffDialog(root, {
        title: t('board.writeTitle', { path: current.ticket.path }),
        summary: preview.summary,
        diff: preview.diff,
        language: props.language,
        onCancel: () => { diffDialog?.dispose(); diffDialog = null; resolve(); },
        onConfirm: async () => {
          const result = await writeTicketFile(
            host,
            current.projectDirectory,
            current.ticket.path,
            preview.after,
            preview.before,
            props.language,
          );
          if (!result.ok) {
            if (result.conflict) {
              diffDialog?.dispose();
              diffDialog = null;
              showBanner(t('board.changedOnDiskTitle'), t('board.changedOnDiskBody'), 'warning');
              await reopen(prefs.openTicketPath);
            }
            throw new Error(result.message);
          }
          diffDialog?.dispose();
          diffDialog = null;
          showCommit(current, action);
          clearBanner();
          await reload();
          resolve();
        },
      });
    });
  };

  const applyStatus = async (entry: BoardTicket, status: string, action: string) => {
    await requestEdits(entry, [{ kind: 'status', status }], action);
  };

  // ----- session watchers: attention and link health only, never ticket Status -----
  const applyAttention = (id: string, needsAttention: boolean) => {
    const link = links.get(id);
    if (!link) return;
    if (Boolean(link.needsAttentionSince) === needsAttention) return;
    if (lastAttention.get(id) === needsAttention) return;
    lastAttention.set(id, needsAttention);
    const updated = { ...link, needsAttentionSince: needsAttention ? Date.now() : null, updatedAt: Date.now() } satisfies TicketLink;
    links.set(id, updated);
    setEntries(state.all);
    void saveTicketLink(host, updated).catch((error) => { notify(error); void reload(); });
  };

  const clearLink = (id: string, patch: Partial<TicketLink>, message: string | null) => {
    const link = links.get(id);
    if (!link) return;
    const updated = { ...link, ...patch, updatedAt: Date.now() } satisfies TicketLink;
    links.set(id, updated);
    setEntries(state.all);
    void saveTicketLink(host, updated)
      .then(() => { if (message) void host.toast({ kind: 'info', message }).catch(() => undefined); })
      .catch((error) => { notify(error); void reload(); });
  };

  const forgetLink = (id: string, message: string | null) => {
    const link = links.get(id);
    if (!link) return;
    links.delete(id);
    setEntries(state.all);
    void deleteTicketLink(host, link.projectId, link.path)
      .then(() => { if (message) void host.toast({ kind: 'info', message }).catch(() => undefined); })
      .catch((error) => { notify(error); void reload(); });
  };

  const sessionSync = createSessionSync(host, DEFAULT_ATTENTION_OPTIONS, applyAttention, (id, sessionId, reason: SessionGoneReason) => {
    const link = links.get(id);
    if (!link || link.sessionId !== sessionId) return;
    if (reason === 'deleted') {
      forgetLink(id, t('board.unlinkedDeleted'));
    } else {
      clearLink(id, { sessionId: null }, t('board.unlinkedArchived'));
    }
  });

  const worktreeSync = createWorktreeSync(host, (id) => {
    const link = links.get(id);
    if (!link || !link.worktree) return;
    clearLink(id, { worktree: null }, t('board.worktreeDeleted'));
  });

  let unlinkedWatcher: { dispose: () => void } | null = null;

  // ----- project and feature controls -----
  const projectOptions = () => projects.map((project) => ({ id: project.id, label: project.name }));
  const projectSelect = mountSelect(projectWrap, {
    label: t('board.project'), value: null, options: [], searchable: projects.length > 6,
    onChange: (value) => {
      filter = { ...filter, projectId: value, feature: ALL_FEATURES };
      projectSelect.update({ value });
      prefs = { ...prefs, projectId: value, feature: ALL_FEATURES };
      void savePrefs(host, prefs).then(() => reload()).catch(() => undefined);
    },
  });

  const featureOptions = () => [
    { id: ALL_FEATURES, label: t('board.allFeatures') },
    ...featureNames(state.all, state.context).map((feature) => ({ id: feature, label: feature })),
  ];
  const featureSelect = mountSelect(featureWrap, {
    label: t('board.feature'), value: ALL_FEATURES, options: featureOptions(),
    onChange: (value) => {
      filter = { ...filter, feature: value };
      featureSelect.update({ value });
      prefs = { ...prefs, feature: value };
      void savePrefs(host, prefs).catch(() => undefined);
      render();
    },
  });

  const searchField = mountSearchField(searchWrap, {
    value: '', placeholder: t('board.searchPlaceholder'),
    onChange: (value) => {
      filter = { ...filter, query: value };
      searchField.update({ value });
      prefs = { ...prefs, query: value };
      void savePrefs(host, prefs).catch(() => undefined);
      render();
    },
  });

  const languageSelect = mountSelect(languageWrap, {
    label: t('common.language'),
    value: props.languagePreference,
    options: [
      { id: 'auto', label: t('common.language.auto') },
      { id: 'en', label: t('common.language.en') },
      { id: 'zh', label: t('common.language.zh') },
    ],
    onChange: (value) => {
      const preference = asLanguagePreference(value);
      if (preference === prefs.language) return;
      const previous = prefs.language;
      prefs = { ...prefs, language: preference };
      languageSelect.update({ value: preference });
      void savePrefs(host, prefs)
        .then(() => props.onLanguageChange(preference))
        .catch((error) => {
          prefs = { ...prefs, language: previous };
          languageSelect.update({ value: previous });
          notify(error);
        });
    },
  });

  // ----- detail -----
  const openDetail = (path: string) => {
    const entry = state.all.find((candidate) => candidate.projectId === filter.projectId && candidate.ticket.path === path)
      ?? state.all.find((candidate) => candidate.ticket.path === path);
    if (!entry) return;
    markReviewed(entry);
    const siblings = state.all.filter((candidate) => candidate.projectId === entry.projectId && candidate.ticket.feature === entry.ticket.feature);
    const ticket = entry.ticket;
    detail?.dispose();
    void persistOpen(ticket.path);
    detail = mountTicketDetail(root, {
      entry,
      language: props.language,
      labels: state.labels,
      feature: ticket.feature,
      hasSpec: hasSpec(state.context, ticket.feature),
      hasMap: hasMap(state.context, ticket.feature),
      specPath: specFor(state.context, ticket.feature)?.path ?? null,
      mapPath: mapFor(state.context, ticket.feature)?.path ?? null,
      siblings,
      projectName: projectName(entry.projectId),
      onClose: closeDetail,
      onEdit: async (edits) => {
        const editPath = ticket.path;
        const action = edits.length > 1
          ? COMMIT_ACTIONS.fields
          : edits[0]?.kind === 'status'
            ? COMMIT_ACTIONS.move
            : COMMIT_ACTIONS.blockedBy;
        await requestEdits(entry, edits, action);
        openDetail(editPath);
      },
      onOpenChat: async (sessionId) => {
        await persistOpen(null);
        await host.openSession(sessionId);
        closeDetail();
      },
      onLinkSession: async (sessionId, projectId) => {
        attemptedSessions.add(sessionId);
        await saveLink({
          schemaVersion: 1,
          projectId,
          path: ticket.path,
          sessionId,
          worktree: null,
          sourceBranch: null,
          needsAttentionSince: null,
          updatedAt: Date.now(),
        });
        await reopen(ticket.path);
      },
      onUnlinkSession: async () => {
        const current = links.get(linkId(entry.projectId, ticket.path));
        if (!current) return;
        // Keep the ticket's index record (and any worktree history) while
        // detaching the session. The link disappears only on an orphan sweep.
        await saveLink({
          ...current,
          sessionId: null,
          worktree: null,
          sourceBranch: null,
          needsAttentionSince: null,
          updatedAt: Date.now(),
        });
        await reopen(ticket.path);
      },
      onStartAgent: async ({ prompt, worktree, title }) => {
        await startAgent(entry, prompt, worktree, title);
      },
      loadSessionsForProject: async (projectId) => {
        const result = await fetchSessions(host, projectId);
        return result.sessions.map((session) => ({ id: session.id, title: session.title, activity: session.activity }));
      },
      loadWorktreeInfo: async (projectId) => {
        const result = await fetchWorktrees(host, projectId);
        const directory = projectDirectory(projectId);
        const serviceBranches = directory ? await fetchServiceBranches(host, directory, props.language) : null;
        return {
          destinations: result.worktrees.map(describeWorktreeOption),
          baseBranches: serviceBranches ?? buildBaseBranchOptions(result.worktrees, props.language),
          hasKnownBranches: serviceBranches ? serviceBranches.length > 2 : hasKnownBranches(result.worktrees),
        };
      },
    });
  };

  const startAgent = async (
    entry: BoardTicket,
    prompt: string,
    worktree: GuestSessionWorktree,
    title: string,
  ) => {
    startingAgents += 1;
    try {
      const result = await host.startSession({
        providerId: EXTENSION_ID,
        id: ticketIssueId(entry.projectId, entry.ticket.path),
        title,
        url: ticketUrl(entry.projectId, entry.ticket.path),
        text: prompt.trim(),
        projectId: entry.projectId,
        worktree,
        navigation: 'preserve',
      });
      if (result.sessionId === null) {
        throw new Error(t('board.startFailed', { failure: result.failure, directory: result.directory }));
      }
      attemptedSessions.add(result.sessionId);
      await saveLink({
        schemaVersion: 1,
        projectId: entry.projectId,
        path: entry.ticket.path,
        sessionId: result.sessionId,
        worktree: resolveTicketWorktree(worktree, result),
        sourceBranch: null,
        needsAttentionSince: null,
        updatedAt: Date.now(),
      });
      await persistOpen(null);
      closeDetail();
      setEntries(state.all);
      const deliveryIssue = describeStartSessionDelivery(result.sent, props.language);
      if (deliveryIssue) {
        void host.toast({
          kind: 'error',
          message: t('board.deliveryIssue', { issue: deliveryIssue }),
        }).catch(() => undefined);
      }
      await host.openSession(result.sessionId);
    } finally {
      startingAgents -= 1;
    }
  };

  // ----- setup: never modify the user's repo from the board -----
  const openSetup = (initialPrompt = SETUP_PROMPT) => {
    setupDialog?.dispose();
    const overlay = el('div', 'kb-overlay');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    const dialog = el('div', 'kb-dialog');
    overlay.append(dialog);
    root.append(overlay);
    const close = () => { overlay.remove(); setupDialog = null; };
    overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });

    dialog.append(el('h2', '', t('board.setupTitle')));
    dialog.append(el('p', 'kb-muted', t('board.setupBody')));
    let projectId = filter.projectId || projects[0]?.id || '';
    const projectField = mountSelect(dialog, {
      label: t('board.project'), value: projectId || null, options: projectOptions(), searchable: projects.length > 6,
      onChange: (value) => { projectId = value; projectField.update({ value }); },
    });
    let prompt = initialPrompt;
    const promptField = mountTextField(dialog, {
      label: t('board.setupPrompt'), value: prompt, multiline: true, rows: 5,
      onChange: (value) => { prompt = value; promptField.update({ value }); },
    });
    const row = el('div', 'kb-row between');
    dialog.append(row);
    mountButton(row, { label: t('common.cancel'), variant: 'outline', onClick: close });
    mountButton(row, {
      label: t('board.startSetup'),
      disabled: !projectId,
      onClick: () => {
        void (async () => {
          try {
            const result = await host.startSession({
              providerId: EXTENSION_ID,
              id: issueRef('setup', projectId),
              title: t('board.setupSessionTitle'),
              url: `https://kanban.local/setup/${issueRef('setup', projectId)}`,
              text: prompt,
              projectId,
              navigation: 'preserve',
            });
            if (result.sessionId === null) throw new Error(t('board.setupStartFailed', { failure: result.failure }));
            close();
            await host.openSession(result.sessionId);
          } catch (error) { notify(error); }
        })();
      },
    });
    setupDialog = { dispose: close };
  };

  /** A setup session has no ticket yet; it is deliberately left unlinked. */

  const openUnlinked = () => {
    if (unlinkedSessions.size === 0) return;
    const overlay = el('div', 'kb-overlay');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    const dialog = el('div', 'kb-dialog');
    overlay.append(dialog);
    const close = () => overlay.remove();
    overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
    dialog.append(el('h2', '', t('board.unlinkedSessionsTitle')));
    dialog.append(el('p', 'kb-muted', t('board.unlinkedSessionsBody')));
    for (const [id, session] of unlinkedSessions) {
      const row = el('div', 'kb-row between kb-unlinked-row');
      row.append(el('span', '', session.title), el('span', 'kb-mono', projectName(session.projectId)));
      mountButton(row, { label: t('common.openChat'), size: 'sm', onClick: () => { close(); void host.openSession(id).catch(notify); } });
      dialog.append(row);
    }
    closeButton(dialog, t('common.close'), close);
    root.append(overlay);
  };

  const closeButton = (parent: Element, label: string, onClick: () => void) => mountButton(parent, { label, variant: 'outline', onClick });

  // ----- board rendering -----
  const renderCard = (entry: BoardTicket, frontier: boolean) => {
    const link = linkOf(entry);
    const card = el('div', `kb-card${link?.needsAttentionSince ? ' kb-card-needs-attention' : ''}`);
    card.draggable = true;
    card.dataset.key = linkId(entry.projectId, entry.ticket.path);
    card.dataset.path = entry.ticket.path;

    const titleRow = el('div', 'kb-row between');
    const titleWrap = el('div', 'kb-card-title-wrap');
    if (frontier) titleWrap.append(el('span', 'kb-next', t('board.next')));
    titleWrap.append(el('div', 'kb-card-title', entry.ticket.title));
    titleRow.append(titleWrap);
    if (entry.ticket.number) titleRow.append(el('span', 'kb-card-number', `#${entry.ticket.number}`));
    card.append(titleRow);

    const meta = el('div', 'kb-card-meta');
    if (entry.ticket.type) meta.append(el('span', 'kb-badge', entry.ticket.type));
    if (entry.ticket.status) meta.append(el('span', 'kb-muted', entry.ticket.status));
    if (link?.sessionId) meta.append(el('span', 'kb-mono', t('board.sessionTag', { id: link.sessionId.slice(0, 8) })));
    if (entry.ticket.blockedBy.length) {
      meta.append(el('span', 'kb-muted', t('board.blockedBy', {
        refs: entry.ticket.blockedBy.map((ref) => `#${ref.number}`).join(', '),
      })));
    }
    card.append(meta);

    if (link?.needsAttentionSince) card.append(el('p', 'kb-card-attention', t('board.attention')));
    if (entry.ticket.conflicts.length) card.append(el('p', 'kb-card-conflict', entry.ticket.conflicts.join(' · ')));

    card.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).closest('button')) return;
      openDetail(entry.ticket.path);
    });
    if (link?.sessionId) {
      const chat = mountButton(card, {
        label: t('common.chat'), variant: 'ghost', size: 'xs',
        onClick: () => {
          markReviewed(entry);
          void host.openSession(link.sessionId!).catch(notify);
        },
      });
      void chat;
    }

    card.addEventListener('dragstart', (event) => {
      draggingKey = card.dataset.key ?? null;
      card.classList.add('kb-dragging');
      event.dataTransfer?.setData('text/plain', card.dataset.key ?? '');
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => { draggingKey = null; card.classList.remove('kb-dragging'); });
    return card;
  };

  const render = () => {
    columnsRoot.replaceChildren();
    emptySlot.replaceChildren();
    const visible = filterBoardTickets(state.all, filter);
    updateBadge();
    const frontierScope = filterBoardTickets(state.all, { ...filter, query: '' });
    const frontier = frontierPaths(frontierScope, state.labels);
    const columns = groupBoardColumns(visible, state.labels);
    for (const column of TICKET_COLUMNS) {
      const node = el('div', 'kb-column');
      node.dataset.column = column;
      const head = el('div', 'kb-column-head');
      head.append(el('span', 'kb-column-title', ticketColumnLabel(column, props.language)));
      head.append(el('span', 'kb-column-count', String(columns[column].length)));
      const body = el('div', 'kb-column-body');
      node.append(head, body);
      if (columns[column].length === 0) {
        body.append(el('div', 'kb-column-empty', column === 'ready' ? t('board.noTicketReady') : t('board.nothingHere')));
      }
      for (const entry of columns[column]) body.append(renderCard(entry, frontier.has(entry.ticket.path)));
      wireDropZone(node, body, column, () => columns[column]);
      columnsRoot.append(node);
    }
    const ready = frontier.size;
    const ticketWord = t(visible.length === 1 ? 'common.ticket.one' : 'common.ticket.many');
    const sessionWord = t(unlinkedSessions.size === 1 ? 'common.session.one' : 'common.session.many');
    queueNote.textContent = t('board.queue', { shown: visible.length, tickets: ticketWord, ready })
      + (unlinkedSessions.size ? t('board.unlinkedSuffix', { count: unlinkedSessions.size, sessions: sessionWord }) : '');
    if (state.all.length === 0) {
      emptySlot.append(buildEmptyState());
    }
  };

  const buildEmptyState = () => {
    const wrap = el('div', 'kb-empty-state');
    wrap.append(el('h2', '', t('board.noTickets')));
    const spec = state.context.find((ticket) => ticket.kind === 'spec' && /(^|\/)spec\.md$/i.test(ticket.path));
    if (spec) {
      wrap.append(el('p', '', t('board.specNoIssues')));
      const prompt = `/to-tickets ${spec.path}\n\nFeature: ${spec.feature}\nSpec: ${spec.path}`;
      mountButton(wrap, { label: t('board.breakSpec'), variant: 'secondary', onClick: () => openSetup(prompt) });
    } else {
      wrap.append(el('p', '', t('board.scratchNoSpec')));
      mountButton(wrap, { label: t('board.setupWorkflow'), onClick: () => openSetup() });
    }
    return wrap;
  };

  const updateBadge = () => {
    const open = state.all.filter((entry) => columnOf(entry, state.all, state.labels) !== 'done').length;
    void host.setBadge(open || null).catch(() => undefined);
  };

  const wireDropZone = (column: HTMLElement, body: HTMLElement, target: (typeof TICKET_COLUMNS)[number], visible: () => BoardTicket[]) => {
    const clearDrop = () => column.classList.remove('kb-dragover', 'kb-dragover-blocked');
    column.addEventListener('dragover', (event) => {
      if (!draggingKey) return;
      // Blocked still accepts the gesture so the refusal can explain itself.
      event.preventDefault();
      column.classList.toggle('kb-dragover', target !== 'blocked');
      column.classList.toggle('kb-dragover-blocked', target === 'blocked');
    });
    column.addEventListener('dragleave', (event) => { if (event.target === column) clearDrop(); });
    column.addEventListener('drop', (event) => {
      event.preventDefault();
      clearDrop();
      const key = draggingKey;
      draggingKey = null;
      if (!key) return;
      const entry = visible().find((candidate) => linkId(candidate.projectId, candidate.ticket.path) === key)
        ?? state.all.find((candidate) => linkId(candidate.projectId, candidate.ticket.path) === key);
      if (!entry) return;
      const destination = target;
      if (destination === 'blocked') {
        showBanner(t('board.blockedDerivedTitle'), t('board.blockedDerivedBody'), 'info');
        return;
      }
      const status = destination === 'done' ? 'resolved'
        : destination === 'triage' ? statusForTriageRole('needs-triage', state.labels)
          : destination === 'needs-info' ? statusForTriageRole('needs-info', state.labels)
            : destination === 'ready' ? statusForTriageRole('ready-for-agent', state.labels)
              : statusForTriageRole('ready-for-human', state.labels);
      if (entry.ticket.status === status) return;
      void applyStatus(entry, status, COMMIT_ACTIONS.move).catch(notify);
    });
  };

  // ----- load -----
  const reconcileLinks = async (loaded: TicketLink[], entries: BoardTicket[], complete: boolean) => {
    const discovered = new Set(entries.map((entry) => discoveredKey(entry.projectId, entry.ticket.path)));
    const selections = loaded.filter((link) => link.projectId === filter.projectId);
    const orphanKeys = orphanLinkKeys(selections, discovered, complete);
    if (!orphanKeys.length) return;
    for (const orphan of selections.filter((link) => orphanKeys.includes(ticketLinkKey(link.projectId, link.path)))) {
      links.delete(linkId(orphan.projectId, orphan.path));
      await deleteTicketLink(host, orphan.projectId, orphan.path).catch(() => undefined);
    }
  };

  const readProject = async (directory: string): Promise<TicketBundle> =>
    fetchTicketBundle(host, directory, props.language);

  const reload = async () => {
    const generation = ++loadGeneration;
    refresh.update({ loading: true });
    try {
      const [loadedPrefs, index] = await Promise.all([loadPrefs(host), loadTicketLinks(host)]);
      if (generation !== loadGeneration) return;
      prefs = loadedPrefs;
      if (prefs.language !== props.languagePreference) {
        // Another tab changed the stored preference. Rebuild once with the new language.
        props.onLanguageChange(prefs.language);
        return;
      }
      languageSelect.update({ value: prefs.language });
      links = new Map(index.links.map((link) => [linkId(link.projectId, link.path), link]));
      if (index.failedKeys.length) {
        showBanner(
          t('board.someLinksFailedTitle'),
          t('board.someLinksFailedBody', { count: index.failedKeys.length }),
          'warning',
        );
      }

      if (!projects.length) {
        state = emptyState();
        renderEmpty(t('board.chooseProjectTitle'), t('board.chooseProjectBody'));
        return;
      }
      const validProject = projects.some((project) => project.id === prefs.projectId) ? prefs.projectId : projects[0]!.id;
      filter = { projectId: validProject, feature: prefs.feature, query: prefs.query };
      prefs = { ...prefs, projectId: validProject };
      projectSelect.update({ value: validProject, options: projectOptions() });
      searchField.update({ value: prefs.query });
      const directory = projectDirectory(validProject);
      if (!directory) {
        renderEmpty(t('board.projectDirectoryTitle'), t('board.projectDirectoryBody'));
        return;
      }

      const tracker = await fetchTrackerInfo(host, directory, props.language);
      if (tracker.kind === 'github' || tracker.kind === 'gitlab') {
        state = emptyState();
        updateBadge();
        const wrap = el('div', 'kb-empty-state');
        wrap.append(el('h2', '', t('board.remoteTrackerTitle')));
        wrap.append(el('p', '', t('board.remoteTrackerBody', {
          kind: tracker.kind === 'github' ? 'GitHub' : 'GitLab',
        })));
        mountButton(wrap, { label: t('board.setUpLocalTickets'), variant: 'secondary', onClick: openSetup });
        emptySlot.replaceChildren(wrap);
        columnsRoot.replaceChildren();
        featureSelect.update({ value: ALL_FEATURES, options: featureOptions() });
        queueNote.textContent = '';
        return;
      }

      const bundle = await readProject(directory);
      if (generation !== loadGeneration) return;
      if (bundle.state === 'unavailable') {
        state = emptyState();
        renderEmpty(t('board.serviceUnavailableTitle'), bundle.message);
        showBanner(t('board.serviceUnavailableTitle'), t('board.serviceUnavailableBody'), 'warning');
        return;
      }
      if (bundle.state === 'unconfigured') {
        state = emptyState();
        updateBadge();
        const wrap = el('div', 'kb-empty-state');
        wrap.append(el('h2', '', t('board.noWorkflowTitle')));
        wrap.append(el('p', '', t('board.noWorkflowBody')));
        mountButton(wrap, { label: t('board.setupWorkflow'), onClick: openSetup });
        emptySlot.replaceChildren(wrap);
        columnsRoot.replaceChildren();
        queueNote.textContent = '';
        featureSelect.update({ value: ALL_FEATURES, options: featureOptions() });
        return;
      }

      const context = contextFiles(bundle.files, bundle.triageLabels, props.language);
      const entries = boardTicketsFromFiles(bundle.files, validProject, directory, new Map(index.links.filter((link) => link.projectId === validProject).map((link) => [link.path, link])), bundle.triageLabels, props.language);
      const availableFeatures = featureNames(entries, context);
      const feature = prefs.feature === ALL_FEATURES || availableFeatures.includes(prefs.feature) ? prefs.feature : ALL_FEATURES;
      filter = { ...filter, feature };
      prefs = { ...prefs, feature };
      state = {
        all: entries,
        context,
        labels: bundle.triageLabels,
        complete: bundle.complete,
        warnings: bundle.warnings,
      };
      await reconcileLinks(index.links, entries, bundle.complete);
      featureSelect.update({ value: feature, options: featureOptions() });
      if (bundle.warnings.length) showBanner(t('board.someFilesSkipped'), bundle.warnings.join(' · '), 'warning');
      render();
      if (prefs.openTicketPath && entries.some((entry) => entry.ticket.path === prefs.openTicketPath)) openDetail(prefs.openTicketPath);
    } catch (error) {
      state = emptyState();
      renderEmpty(t('board.couldNotLoad'), describeHostError(error, props.language));
      notify(error);
    } finally {
      refresh.update({ loading: false });
    }
  };

  const renderEmpty = (title: string, body: string) => {
    columnsRoot.replaceChildren();
    const wrap = el('div', 'kb-empty-state');
    wrap.append(el('h2', '', title), el('p', '', body));
    mountButton(wrap, { label: t('common.refresh'), variant: 'secondary', onClick: () => { void reload(); } });
    emptySlot.replaceChildren(wrap);
    queueNote.textContent = '';
  };

  let stopProjects: (() => void) | null = null;
  void watchProjects(host, (snapshot) => {
    if (disposed) return;
    if (snapshot.state === 'error') {
      showBanner(t('board.projectsUnavailableTitle'), t('board.projectsUnavailableBody'), 'warning');
      return;
    }
    const before = projects.map((project) => project.id).join(',');
    projects = snapshot.projects;
    projectSelect.update({ options: projectOptions() });
    const after = projects.map((project) => project.id).join(',');
    if (before !== after && projects.length) void reload();
    else render();
  }).then((stop) => { if (disposed) stop(); else stopProjects = stop; }, (error) => { if (!disposed) notify(error); });

  const spinner = mountSpinner(spinnerSlot, { label: t('board.loadingTickets') });
  void reload().finally(() => {
    spinner.dispose();
    spinnerSlot.hidden = true;
    if (disposed) return;
    unlinkedWatcher = watchUnlinkedSessions(host, () => new Set([
      ...attemptedSessions,
      ...allLinks().flatMap((link) => link.sessionId ? [link.sessionId] : []),
    ]), (found) => {
      if (startingAgents > 0) return;
      if (!unlinkedSessions.has(found.session.id)) {
        unlinkedSessions.set(found.session.id, { projectId: found.projectId, title: found.session.title });
        render();
      }
    }, DEFAULT_ATTENTION_OPTIONS);
  });

  const footerActions = el('div', 'kb-row');
  footer.append(footerActions);
  mountButton(footerActions, { label: t('board.unlinkedSessions'), variant: 'ghost', size: 'sm', onClick: openUnlinked });
  mountButton(footerActions, { label: t('board.setUpTickets'), variant: 'ghost', size: 'sm', onClick: openSetup });

  return {
    dispose: () => {
      disposed = true;
      stopProjects?.();
      sessionSync.dispose();
      worktreeSync.dispose();
      unlinkedWatcher?.dispose();
      detail?.dispose();
      diffDialog?.dispose();
      setupDialog?.dispose();
    },
  };
};
