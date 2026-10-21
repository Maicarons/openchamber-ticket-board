import { connectHost } from '@openchamber/sdk';
import { applyHostReady } from '@openchamber/sdk/ui';
import { resolveLanguage } from './i18n.ts';
import { DEFAULT_PREFS, loadPrefs } from './store/prefs.ts';
import { mountTicketBoard } from './ui/ticketBoard.ts';

const host = connectHost();
const root = document.querySelector('#root');
if (!root) throw new Error('Missing #root');

let mounted: { dispose: () => void } | null = null;
let starting = false;
host.onReady((ctx) => {
  applyHostReady(ctx, document.documentElement);
  if (mounted || starting) return;
  starting = true;
  void loadPrefs(host)
    .catch(() => DEFAULT_PREFS)
    .then((prefs) => {
      if (mounted) return;
      mounted = mountTicketBoard(host, root, {
        locale: ctx.locale,
        language: resolveLanguage(prefs.language, ctx.locale),
        languagePreference: prefs.language,
      });
    })
    .finally(() => { starting = false; });
});

window.addEventListener('pagehide', () => {
  mounted?.dispose();
  host.dispose();
});
