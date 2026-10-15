import type { GuestProject, HostClient } from '@openchamber/sdk';
import { mountBanner, mountButton, mountSearchField, mountSelect, mountSpinner, mountTextField } from '@openchamber/sdk/ui';
import { applyPatch, createTask, STATUSES, STATUS_LABELS, type Task, type TaskStatus } from '../domain/task.ts';
import { ALL_PROJECTS, NO_PROJECT, groupColumns, planDrop, rankAtEnd, type BoardFilter } from '../domain/board.ts';
import { deleteTask, loadTasks, saveTask } from '../store/taskStore.ts';
import { loadPrefs, savePrefs, type Prefs } from '../store/prefs.ts';
import { loadOrphanWatermark, saveOrphanWatermark } from '../store/orphanWatermark.ts';
import { describeHostError, fetchSessions, fetchWorktrees, watchProjects } from '../host/workspace.ts';
import { fetchServiceBranches } from '../host/branchService.ts';
import { createSessionSync } from '../host/sessionSync.ts';
import { watchOrphanSessions } from '../host/orphanSessions.ts';
import { DEFAULT_SYNC_OPTIONS } from '../domain/sync.ts';
import { titleForOrphanSession } from '../domain/autoTask.ts';
import { buildBaseBranchOptions, describeWorktreeOption, hasKnownBranches, resolveTaskWorktree } from '../domain/worktree.ts';
import { mountTaskDetail } from './detail.ts';
import { injectStyles } from './styles.ts';
import { insertionTarget } from './dnd.ts';
import { el } from './dom.ts';

export type BoardHost = Pick<
  HostClient,
  'storage' | 'onProjects' | 'onSessions' | 'onWorktrees' | 'openSession' | 'startSession' | 'serviceRequest' | 'toast' | 'setBadge'
>;

/**
 * Agent state drives task status, one direction only: the agent working
 * moves a task to In Progress, and the agent finishing, asking a question,
 * hitting a permission prompt, or failing moves it to Review — never to
 * Done. A task the user marked Done stays there regardless of what its
 * session does afterwards; only the user's own Mark Done ever sets it.
 */
const SYNC_OPTIONS = DEFAULT_SYNC_OPTIONS;

const EXTENSION_ID = 'kanban-board';
/** Never dereferenced by the host; only shown as this task's chip link. */
const taskUrl = (id: string) => `https://kanban.local/tasks/${id}`;

export const mountKanbanBoard = (host: BoardHost, root: Element) => {
  injectStyles();
  root.replaceChildren();

  const page = el('div', 'kb-page');
  root.append(page);

  const toolbar = el('div', 'kb-toolbar'); page.append(toolbar);
  const projectSelectWrap = el('div'); toolbar.append(projectSelectWrap);
  const searchWrap = el('div', 'grow'); toolbar.append(searchWrap);
  const refresh = mountButton(toolbar, { label: 'Refresh', variant: 'ghost', onClick: () => { void reload(); } });

  const addRow = el('div', 'kb-row'); page.append(addRow);
  const titleWrap = el('div', 'grow kb-add-task'); addRow.append(titleWrap);
  let newTitle = '';
  const newField = mountTextField(titleWrap, {
    label: 'New task', value: '', placeholder: 'What needs doing?',
    onChange: (value) => { newTitle = value; newField.update({ value }); },
  });
  const bannerSlot = el('div'); page.append(bannerSlot);
  bannerSlot.hidden = true;
  const banner = mountBanner(bannerSlot, { tone: 'error', title: '' });
  const showBanner = (title: string, body?: string, tone: 'error' | 'warning' | 'info' = 'error') => {
    bannerSlot.hidden = false; banner.update({ tone, title, body });
  };
  const clearBanner = () => { bannerSlot.hidden = true; };
  const notify = (error: unknown) => showBanner('Something went wrong', describeHostError(error));

  const add = mountButton(addRow, {
    label: 'Add task',
    onClick: () => {
      void (async () => {
        try {
          const column = filter.projectId === ALL_PROJECTS || filter.projectId === NO_PROJECT ? 'backlog' : 'backlog';
          const task = createTask(
            { title: newTitle, projectId: filter.projectId === ALL_PROJECTS || filter.projectId === NO_PROJECT ? null : filter.projectId },
            rankAtEnd(tasks, column as TaskStatus),
          );
          add.update({ loading: true });
          await saveTask(host, task);
          setTasks([...tasks, task]);
          newTitle = ''; newField.update({ value: '' });
          clearBanner();
          render();
          openDetail(task.id);
        } catch (error) { notify(error); }
        finally { add.update({ loading: false }); }
      })();
    },
  });

  const columnsRoot = el('div', 'kb-columns'); page.append(columnsRoot);
  const spinnerSlot = el('div'); page.append(spinnerSlot);

  let tasks: Task[] = [];
  let projects: GuestProject[] = [];
  let prefs: Prefs = { projectId: ALL_PROJECTS, query: '', openTaskId: null };
  let filter: BoardFilter = { projectId: ALL_PROJECTS, query: '' };
  let detail: { dispose: () => void } | null = null;
  let draggingId: string | null = null;
  let disposed = false;
  let leavingForChat = false;

  /** The one place `tasks` changes, so the session-status watcher always sees the current set. */
  const setTasks = (next: Task[]) => {
    tasks = next;
    sessionSync.sync(tasks);
  };

  /**
   * The status this mount last attempted to write for a task via the live
   * sync, whether it succeeded or not. A session's `onSessions` snapshot
   * fires continuously while it runs, so without this a single persistent
   * save failure would retry the identical write (and re-show the error)
   * on every tick. Only a genuinely different target status — the agent
   * moving to a new activity — is allowed to try again.
   */
  let lastAttemptedStatus = new Map<string, TaskStatus>();

  const applyAgentStatusChange = (taskId: string, next: TaskStatus) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === next) return;
    if (lastAttemptedStatus.get(taskId) === next) return;
    lastAttemptedStatus.set(taskId, next);
    // Landing in Review this way is a change you didn't make yourself, so it's flagged until you look at it.
    // Moving anywhere else (e.g. back to In Progress) clears a stale flag that's no longer about this status.
    const updated = applyPatch(task, { status: next, needsAttentionSince: next === 'review' ? Date.now() : null });
    setTasks(tasks.map((t) => (t.id === taskId ? updated : t)));
    render();
    void saveTask(host, updated).catch((error) => { notify(error); void reload(); });
  };

  const sessionSync = createSessionSync(host, SYNC_OPTIONS, applyAgentStatusChange);

  const linkedSessionIds = () => new Set(tasks.filter((t) => t.sessionId).map((t) => t.sessionId as string));
  /**
   * Every session id this mount has ever tried to adopt, success or
   * failure. A live session's `onSessions` snapshot fires continuously
   * while it runs, so this must be a permanent-for-this-mount guard, not
   * cleared on failure — otherwise a single persistent storage error turns
   * into a retry-and-error-toast storm on every snapshot tick. A fresh
   * `Refresh`/reopen gets a clean slate via `reload()` below.
   */
  let attemptedSessions = new Set<string>();

  /**
   * Retries a critical link-save a few times before giving up. Used only
   * right after a real session has already been created (`startSession`
   * succeeded) or an existing one deliberately linked — at that point a
   * transient storage failure (the kind that produced "HOST_REJECTED" once
   * before) must not silently lose the link, since the session is already
   * real, already possibly running, and already claimed in
   * `attemptedSessions` so the orphan watcher won't duplicate it. Losing
   * the link here would leave it on neither path: not on this task, and
   * never auto-adopted either.
   */
  const saveTaskRetrying = async (next: Task, attempts = 3): Promise<void> => {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try { await saveTask(host, next); return; }
      catch (error) {
        if (attempt === attempts) throw error;
        await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
      }
    }
  };
  /**
   * The persisted "going forward" cutoff (see `store/orphanWatermark.ts`):
   * a session is only adoptable if it was created at or after this time.
   * `Infinity` until `reload()` has actually loaded or set it, so nothing
   * is adopted on a race before we know the real value.
   */
  let orphanWatermark = Infinity;

  /**
   * A session with no task yet, created at or after the persisted
   * watermark, gets adopted as a new task — In Progress while it's
   * running, Review once it needs you (a question, a permission prompt, or
   * it already finished). Sessions older than the watermark (pre-dating
   * this feature's first use) are left alone, by design.
   */
  const adoptRunningSession = (projectId: string, session: { id: string; title: string; createdAt: number }, status: TaskStatus) => {
    if (disposed || attemptedSessions.has(session.id) || linkedSessionIds().has(session.id)) return;
    if (session.createdAt < orphanWatermark) return;
    attemptedSessions.add(session.id);
    void (async () => {
      try {
        const task: Task = {
          ...createTask({ title: titleForOrphanSession(session, projects.find((p) => p.id === projectId)?.name ?? null), projectId, status }, rankAtEnd(tasks, status)),
          sessionId: session.id,
          // Landing straight in Review (already finished, or needs you) is just as unseen as any other automatic move there.
          needsAttentionSince: status === 'review' ? Date.now() : null,
        };
        await saveTask(host, task);
        setTasks([...tasks, task]);
        render();
        void host.toast({ kind: 'info', message: `Added "${task.title}" to the board (${STATUS_LABELS[status]}) — found a session running with no task.` }).catch(() => undefined);
      } catch (error) { notify(error); }
    })();
  };
  let orphanWatcher: { dispose: () => void } | null = null;

  const projectOptions = () => [
    { id: ALL_PROJECTS, label: 'All projects' },
    { id: NO_PROJECT, label: 'No project' },
    ...projects.map((p) => ({ id: p.id, label: p.name })),
  ];
  const projectSelect = mountSelect(projectSelectWrap, {
    label: 'Project', value: ALL_PROJECTS, options: projectOptions(), searchable: true,
    onChange: (value) => {
      filter = { ...filter, projectId: value }; projectSelect.update({ value });
      void savePrefs(host, { ...prefs, projectId: value }).catch(() => undefined);
      prefs = { ...prefs, projectId: value };
      render();
    },
  });
  const searchField = mountSearchField(searchWrap, {
    value: filter.query, placeholder: 'Search tasks, branch, session…',
    onChange: (value) => {
      filter = { ...filter, query: value }; searchField.update({ value });
      void savePrefs(host, { ...prefs, query: value }).catch(() => undefined);
      prefs = { ...prefs, query: value };
      render();
    },
  });

  const persistOpenTask = (id: string | null) => {
    prefs = { ...prefs, openTaskId: id };
    void savePrefs(host, prefs).catch(() => undefined);
  };

  const closeDetail = () => {
    detail?.dispose(); detail = null;
    if (!leavingForChat) persistOpenTask(null);
    leavingForChat = false;
  };

  /** Opening a task — its chat or its detail popup — is what "reviewed" means; clear any unseen marker. */
  const markReviewed = (task: Task) => {
    if (task.needsAttentionSince === null) return;
    const updated = applyPatch(task, { needsAttentionSince: null });
    setTasks(tasks.map((t) => (t.id === task.id ? updated : t)));
    render();
    void saveTask(host, updated).catch((error) => notify(error));
  };

  const openDetail = (id: string) => {
    const found = tasks.find((t) => t.id === id);
    if (!found) return;
    markReviewed(found);
    const task = tasks.find((t) => t.id === id) ?? found;
    detail?.dispose();
    persistOpenTask(id);
    detail = mountTaskDetail(root, {
      task,
      projects: projects.map((p) => ({ id: p.id, name: p.name })),
      onClose: closeDetail,
      onSave: async (patch) => {
        const updated = applyPatch(task, patch);
        await saveTask(host, updated);
        setTasks(tasks.map((t) => (t.id === task.id ? updated : t)));
        render();
        closeDetail();
        openDetail(task.id);
      },
      onDelete: async () => {
        await deleteTask(host, task.id);
        setTasks(tasks.filter((t) => t.id !== task.id));
        closeDetail();
        render();
      },
      onOpenChat: async (sessionId) => {
        leavingForChat = true;
        await host.openSession(sessionId);
        closeDetail();
      },
      onLinkSession: async (sessionId) => {
        // Claimed immediately, before the save, so the orphan watcher never adopts this
        // session as a second task even if the save below is slow or ultimately fails.
        attemptedSessions.add(sessionId);
        const updated = applyPatch(task, { sessionId, status: task.status === 'backlog' ? 'todo' : task.status });
        await saveTaskRetrying(updated);
        setTasks(tasks.map((t) => (t.id === task.id ? updated : t)));
        render();
        closeDetail();
        openDetail(task.id);
      },
      onUnlinkSession: async () => {
        const updated = applyPatch(task, { sessionId: null });
        await saveTask(host, updated);
        setTasks(tasks.map((t) => (t.id === task.id ? updated : t)));
        render();
        closeDetail();
        openDetail(task.id);
      },
      loadSessionsForProject: async (projectId) => {
        const result = await fetchSessions(host, projectId);
        return result.sessions.map((s) => ({ id: s.id, title: s.title, activity: s.activity }));
      },
      loadWorktreeInfo: async (projectId) => {
        const result = await fetchWorktrees(host, projectId);
        // The optional git-branch service gives the real repository branch list, same as
        // OpenChamber's own "New Worktree" dialog; falls back to worktree-derived branches
        // (silently — see fetchServiceBranches) when it's not approved, running, or supported.
        const directory = projects.find((p) => p.id === projectId)?.directory ?? null;
        const serviceBranches = directory ? await fetchServiceBranches(host, directory) : null;
        return {
          destinations: result.worktrees.map(describeWorktreeOption),
          baseBranches: serviceBranches ?? buildBaseBranchOptions(result.worktrees),
          hasKnownBranches: serviceBranches ? serviceBranches.length > 2 : hasKnownBranches(result.worktrees),
        };
      },
      onStartAgent: async ({ projectId, worktree }) => {
        const text = task.description.trim() || task.title;
        const result = await host.startSession({
          providerId: EXTENSION_ID,
          id: task.id,
          title: task.title,
          url: taskUrl(task.id),
          text,
          projectId,
          worktree,
          navigation: 'open',
        });
        if (result.sessionId === null) {
          throw new Error(`Could not start the agent (${result.failure}). Its worktree at ${result.directory} was kept so you can recover it by hand.`);
        }
        // A real session now exists and is likely already running. Claim it before the
        // save below so the orphan watcher never adopts it as a second, duplicate task —
        // this is the fix for "started an agent and got two cards for the same session."
        attemptedSessions.add(result.sessionId);
        const updated = applyPatch(task, {
          sessionId: result.sessionId,
          projectId,
          status: 'in_progress',
          worktree: resolveTaskWorktree(worktree, result),
        });
        await saveTaskRetrying(updated);
        leavingForChat = true;
        setTasks(tasks.map((t) => (t.id === task.id ? updated : t)));
        render();
        closeDetail();
      },
    });
  };

  const moveTask = async (id: string, status: TaskStatus, beforeId: string | null, visibleColumn: Task[]) => {
    const plan = planDrop(visibleColumn, id, beforeId);
    const current = tasks.find((t) => t.id === id);
    if (!current) return;
    const rebalanceMap = new Map(plan.rebalance.map((entry) => [entry.id, entry.rank]));
    const next = tasks.map((task) => {
      // A manual drag is itself an acknowledgment, same as opening the card.
      if (task.id === id) return applyPatch(task, { status, rank: plan.rank, needsAttentionSince: null });
      const newRank = rebalanceMap.get(task.id);
      return newRank === undefined ? task : applyPatch(task, { rank: newRank });
    });
    setTasks(next);
    render();
    try {
      await saveTask(host, next.find((t) => t.id === id)!);
      await Promise.all(plan.rebalance.map((entry) => saveTask(host, next.find((t) => t.id === entry.id)!)));
    } catch (error) {
      notify(error);
      void reload();
    }
  };

  const updateBadge = () => {
    const openCount = tasks.filter((t) => t.status !== 'done').length;
    void host.setBadge(openCount || null).catch(() => undefined);
  };

  const render = () => {
    columnsRoot.replaceChildren();
    const columns = groupColumns(tasks, filter);
    updateBadge();
    for (const status of STATUSES) {
      const column = el('div', 'kb-column');
      column.dataset.status = status;
      const head = el('div', 'kb-column-head');
      head.append(el('span', 'kb-column-title', STATUS_LABELS[status]));
      head.append(el('span', 'kb-column-count', String(columns[status].length)));
      const body = el('div', 'kb-column-body');
      column.append(head, body);
      if (columns[status].length === 0) body.append(el('div', 'kb-column-empty', 'No tasks'));
      for (const task of columns[status]) body.append(renderCard(task));
      wireDropZone(column, body, status, () => columns[status]);
      columnsRoot.append(column);
    }
  };

  const renderCard = (task: Task) => {
    const card = el('div', task.needsAttentionSince !== null ? 'kb-card kb-card-needs-attention' : 'kb-card');
    card.draggable = true;
    card.dataset.id = task.id;
    const titleRow = el('div', 'kb-row between');
    titleRow.append(el('div', 'kb-card-title', task.title));
    mountButton(titleRow, { label: 'Edit', variant: 'ghost', size: 'xs', onClick: () => openDetail(task.id) });
    card.append(titleRow);
    const meta = el('div', 'kb-card-meta');
    const project = task.projectId ? projects.find((p) => p.id === task.projectId)?.name ?? task.projectId : null;
    if (project) meta.append(el('span', 'kb-muted', project));
    if (task.sourceBranch) meta.append(el('span', 'kb-mono', task.sourceBranch));
    if (task.sessionId) meta.append(el('span', 'kb-mono', `session:${task.sessionId.slice(0, 8)}`));
    card.append(meta);
    if (!task.sessionId) card.append(el('p', 'kb-muted', 'No session yet — click to start an agent or link one.'));
    card.addEventListener('click', (event) => {
      // The Edit button already handled its own click; don't also act on the card underneath it.
      if ((event.target as HTMLElement).closest('button')) return;
      if (task.sessionId) { markReviewed(task); void host.openSession(task.sessionId).catch(notify); return; }
      openDetail(task.id);
    });
    card.addEventListener('dragstart', (event) => {
      draggingId = task.id;
      card.classList.add('kb-dragging');
      event.dataTransfer?.setData('text/plain', task.id);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => { draggingId = null; card.classList.remove('kb-dragging'); });
    return card;
  };

  const wireDropZone = (column: HTMLElement, body: HTMLElement, status: TaskStatus, visible: () => Task[]) => {
    column.addEventListener('dragover', (event) => {
      if (!draggingId) return;
      event.preventDefault();
      column.classList.add('kb-dragover');
    });
    column.addEventListener('dragleave', (event) => {
      if (event.target === column) column.classList.remove('kb-dragover');
    });
    column.addEventListener('drop', (event) => {
      event.preventDefault();
      column.classList.remove('kb-dragover');
      const id = draggingId ?? event.dataTransfer?.getData('text/plain') ?? null;
      draggingId = null;
      if (!id) return;
      const rects = [...body.querySelectorAll<HTMLElement>('.kb-card')]
        .filter((node) => node.dataset.id !== id)
        .map((node) => ({ id: node.dataset.id!, ...node.getBoundingClientRect() }));
      const beforeId = insertionTarget(rects, event.clientY);
      void moveTask(id, status, beforeId, visible());
    });
  };

  const reload = async () => {
    refresh.update({ loading: true });
    try {
      const [{ tasks: loaded, failedKeys }, loadedPrefs, watermark] = await Promise.all([loadTasks(host), loadPrefs(host), loadOrphanWatermark(host)]);
      // A manual/initial reload is a clean slate for the retry guards above.
      attemptedSessions = new Set();
      lastAttemptedStatus = new Map();
      if (watermark === null) {
        // First time this feature has ever run: nothing that already exists right now is "going forward".
        orphanWatermark = Date.now();
        void saveOrphanWatermark(host, orphanWatermark).catch(() => undefined);
      } else {
        orphanWatermark = watermark;
      }
      setTasks(loaded);
      prefs = loadedPrefs;
      filter = { projectId: prefs.projectId, query: prefs.query };
      projectSelect.update({ value: filter.projectId, options: projectOptions() });
      searchField.update({ value: filter.query });
      if (failedKeys.length) showBanner('Some tasks could not be loaded', `${failedKeys.length} record(s) were skipped. Other tasks are safe; Refresh retries.`, 'warning');
      else clearBanner();
      render();
      if (prefs.openTaskId && tasks.some((t) => t.id === prefs.openTaskId)) openDetail(prefs.openTaskId);
    } catch (error) { notify(error); }
    finally { refresh.update({ loading: false }); }
  };

  let stopProjects: (() => void) | null = null;
  void watchProjects(host, (state) => {
    if (disposed) return;
    if (state.state === 'error') { showBanner('Projects unavailable', 'Showing tasks without live project data.', 'warning'); return; }
    projects = state.projects;
    projectSelect.update({ options: projectOptions() });
    render();
  }).then((stop) => { if (disposed) stop(); else stopProjects = stop; }, (error) => { if (!disposed) notify(error); });

  const spinner = mountSpinner(spinnerSlot, { label: 'Loading board…' });
  void reload().finally(() => {
    spinner.dispose(); spinnerSlot.hidden = true;
    // Wait for the first load so a session already linked to a persisted task is never mistaken for an orphan.
    if (!disposed) orphanWatcher = watchOrphanSessions(host, linkedSessionIds, (found) => adoptRunningSession(found.projectId, found.session, found.status));
  });

  return {
    dispose: () => {
      disposed = true;
      stopProjects?.();
      sessionSync.dispose();
      orphanWatcher?.dispose();
      detail?.dispose();
    },
  };
};

