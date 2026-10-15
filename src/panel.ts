import { connectHost } from '@openchamber/sdk';
import { applyHostReady, mountBadge, mountButton } from '@openchamber/sdk/ui';
import { loadTasks } from './store/taskStore.ts';
import { injectStyles } from './ui/styles.ts';
import { el } from './ui/dom.ts';

/**
 * The rail panel is narrow, so it stays a lightweight summary rather than a
 * second copy of the board; the full board lives on the full-screen page
 * (Extension pages menu), which is the primary surface for this extension.
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
  const wrap = el('div', 'kb-page');
  const openCount = el('p', '', 'Loading…');
  const head = el('div', 'kb-row between');
  head.append(el('h2', '', 'Kanban'));
  const badgeSlot = el('span');
  head.append(badgeSlot);
  wrap.append(head, openCount);
  wrap.append(el('p', 'kb-muted', 'Open the full board from the Extension pages menu above the session list to view, edit, and link tasks.'));
  root.append(wrap);
  const badge = mountBadge(badgeSlot, { label: '0', tone: 'neutral' });
  mountButton(wrap, {
    label: 'Refresh counts',
    variant: 'ghost',
    onClick: () => { void refresh(); },
  });

  const refresh = async () => {
    const { tasks } = await loadTasks(host);
    const open = tasks.filter((t) => t.status !== 'done').length;
    openCount.textContent = `${open} open task${open === 1 ? '' : 's'} of ${tasks.length} total.`;
    badge.update({ label: String(open) });
    void host.setBadge(open || null).catch(() => undefined);
  };
  void refresh();
});

window.addEventListener('pagehide', () => host.dispose());
