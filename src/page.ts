import { connectHost } from '@openchamber/sdk';
import { applyHostReady } from '@openchamber/sdk/ui';
import { mountTicketBoard } from './ui/ticketBoard.ts';

const host = connectHost();
const root = document.querySelector('#root');
if (!root) throw new Error('Missing #root');

let mounted: { dispose: () => void } | null = null;
host.onReady((ctx) => {
  applyHostReady(ctx, document.documentElement);
  if (mounted) return;
  mounted = mountTicketBoard(host, root);
});

window.addEventListener('pagehide', () => {
  mounted?.dispose();
  host.dispose();
});
