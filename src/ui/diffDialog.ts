import { mountBanner, mountButton } from '@openchamber/sdk/ui';
import { translator, type Language } from '../i18n.ts';
import { el } from './dom.ts';

export type DiffDialogProps = {
  title: string;
  summary: string;
  diff: string;
  language: Language;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
};

/**
 * Every write goes through this. Nothing is saved until the person has seen
 * the exact unified diff the ticket file is about to receive.
 */
export const mountDiffDialog = (root: Element, props: DiffDialogProps) => {
  const t = translator(props.language);
  const overlay = el('div', 'kb-overlay');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  const dialog = el('div', 'kb-dialog kb-dialog-wide');
  overlay.append(dialog);
  root.append(overlay);

  const onKeydown = (event: KeyboardEvent) => { if (event.key === 'Escape') props.onCancel(); };
  overlay.addEventListener('click', (event) => { if (event.target === overlay) props.onCancel(); });
  document.addEventListener('keydown', onKeydown);

  const head = el('div', 'kb-row between');
  head.append(el('h2', '', props.title));
  dialog.append(head, el('p', 'kb-muted', props.summary));

  const lines = el('div', 'kb-diff');
  for (const line of props.diff.split('\n')) {
    const row = el('div', `kb-diff-line ${line.startsWith('+') && !line.startsWith('+++') ? 'kb-diff-add' : line.startsWith('-') && !line.startsWith('---') ? 'kb-diff-del' : line.startsWith('@@') ? 'kb-diff-hunk' : ''}`);
    row.textContent = line || ' ';
    lines.append(row);
  }
  dialog.append(lines);

  const errorSlot = el('div');
  errorSlot.hidden = true;
  const banner = mountBanner(errorSlot, { tone: 'error', title: '' });
  dialog.append(errorSlot);

  const footer = el('div', 'kb-row between');
  dialog.append(footer);
  mountButton(footer, { label: t('diff.cancel'), variant: 'outline', onClick: props.onCancel });
  const confirm = mountButton(footer, {
    label: props.confirmLabel ?? t('diff.write'),
    onClick: () => {
      void (async () => {
        confirm.update({ loading: true });
        try { await props.onConfirm(); }
        catch (error) {
          errorSlot.hidden = false;
          banner.update({
            tone: 'error',
            title: t('diff.couldNotWrite'),
            body: error instanceof Error ? error.message : String(error),
          });
        }
        finally { confirm.update({ loading: false }); }
      })();
    },
  });

  const dispose = () => {
    document.removeEventListener('keydown', onKeydown);
    overlay.remove();
  };
  return { dispose };
};
