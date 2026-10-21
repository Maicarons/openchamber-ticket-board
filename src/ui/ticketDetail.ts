import type { GuestSessionWorktree } from '@openchamber/sdk';
import { mountBanner, mountButton, mountList, mountSelect, mountTextField, type SelectOption } from '@openchamber/sdk/ui';
import type { BoardTicket } from '../domain/ticketBoard.ts';
import { actionsForTicket } from '../domain/ticketActions.ts';
import { statusForTriageRole, triageRoleForStatus, type TriageLabels } from '../domain/triageLabels.ts';
import type { TicketEdit } from '../domain/ticketEdit.ts';
import { blockingReasons, isBlocked } from '../domain/ticketColumns.ts';
import {
  branchNameConflictsWithBase,
  buildSessionWorktree,
  DEFAULT_BASE_BRANCH_OPTION,
  DESTINATION_NEW,
  DESTINATION_ROOT,
  resolveBaseBranch,
} from '../domain/worktree.ts';
import { el } from './dom.ts';

export type SessionOption = { id: string; title: string; activity: string };
export type WorktreeOption = { id: string; label: string; hint?: string; disabled?: boolean };
export type WorktreeInfo = { destinations: WorktreeOption[]; baseBranches: SelectOption[]; hasKnownBranches: boolean };

export type TicketDetailProps = {
  entry: BoardTicket;
  labels: TriageLabels;
  feature: string;
  hasSpec: boolean;
  hasMap: boolean;
  specPath: string | null;
  mapPath: string | null;
  siblings: BoardTicket[];
  projectName: string;
  onClose: () => void;
  /** Board previews and applies the edits, then reloads and reopens this dialog. */
  onEdit: (edits: TicketEdit[]) => Promise<void>;
  onOpenChat: (sessionId: string) => Promise<void>;
  onLinkSession: (sessionId: string, projectId: string) => Promise<void>;
  onUnlinkSession: () => Promise<void>;
  onStartAgent: (input: { prompt: string; worktree: GuestSessionWorktree; title: string }) => Promise<void>;
  loadSessionsForProject: (projectId: string) => Promise<SessionOption[]>;
  loadWorktreeInfo: (projectId: string) => Promise<WorktreeInfo>;
};

const STATUS_OPTIONS = (labels: TriageLabels): SelectOption[] => [
  { id: statusForTriageRole('needs-triage', labels), label: 'needs-triage' },
  { id: statusForTriageRole('needs-info', labels), label: 'needs-info' },
  { id: statusForTriageRole('ready-for-agent', labels), label: 'ready-for-agent' },
  { id: statusForTriageRole('ready-for-human', labels), label: 'ready-for-human' },
  { id: 'claimed', label: 'claimed' },
  { id: 'resolved', label: 'resolved' },
  { id: statusForTriageRole('wontfix', labels), label: 'wontfix' },
];

const defaultBaseBranchOptions: SelectOption[] = [{ id: DEFAULT_BASE_BRANCH_OPTION, label: 'Use project default' }];

/** A read-only rendering that keeps the file's own Markdown legible without a Markdown dependency. */
const pre = (className: string, text: string): HTMLPreElement => {
  const node = el('pre', className);
  node.textContent = text;
  return node;
};

/** The body is shown once; Comments and Answer have their own, collapsed sections below. */
const bodyWithoutSections = (content: string): string => {
  const match = content.search(/^##\s+(Comments|Answer)\s*$/im);
  return (match >= 0 ? content.slice(0, match) : content).trimEnd();
};

export const mountTicketDetail = (root: Element, props: TicketDetailProps) => {
  const { ticket } = props.entry;
  const overlay = el('div', 'kb-overlay');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  const dialog = el('div', 'kb-dialog kb-dialog-wide');
  overlay.append(dialog);
  root.append(overlay);

  const onKeydown = (event: KeyboardEvent) => { if (event.key === 'Escape') props.onClose(); };
  overlay.addEventListener('click', (event) => { if (event.target === overlay) props.onClose(); });
  document.addEventListener('keydown', onKeydown);

  const errorSlot = el('div');
  errorSlot.hidden = true;
  const errorBanner = mountBanner(errorSlot, { tone: 'error', title: '' });
  const showError = (error: unknown) => {
    errorSlot.hidden = false;
    errorBanner.update({ tone: 'error', title: 'Could not save', body: error instanceof Error ? error.message : String(error) });
  };

  const head = el('div', 'kb-row between');
  head.append(el('h2', '', ticket.title));
  mountButton(head, { label: 'Close', variant: 'outline', size: 'sm', onClick: props.onClose });
  dialog.append(head, errorSlot);

  const meta = el('div', 'kb-row kb-ticket-meta');
  meta.append(el('span', 'kb-mono', ticket.number ? `#${ticket.number}` : ''));
  meta.append(el('span', 'kb-badge', ticket.type ?? 'no type'));
  meta.append(el('span', 'kb-badge', ticket.status ?? 'no status'));
  if (ticket.category) meta.append(el('span', 'kb-badge', ticket.category));
  meta.append(el('span', 'kb-muted', ticket.feature || 'no feature'));
  meta.append(el('span', 'kb-mono', ticket.path));
  dialog.append(meta);

  if (ticket.conflicts.length) {
    const slot = el('div');
    dialog.append(slot);
    mountBanner(slot, { tone: 'error', title: 'Fix this ticket before the board writes to it', body: ticket.conflicts.join(' · ') });
  }
  if (ticket.warnings.length) {
    const slot = el('div');
    dialog.append(slot);
    mountBanner(slot, { tone: 'warning', title: 'This file has something to check', body: ticket.warnings.join(' · ') });
  }
  if (isBlocked(ticket, props.siblings.map((entry) => entry.ticket), props.labels)) {
    const slot = el('div');
    dialog.append(slot);
    mountBanner(slot, { tone: 'info', title: 'Blocked', body: blockingReasons(ticket, props.siblings.map((entry) => entry.ticket), props.labels).join(' · ') });
  }

  const bodySection = el('div', 'kb-section');
  bodySection.append(el('div', 'kb-section-title', 'Ticket'));
  bodySection.append(pre('kb-ticket-body', bodyWithoutSections(ticket.content)));
  dialog.append(bodySection);

  if (ticket.comments) {
    const details = el('details', 'kb-section');
    const summary = el('summary', 'kb-section-title', 'Comments');
    details.append(summary, pre('kb-ticket-body kb-ticket-comments', ticket.comments));
    dialog.append(details);
  }
  if (ticket.answer) {
    const details = el('details', 'kb-section');
    const summary = el('summary', 'kb-section-title', 'Answer');
    details.append(summary, pre('kb-ticket-body kb-ticket-comments', ticket.answer));
    dialog.append(details);
  }

  // ----- ticket fields: the only two lines the board may replace -----
  const fields = el('div', 'kb-section');
  fields.append(el('div', 'kb-section-title', 'Tracker fields'));
  const grid = el('div', 'kb-dialog-grid');
  fields.append(grid);

  let status = ticket.status ?? '';
  let blockedBy = ticket.blockedBy.map((ref) => ref.number).join(', ');
  const statusWrap = el('div');
  grid.append(statusWrap);
  const statusOptions = STATUS_OPTIONS(props.labels);
  // A custom label that is not one of the known options is still shown, so opening the picker never silently changes it.
  if (status && !statusOptions.some((option) => option.id === status)) {
    statusOptions.unshift({ id: status, label: status });
  }
  const statusField = mountSelect(statusWrap, {
    label: 'Status',
    value: status || null,
    options: statusOptions,
    placeholder: 'No Status line',
    onChange: (value) => { status = value; statusField.update({ value }); markDirty(); },
  });

  const blockedWrap = el('div');
  grid.append(blockedWrap);
  const blockedField = mountTextField(blockedWrap, {
    label: 'Blocked by',
    value: blockedBy,
    placeholder: 'None, or 01, 02',
    helper: 'Numbers from this feature only. Leave empty to unblock.',
    onChange: (value) => { blockedBy = value; blockedField.update({ value }); markDirty(); },
  });

  let dirty = false;
  const saveRow = el('div', 'kb-row');
  fields.append(saveRow);
  const save = mountButton(saveRow, {
    label: 'Preview changes',
    disabled: true,
    onClick: () => {
      void (async () => {
        save.update({ loading: true });
        try {
          const edits: TicketEdit[] = [];
          if (status !== (ticket.status ?? '')) edits.push({ kind: 'status', status });
          if (blockedBy.trim() !== ticket.blockedBy.map((ref) => ref.number).join(', ')) {
            const refs = blockedBy.split(/[,;\s]+/).map((value) => value.replace(/^#/, '')).filter(Boolean);
            edits.push({ kind: 'blockedBy', blockedBy: refs });
          }
          if (edits.length) await props.onEdit(edits);
        } catch (error) { showError(error); }
        finally { save.update({ loading: false }); }
      })();
    },
  });
  const markDirty = () => {
    dirty = status !== (ticket.status ?? '') || blockedBy.trim() !== ticket.blockedBy.map((ref) => ref.number).join(', ');
    save.update({ disabled: !dirty });
    errorSlot.hidden = true;
  };
  markDirty();
  dialog.append(fields);

  // ----- append-only outcomes: a comment, or an answer that resolves -----
  const outcome = el('div', 'kb-section');
  outcome.append(el('div', 'kb-section-title', 'Record an outcome'));
  outcome.append(el('p', 'kb-muted', 'These append under ## Comments or ## Answer. Earlier text is never rewritten.'));
  const outcomeGrid = el('div', 'kb-dialog-grid');
  outcome.append(outcomeGrid);

  let comment = '';
  let commentButton: ReturnType<typeof mountButton> | null = null;
  const commentWrap = el('div');
  outcomeGrid.append(commentWrap);
  const commentField = mountTextField(commentWrap, {
    label: 'Comment',
    value: '',
    multiline: true,
    rows: 3,
    placeholder: 'What did you learn or decide?',
    onChange: (value) => { comment = value; commentField.update({ value }); commentButton?.update({ disabled: !comment.trim() }); },
  });
  commentButton = mountButton(commentWrap, {
    label: 'Add comment',
    variant: 'secondary',
    size: 'sm',
    disabled: true,
    onClick: () => {
      if (!comment.trim()) return;
      commentButton?.update({ loading: true });
      void props.onEdit([{ kind: 'comment', body: comment, author: 'Board', at: new Date().toISOString() }])
        .catch(showError)
        .finally(() => commentButton?.update({ loading: false }));
    },
  });

  let answer = '';
  let answerButton: ReturnType<typeof mountButton> | null = null;
  const answerWrap = el('div');
  outcomeGrid.append(answerWrap);
  const answerField = mountTextField(answerWrap, {
    label: 'Answer',
    value: '',
    multiline: true,
    rows: 3,
    placeholder: 'What resolves this ticket?',
    onChange: (value) => { answer = value; answerField.update({ value }); answerButton?.update({ disabled: !answer.trim() }); },
  });
  answerButton = mountButton(answerWrap, {
    label: 'Resolve with answer',
    size: 'sm',
    disabled: true,
    onClick: () => {
      if (!answer.trim()) return;
      answerButton?.update({ loading: true });
      void props.onEdit([
        { kind: 'answer', body: answer, at: new Date().toISOString() },
        { kind: 'status', status: 'resolved' },
      ]).catch(showError).finally(() => answerButton?.update({ loading: false }));
    },
  });
  dialog.append(outcome);

  // ----- prompt composer -----
  const compose = el('div', 'kb-section');
  compose.append(el('div', 'kb-section-title', 'Agent prompt'));
  const actionContext = {
    feature: props.feature,
    hasSpec: props.hasSpec,
    hasMap: props.hasMap,
    specPath: props.specPath,
    mapPath: props.mapPath,
    siblings: props.siblings.map((entry) => entry.ticket),
    labels: props.labels,
  };
  const actions = actionsForTicket(ticket, actionContext);
  const initial = actions.find((action) => action.id === 'implement' && !action.disabledReason)
    ?? actions.find((action) => action.id === 'triage' && !action.disabledReason)
    ?? actions.find((action) => action.id === 'handoff');
  let prompt = initial?.prompt ?? `Work on ${ticket.path}\n\nTicket: ${ticket.title}\nFeature: ${props.feature}`;
  const promptWrap = el('div');
  compose.append(promptWrap);
  const promptField = mountTextField(promptWrap, {
    label: 'Description / agent prompt',
    value: prompt,
    multiline: true,
    rows: 9,
    helper: 'An action below replaces this with a prompt naming the skill and this ticket. Start Agent sends exactly what is here.',
    onChange: (value) => { prompt = value; promptField.update({ value }); },
  });
  const promptInput = (): HTMLTextAreaElement | null => promptWrap.querySelector('textarea');

  const actionRow = el('div', 'kb-action-grid');
  compose.append(actionRow);
  for (const action of actions) {
    const wrap = el('div', 'kb-action');
    const button = mountButton(wrap, {
      label: action.label,
      variant: action.id === 'implement' ? 'default' : 'secondary',
      size: 'sm',
      disabled: action.disabledReason !== null,
      onClick: () => {
        prompt = action.prompt;
        promptField.update({ value: prompt });
        const input = promptInput();
        input?.focus();
        input?.setSelectionRange(prompt.length, prompt.length);
      },
    });
    if (action.disabledReason) {
      wrap.title = action.disabledReason;
      wrap.append(el('span', 'kb-action-reason', action.disabledReason));
    } else {
      wrap.title = `Fill the prompt with /${action.skill}`;
    }
    void button;
    actionRow.append(wrap);
  }
  if (props.specPath) {
    const spec = el('div', 'kb-muted', `Spec: ${props.specPath}`);
    compose.append(spec);
  }
  if (props.mapPath) {
    compose.append(el('div', 'kb-muted', `Map: ${props.mapPath}`));
  }
  dialog.append(compose);

  // ----- session -----
  const sessionSection = el('div', 'kb-section');
  sessionSection.append(el('div', 'kb-section-title', 'OpenCode session'));
  dialog.append(sessionSection);

  let sessionId = props.entry.link?.sessionId ?? null;
  const sessionBody = el('div', 'kb-row');
  sessionSection.append(sessionBody);
  const renderSession = () => {
    sessionBody.replaceChildren();
    if (!sessionId) {
      sessionBody.append(el('p', 'kb-muted', 'No session linked. Start one below, or link an existing one.'));
      return;
    }
    sessionBody.append(el('span', 'kb-mono', sessionId));
    mountButton(sessionBody, { label: 'Open Chat', onClick: () => { void props.onOpenChat(sessionId!).catch(showError); } });
    mountButton(sessionBody, {
      label: 'Unlink', variant: 'ghost',
      onClick: () => { void props.onUnlinkSession().then(() => { sessionId = null; renderSession(); startRoot.hidden = false; pickerRoot.hidden = false; renderPicker(); }).catch(showError); },
    });
  };
  renderSession();

  const startRoot = el('div');
  const pickerRoot = el('div');
  sessionSection.append(startRoot, pickerRoot);
  startRoot.hidden = Boolean(sessionId);
  pickerRoot.hidden = Boolean(sessionId);

  type StartMode = typeof DESTINATION_ROOT | typeof DESTINATION_NEW | 'existing';
  let mode: StartMode = DESTINATION_ROOT;
  let existingWorktreeId = '';
  let branchName = '';
  let baseBranchSelection = DEFAULT_BASE_BRANCH_OPTION;
  let startBusy = false;
  let generation = 0;
  let refreshWorktreeOptions = () => {};
  let startButton: { update: (next: { disabled?: boolean; loading?: boolean }) => void } | null = null;

  const canStart = () => {
    if (!prompt.trim()) return false;
    if (mode === DESTINATION_NEW) {
      if (!branchName.trim()) return false;
      if (branchNameConflictsWithBase(branchName, resolveBaseBranch(baseBranchSelection))) return false;
    }
    if (mode === 'existing') return existingWorktreeId.length > 0;
    return true;
  };
  const updateStartAvailability = () => {
    startButton?.update({ disabled: !canStart() });
  };

  startRoot.append(el('p', 'kb-muted', 'The prompt above becomes the session\'s first message. The session is linked back to this ticket.'));
  const startGrid = el('div', 'kb-dialog-grid');
  startRoot.append(startGrid);

    const fromWrap = el('div');
    startGrid.append(fromWrap);
    fromWrap.append(el('div', 'kb-section-title', 'Start from'));
    const radioGroup = el('div', 'kb-radio-group');
    fromWrap.append(radioGroup);
    const radioName = `kb-ticket-destination-${Math.random().toString(36).slice(2)}`;
    const options: Array<{ id: StartMode; title: string; desc: string }> = [
      { id: DESTINATION_ROOT, title: 'Project root', desc: 'Run directly in the main checkout, no worktree.' },
      { id: DESTINATION_NEW, title: 'New branch', desc: 'A fresh branch and worktree, based on the branch you pick.' },
      { id: 'existing', title: 'Existing worktree', desc: 'Reuse a worktree you already have checked out.' },
    ];
    const newBranchFields = el('div', 'kb-dialog-grid');
    const existingFields = el('div');
    for (const option of options) {
      const label = el('label', 'kb-radio-option');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = radioName;
      input.value = option.id;
      input.checked = option.id === mode;
      const textWrap = el('div');
      textWrap.append(el('div', 'kb-radio-title', option.title), el('div', 'kb-radio-desc', option.desc));
      label.append(input, textWrap);
      radioGroup.append(label);
      input.addEventListener('change', () => {
        if (!input.checked) return;
        mode = option.id;
        newBranchFields.hidden = mode !== DESTINATION_NEW;
        existingFields.hidden = mode !== 'existing';
        updateStartAvailability();
      });
    }

    const fieldsWrap = el('div');
    startGrid.append(fieldsWrap);
    newBranchFields.hidden = true;
    fieldsWrap.append(newBranchFields);
    const branchField = mountTextField(newBranchFields, {
      label: 'Branch name', value: '', placeholder: 'e.g. ticket/01-parser',
      onChange: (value) => { branchName = value; branchField.update({ value }); updateStartAvailability(); },
    });
    const baseField = mountSelect(newBranchFields, {
      label: 'Based on', value: DEFAULT_BASE_BRANCH_OPTION, options: defaultBaseBranchOptions, searchable: true,
      onChange: (value) => { baseBranchSelection = value; baseField.update({ value }); updateStartAvailability(); },
    });
    const branchNote = el('p', 'kb-muted kb-span2');
    newBranchFields.append(branchNote);

    existingFields.hidden = true;
    fieldsWrap.append(existingFields);
    const existingSelect = mountSelect(existingFields, {
      label: 'Worktree', value: null, placeholder: 'Choose a worktree…', options: [],
      onChange: (value) => { existingWorktreeId = value; existingSelect.update({ value }); updateStartAvailability(); },
    });
    const existingNote = el('p', 'kb-muted', '');
    existingFields.append(existingNote);

    const startRow = el('div', 'kb-row');
    startRoot.append(startRow);
    startButton = mountButton(startRow, {
      label: 'Start Agent',
      disabled: !canStart(),
      onClick: () => {
        void (async () => {
          if (startBusy || !canStart()) return;
          startBusy = true;
          startButton?.update({ loading: true });
          try {
            const destination = mode === 'existing' ? existingWorktreeId : mode;
            const worktree = buildSessionWorktree(destination, branchName, resolveBaseBranch(baseBranchSelection));
            await props.onStartAgent({ prompt, worktree, title: ticket.title });
          } catch (error) { showError(error); }
          finally { startBusy = false; startButton?.update({ loading: false }); }
        })();
      },
    });

    const noKnownBranchesNote = 'The local branch-lookup service is not available, so only existing worktree branches and "Use project default" are offered.';
    refreshWorktreeOptions = () => {
      const current = ++generation;
      baseField.update({ value: baseBranchSelection, options: defaultBaseBranchOptions });
      existingSelect.update({ value: existingWorktreeId || null, options: [] });
      existingNote.textContent = '';
      void props.loadWorktreeInfo(props.entry.projectId).then((info) => {
        if (current !== generation) return;
        existingSelect.update({ options: info.destinations.map((worktree) => ({ id: worktree.id, label: worktree.label, hint: worktree.hint })) });
        if (info.destinations.length === 0) existingNote.textContent = 'No existing worktrees in this project yet.';
        baseField.update({ options: info.baseBranches });
        branchNote.textContent = info.hasKnownBranches ? '' : noKnownBranchesNote;
      }, (error) => { if (current === generation) showError(error); });
    };
    refreshWorktreeOptions();

  // ----- link an existing session -----
  let picker: { dispose: () => void } | null = null;
  let pickerGeneration = 0;
  const renderPicker = () => {
    picker?.dispose();
    picker = null;
    pickerRoot.replaceChildren();
    if (sessionId) return;
    pickerRoot.append(el('div', 'kb-section-title', 'Or link an existing session'));
    const current = ++pickerGeneration;
    const list = mountList(pickerRoot, {
      ariaLabel: 'Sessions available to link',
      items: [],
      emptyText: 'Loading sessions…',
      onSelect: (id) => { void props.onLinkSession(id, props.entry.projectId).then(() => { sessionId = id; renderSession(); startRoot.hidden = true; pickerRoot.hidden = true; }).catch(showError); },
    });
    picker = list;
    void props.loadSessionsForProject(props.entry.projectId).then((sessions) => {
      if (current !== pickerGeneration) return;
      list.update({
        items: sessions.map((session) => ({
          id: session.id,
          title: session.title,
          subtitle: session.id,
          badge: { label: session.activity, tone: session.activity === 'running' ? 'info' : 'neutral' },
        })),
        emptyText: 'No sessions in this project yet.',
      });
    }, (error) => { if (current === pickerGeneration) showError(error); });
  };
  if (!sessionId) renderPicker();

  dialog.append(sessionSection);

  const footer = el('div', 'kb-row between');
  dialog.append(footer);
  footer.append(el('span', 'kb-muted', `Project: ${props.projectName}`));
  mountButton(footer, { label: 'Close', variant: 'outline', onClick: props.onClose });

  const dispose = () => {
    document.removeEventListener('keydown', onKeydown);
    picker?.dispose();
    overlay.remove();
  };
  return { dispose };
};

/** The canonical role a status picker should highlight, for callers that need it. */
export const selectedRole = (status: string | null, labels: TriageLabels) => triageRoleForStatus(status, labels);
