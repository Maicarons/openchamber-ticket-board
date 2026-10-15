import type { GuestSessionWorktree } from '@openchamber/sdk';
import { mountBanner, mountButton, mountList, mountSelect, mountTextField, type SelectOption } from '@openchamber/sdk/ui';
import { DESCRIPTION_MAX, STATUSES, STATUS_LABELS, TITLE_MAX, type Task, type TaskPatch } from '../domain/task.ts';
import {
  buildSessionWorktree,
  CUSTOM_BASE_BRANCH_OPTION,
  DEFAULT_BASE_BRANCH_OPTION,
  DESTINATION_NEW,
  DESTINATION_ROOT,
  resolveBaseBranch,
} from '../domain/worktree.ts';
import { el } from './dom.ts';

export type SessionOption = { id: string; title: string; activity: string };
export type WorktreeOption = { id: string; label: string; hint?: string; disabled?: boolean };
export type WorktreeInfo = { destinations: WorktreeOption[]; baseBranches: SelectOption[]; hasKnownBranches: boolean };

export type TaskDetailProps = {
  task: Task;
  projects: Array<{ id: string; name: string }>;
  onSave: (patch: TaskPatch) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
  onOpenChat: (sessionId: string) => Promise<void>;
  onLinkSession: (sessionId: string) => Promise<void>;
  onUnlinkSession: () => Promise<void>;
  onStartAgent: (input: { projectId: string; worktree: GuestSessionWorktree }) => Promise<void>;
  loadSessionsForProject: (projectId: string) => Promise<SessionOption[]>;
  loadWorktreeInfo: (projectId: string) => Promise<WorktreeInfo>;
};

const statusOptions: SelectOption[] = STATUSES.map((id) => ({ id, label: STATUS_LABELS[id] }));
const baseDestinationOptions: SelectOption[] = [{ id: DESTINATION_ROOT, label: 'Project root' }, { id: DESTINATION_NEW, label: 'New worktree' }];
const defaultBaseBranchOptions: SelectOption[] = [{ id: DEFAULT_BASE_BRANCH_OPTION, label: 'Use project default' }, { id: CUSTOM_BASE_BRANCH_OPTION, label: 'Custom branch…' }];

export const mountTaskDetail = (root: Element, props: TaskDetailProps) => {
  const overlay = el('div', 'kb-overlay');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  const dialog = el('div', 'kb-dialog');
  overlay.append(dialog);
  root.append(overlay);

  const onKeydown = (event: KeyboardEvent) => { if (event.key === 'Escape') props.onClose(); };
  overlay.addEventListener('click', (event) => { if (event.target === overlay) props.onClose(); });
  document.addEventListener('keydown', onKeydown);

  let title = props.task.title;
  let description = props.task.description;
  let status = props.task.status;
  let projectId = props.task.projectId ?? '';
  let sourceBranch = props.task.sourceBranch ?? '';
  let dirty = false;
  let busy = false;
  const hasSession = Boolean(props.task.sessionId);

  dialog.append(el('h2', '', `Task · ${props.task.id}`));
  const errorSlot = el('div');
  dialog.append(errorSlot);
  const banner = mountBanner(errorSlot, { tone: 'error', title: '' });
  errorSlot.hidden = true;
  const showError = (error: unknown) => {
    errorSlot.hidden = false;
    banner.update({ tone: 'error', title: 'Could not save', body: error instanceof Error ? error.message : String(error) });
  };
  const clearError = () => { errorSlot.hidden = true; };

  /** Every field's onChange routes through here so the Save button always reflects there's something unsaved. */
  const markDirty = () => { dirty = true; clearError(); save.update({ disabled: false }); };

  const grid = el('div', 'kb-dialog-grid');
  dialog.append(grid);
  const titleWrap = el('div', 'kb-span2'); grid.append(titleWrap);
  const titleField = mountTextField(titleWrap, {
    label: 'Title', value: title,
    onChange: (value) => { title = value; markDirty(); titleField.update({ value }); },
  });
  const descWrap = el('div', 'kb-span2'); grid.append(descWrap);
  const descField = mountTextField(descWrap, {
    label: 'Description / agent prompt', value: description, multiline: true, rows: 6,
    helper: 'This is what the agent sees as its first message when you start a session.',
    onChange: (value) => { description = value; markDirty(); descField.update({ value }); },
  });
  const statusWrap = el('div'); grid.append(statusWrap);
  const statusField = mountSelect(statusWrap, {
    label: 'Status', value: status, options: statusOptions,
    onChange: (value) => { status = value as Task['status']; markDirty(); statusField.update({ value }); },
  });
  const projectWrap = el('div'); grid.append(projectWrap);
  const projectField = mountSelect(projectWrap, {
    label: 'Project', value: projectId || null, placeholder: 'No project',
    options: [{ id: '', label: 'No project' }, ...props.projects.map((p) => ({ id: p.id, label: p.name }))],
    searchable: props.projects.length > 6,
    onChange: (value) => {
      projectId = value; markDirty(); projectField.update({ value });
      refreshSessionPicker();
      refreshWorktreeOptions();
    },
  });
  const branchWrap = el('div', 'kb-span2'); grid.append(branchWrap);
  const branchField = mountTextField(branchWrap, {
    label: 'Source branch', value: sourceBranch, placeholder: 'main',
    onChange: (value) => { sourceBranch = value; markDirty(); branchField.update({ value }); },
  });

  const saveRow = el('div', 'kb-row'); dialog.append(saveRow);
  const save = mountButton(saveRow, {
    label: 'Save changes', disabled: !dirty,
    onClick: () => {
      void (async () => {
        busy = true; save.update({ loading: true });
        try {
          await props.onSave({ title, description, status, projectId: projectId || null, sourceBranch: sourceBranch || null });
          dirty = false; save.update({ disabled: true });
        } catch (error) { showError(error); }
        finally { busy = false; save.update({ loading: false }); }
      })();
    },
  });
  mountButton(saveRow, { label: 'Move to Review', variant: 'secondary', onClick: () => void quickStatus('review') });
  mountButton(saveRow, { label: 'Mark Done', variant: 'secondary', onClick: () => void quickStatus('done') });

  const quickStatus = async (next: Task['status']) => {
    if (busy) return;
    busy = true;
    try {
      await props.onSave({ status: next });
      status = next; statusField.update({ value: status });
      dirty = title !== props.task.title || description !== props.task.description || sourceBranch !== (props.task.sourceBranch ?? '') || projectId !== (props.task.projectId ?? '');
      save.update({ disabled: !dirty });
    } catch (error) { showError(error); }
    finally { busy = false; }
  };

  const sessionSection = el('div', 'kb-section'); dialog.append(sessionSection);
  sessionSection.append(el('div', 'kb-section-title', 'OpenCode session'));
  const sessionBody = el('div', 'kb-row'); sessionSection.append(sessionBody);

  // Shown only once a session is linked.
  const renderSessionBody = () => {
    sessionBody.replaceChildren();
    if (!props.task.sessionId) return;
    sessionBody.append(el('span', 'kb-mono', props.task.sessionId));
    mountButton(sessionBody, {
      label: 'Open Chat',
      onClick: () => { void props.onOpenChat(props.task.sessionId!).catch(showError); },
    });
    mountButton(sessionBody, {
      label: 'Unlink', variant: 'ghost',
      onClick: () => { void props.onUnlinkSession().catch(showError); },
    });
  };
  renderSessionBody();

  // --- Start Agent: shown only before a session is linked ---
  const startRoot = el('div');
  const pickerRoot = el('div');
  sessionSection.append(startRoot, pickerRoot);
  startRoot.hidden = hasSession;
  pickerRoot.hidden = hasSession;

  let worktreeDestination = DESTINATION_ROOT;
  let branchName = '';
  let baseBranchSelection = DEFAULT_BASE_BRANCH_OPTION;
  let customBaseBranch = '';
  let startBusy = false;
  let worktreeGeneration = 0;
  let refreshWorktreeOptions = () => {};
  /** Once you've touched "Based on" yourself, auto-switching stops overriding your choice. */
  let userTouchedBaseBranch = false;

  if (!hasSession) {
    startRoot.append(el('p', 'kb-muted', 'Starts a real OpenCode session with the description above as its first message, and links it to this task.'));
    const startGrid = el('div', 'kb-dialog-grid'); startRoot.append(startGrid);
    const destinationWrap = el('div'); startGrid.append(destinationWrap);
    const destinationSelect = mountSelect(destinationWrap, {
      label: 'Session directory', value: DESTINATION_ROOT, options: baseDestinationOptions,
      onChange: (value) => { worktreeDestination = value; destinationSelect.update({ value }); branchFieldsWrap.hidden = value !== DESTINATION_NEW; },
    });
    const branchFieldsWrap = el('div', 'kb-dialog-grid kb-span2'); startGrid.append(branchFieldsWrap);
    branchFieldsWrap.hidden = true;
    const branchNameField = mountTextField(branchFieldsWrap, {
      label: 'Branch & worktree name', value: '', placeholder: 'fix/login-redirect',
      helper: 'Used for both the new branch and the folder it checks out into.',
      onChange: (value) => { branchName = value; branchNameField.update({ value }); },
    });
    const baseBranchSelect = mountSelect(branchFieldsWrap, {
      label: 'Based on', value: DEFAULT_BASE_BRANCH_OPTION, options: defaultBaseBranchOptions,
      onChange: (value) => {
        userTouchedBaseBranch = true;
        baseBranchSelection = value; baseBranchSelect.update({ value });
        customBaseBranchField.update({ value: customBaseBranch });
        customBaseBranchWrap.hidden = value !== CUSTOM_BASE_BRANCH_OPTION;
      },
    });
    const baseBranchNote = el('p', 'kb-muted kb-span2');
    branchFieldsWrap.append(baseBranchNote);
    const customBaseBranchWrap = el('div', 'kb-span2'); branchFieldsWrap.append(customBaseBranchWrap);
    customBaseBranchWrap.hidden = true;
    const customBaseBranchField = mountTextField(customBaseBranchWrap, {
      label: 'Custom base branch', value: '', placeholder: 'release/2.0',
      onChange: (value) => { customBaseBranch = value; customBaseBranchField.update({ value }); },
    });
    const startRow = el('div', 'kb-row'); startRoot.append(startRow);
    const startButton = mountButton(startRow, {
      label: 'Start Agent',
      onClick: () => {
        void (async () => {
          if (startBusy) return;
          if (!projectId) { showError(new Error('Choose a project above first.')); return; }
          startBusy = true; startButton.update({ loading: true });
          try {
            const worktree = buildSessionWorktree(worktreeDestination, branchName, resolveBaseBranch(baseBranchSelection, customBaseBranch));
            await props.onStartAgent({ projectId, worktree });
          } catch (error) { showError(error); }
          finally { startBusy = false; startButton.update({ loading: false }); }
        })();
      },
    });

    const noKnownBranchesNote = 'No branches are visible to this extension yet (OpenChamber has no API to list all of them — only ones already checked out as a worktree). Type the branch you want.';
    baseBranchNote.textContent = '';
    refreshWorktreeOptions = () => {
      const generation = ++worktreeGeneration;
      destinationSelect.update({ value: worktreeDestination, options: baseDestinationOptions });
      baseBranchSelect.update({ value: baseBranchSelection, options: defaultBaseBranchOptions });
      if (!projectId) { baseBranchNote.textContent = ''; return; }
      void props.loadWorktreeInfo(projectId).then((info) => {
        if (generation !== worktreeGeneration) return;
        destinationSelect.update({ options: [...baseDestinationOptions, ...info.destinations.map((w) => ({ id: w.id, label: w.label, hint: w.hint, disabled: w.disabled }))] });
        baseBranchSelect.update({ options: info.baseBranches });
        if (!info.hasKnownBranches) {
          baseBranchNote.textContent = noKnownBranchesNote;
          if (!userTouchedBaseBranch) {
            baseBranchSelection = CUSTOM_BASE_BRANCH_OPTION;
            baseBranchSelect.update({ value: baseBranchSelection });
            customBaseBranchWrap.hidden = false;
          }
        } else {
          baseBranchNote.textContent = '';
        }
      }, (error) => { if (generation === worktreeGeneration) showError(error); });
    };
    refreshWorktreeOptions();
  }

  let picker: { dispose: () => void } | null = null;
  let pickerGeneration = 0;

  const renderPicker = () => {
    picker?.dispose(); picker = null;
    pickerRoot.replaceChildren();
    if (hasSession) return;
    if (!projectId) { pickerRoot.append(el('p', 'kb-muted', 'Or choose a project above to link an existing session instead.')); return; }
    pickerRoot.append(el('div', 'kb-section-title', 'Or link an existing session'));
    const generation = ++pickerGeneration;
    const list = mountList(pickerRoot, {
      ariaLabel: 'Sessions available to link',
      items: [], emptyText: 'Loading sessions…',
      onSelect: (id) => { void props.onLinkSession(id).catch(showError); },
    });
    picker = list;
    void props.loadSessionsForProject(projectId).then((sessions) => {
      if (generation !== pickerGeneration) return;
      list.update({
        items: sessions.map((s) => ({ id: s.id, title: s.title, subtitle: s.id, badge: { label: s.activity, tone: s.activity === 'running' ? 'info' : 'neutral' } })),
        emptyText: 'No sessions in this project yet.',
      });
    }, (error) => { if (generation === pickerGeneration) showError(error); });
  };
  const refreshSessionPicker = () => { renderPicker(); };
  renderPicker();

  const footer = el('div', 'kb-row between'); dialog.append(footer);
  const dangerRow = el('div', 'kb-row'); footer.append(dangerRow);
  let confirmingDelete = false;
  const deleteBtn = mountButton(dangerRow, {
    label: 'Delete task', variant: 'ghost',
    onClick: () => {
      if (!confirmingDelete) { confirmingDelete = true; deleteBtn.update({ label: 'Click again to delete', variant: 'destructive' }); return; }
      void props.onDelete().catch(showError);
    },
  });
  mountButton(footer, { label: 'Close', variant: 'outline', onClick: () => props.onClose() });

  const dispose = () => { document.removeEventListener('keydown', onKeydown); overlay.remove(); };
  return { dispose };
};
