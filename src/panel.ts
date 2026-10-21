import { connectHost, type GuestProject } from '@openchamber/sdk';
import { applyHostReady, mountBadge, mountButton, mountSpinner } from '@openchamber/sdk/ui';
import { boardTicketsFromFiles, columnOf, contextFiles, frontierPaths } from './domain/ticketBoard.ts';
import { translator, resolveLanguage } from './i18n.ts';
import { DEFAULT_PREFS, loadPrefs } from './store/prefs.ts';
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
host.onReady(async (ctx) => {
  applyHostReady(ctx, document.documentElement);
  if (mounted) return;
  mounted = true;
  const prefs = await loadPrefs(host).catch(() => DEFAULT_PREFS);
  const language = resolveLanguage(prefs.language, ctx.locale);
  const t = translator(language);
  injectStyles();
  root.replaceChildren();
  const wrap = el('div', 'kb-page kb-panel');
  const head = el('div', 'kb-row between');
  head.append(el('h2', '', t('panel.title')));
  const badgeSlot = el('span');
  head.append(badgeSlot);
  const body = el('div', 'kb-panel-body', t('panel.loading'));
  wrap.append(head, body);
  wrap.append(el('p', 'kb-muted', t('panel.help')));
  root.append(wrap);
  const badge = mountBadge(badgeSlot, { label: '–', tone: 'neutral' });
  const spinner = mountSpinner(wrap, { label: t('panel.reading') });

  let projects: GuestProject[] = [];
  let preferredProject = prefs.projectId;
  let lastRefresh = 0;

  const refresh = async () => {
    if (!projects.length) {
      body.textContent = t('panel.noProject');
      badge.update({ label: '–' });
      return;
    }
    const project = projects.find((candidate) => candidate.id === preferredProject) ?? projects[0]!;
    preferredProject = project.id;
    const generation = ++lastRefresh;
    spinner.update({ label: t('panel.reading') });
    const bundle = await fetchTicketBundle(host, project.directory, language);
    if (generation !== lastRefresh) return;
    if (bundle.state !== 'ready') {
      body.textContent = bundle.state === 'unconfigured'
        ? t('panel.noWorkflow', { project: project.name })
        : t('panel.serviceUnavailable');
      badge.update({ label: '–', tone: 'neutral' });
      spinner.dispose();
      return;
    }
    const entries = boardTicketsFromFiles(
      bundle.files,
      project.id,
      project.directory,
      new Map(),
      bundle.triageLabels,
      language,
    );
    const context = contextFiles(bundle.files, bundle.triageLabels, language);
    const open = entries.filter((entry) => columnOf(entry, entries, bundle.triageLabels) !== 'done').length;
    const next = [...frontierPaths(entries, bundle.triageLabels)][0];
    const nextEntry = entries.find((entry) => entry.ticket.path === next);
    body.replaceChildren();
    body.append(el('p', '', t('panel.summary', {
      project: project.name,
      open,
      total: entries.length,
      tickets: t(entries.length === 1 ? 'common.ticket.one' : 'common.ticket.many'),
    })));
    body.append(el('p', 'kb-muted', nextEntry
      ? t('panel.next', { number: nextEntry.ticket.number ?? '–', title: nextEntry.ticket.title })
      : t('panel.nothingReady')));
    body.append(el('p', 'kb-muted', t('panel.context', {
      count: context.length,
      files: t(context.length === 1 ? 'common.file.one' : 'common.file.many'),
    })));
    badge.update({ label: String(open), tone: open ? 'info' : 'neutral' });
    spinner.dispose();
  };

  let stopProjects: (() => void) | null = null;
  void watchProjects(host, (snapshot) => {
    if (!snapshot.projects.length) return;
    projects = snapshot.projects;
    preferredProject = projects.some((project) => project.id === preferredProject) ? preferredProject : projects[0]!.id;
    void refresh();
  }).then((stop) => { stopProjects = stop; }, () => undefined);

  mountButton(wrap, { label: t('panel.refresh'), variant: 'ghost', onClick: () => { void refresh(); } });
  void refresh();

  window.addEventListener('pagehide', () => { stopProjects?.(); }, { once: true });
});

window.addEventListener('pagehide', () => host.dispose());
