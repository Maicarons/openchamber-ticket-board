import { connectHost, type GuestProject } from '@openchamber/sdk';
import { applyHostReady, mountBadge, mountButton, mountSpinner } from '@openchamber/sdk/ui';
import { boardTicketsFromFiles, columnOf, contextFiles, frontierPaths } from './domain/ticketBoard.ts';
import { loadPrefs } from './store/prefs.ts';
import { fetchTicketBundle } from './host/ticketService.ts';
import { watchProjects } from './host/workspace.ts';
import { injectStyles } from './ui/styles.ts';
import { el } from './ui/dom.ts';

/**
 * The rail panel is narrow, so it stays a summary: how many tickets are open
 * and what the next one is. The full board lives on the full-screen page.
 */
const host = connectHost();
const root = document.querySelector('#root');
if (!root) throw new Error('Missing #root');

let mounted = false;
host.onReady((ctx) => {
  applyHostReady(ctx, document.documentElement);
  if (mounted) return;
  mounted = true;
  injectStyles();
  root.replaceChildren();
  const wrap = el('div', 'kb-page kb-panel');
  const head = el('div', 'kb-row between');
  head.append(el('h2', '', 'Ticket board'));
  const badgeSlot = el('span');
  head.append(badgeSlot);
  const body = el('div', 'kb-panel-body', 'Loading…');
  wrap.append(head, body);
  wrap.append(el('p', 'kb-muted', 'Open the full board from the Extension pages menu above the session list to read tickets, change fields, and start agents.'));
  root.append(wrap);
  const badge = mountBadge(badgeSlot, { label: '–', tone: 'neutral' });
  const spinner = mountSpinner(wrap, { label: 'Reading tickets…' });

  let projects: GuestProject[] = [];
  let preferredProject = '';
  let lastRefresh = 0;

  const refresh = async () => {
    if (!projects.length) {
      body.textContent = 'No OpenChamber project is available yet.';
      badge.update({ label: '–' });
      return;
    }
    const project = projects.find((candidate) => candidate.id === preferredProject) ?? projects[0]!;
    preferredProject = project.id;
    const generation = ++lastRefresh;
    spinner.update({ label: 'Reading tickets…' });
    const bundle = await fetchTicketBundle(host, project.directory);
    if (generation !== lastRefresh) return;
    if (bundle.state !== 'ready') {
      body.textContent = bundle.state === 'unconfigured'
        ? `No .scratch ticket workflow in ${project.name}.`
        : 'Local ticket service unavailable. Approve it in Settings → Extensions.';
      badge.update({ label: '–', tone: 'neutral' });
      spinner.dispose();
      return;
    }
    const entries = boardTicketsFromFiles(bundle.files, project.id, project.directory, new Map(), bundle.triageLabels);
    const context = contextFiles(bundle.files, bundle.triageLabels);
    const open = entries.filter((entry) => columnOf(entry, entries, bundle.triageLabels) !== 'done').length;
    const next = [...frontierPaths(entries, bundle.triageLabels)][0];
    const nextEntry = entries.find((entry) => entry.ticket.path === next);
    body.replaceChildren();
    body.append(el('p', '', `${project.name}: ${open} open ticket${open === 1 ? '' : 's'} of ${entries.length}.`));
    body.append(el('p', 'kb-muted', nextEntry ? `Next: #${nextEntry.ticket.number ?? '–'} ${nextEntry.ticket.title}` : 'Nothing is ready for an agent.'));
    body.append(el('p', 'kb-muted', `${context.length} spec/map file${context.length === 1 ? '' : 's'} in this project.`));
    badge.update({ label: String(open), tone: open ? 'info' : 'neutral' });
    spinner.dispose();
  };

  let stopProjects: (() => void) | null = null;
  void loadPrefs(host).then((prefs) => { preferredProject = prefs.projectId; }).catch(() => undefined);
  void watchProjects(host, (snapshot) => {
    if (!snapshot.projects.length) return;
    projects = snapshot.projects;
    preferredProject = projects.some((project) => project.id === preferredProject) ? preferredProject : projects[0]!.id;
    void refresh();
  }).then((stop) => { stopProjects = stop; }, () => undefined);

  mountButton(wrap, { label: 'Refresh counts', variant: 'ghost', onClick: () => { void refresh(); } });
  void refresh();

  window.addEventListener('pagehide', () => { stopProjects?.(); }, { once: true });
});

window.addEventListener('pagehide', () => host.dispose());
