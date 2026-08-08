import { focusFirst, setDialogSemantics, trapTabKey } from '../components/ui/dialogAccessibility';

let activeDialog: HTMLElement | null = null;
let returnFocus: HTMLElement | null = null;

function getDialog() {
  return document.querySelector<HTMLElement>('.still-work-modal');
}

function enhance(dialog: HTMLElement) {
  if (dialog.dataset.a11yReady === 'true') return;
  dialog.dataset.a11yReady = 'true';
  setDialogSemantics(dialog, dialog.querySelector('h2')?.textContent?.trim() || 'Shift editor');
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  activeDialog = dialog;
  window.setTimeout(() => focusFirst(dialog), 0);
}

function restore() {
  if (activeDialog && document.contains(activeDialog)) return;
  if (!activeDialog) return;
  activeDialog = null;
  const target = returnFocus;
  returnFocus = null;
  window.setTimeout(() => target?.focus?.(), 0);
}

const observer = new MutationObserver(() => {
  const dialog = getDialog();
  if (dialog) enhance(dialog);
  else restore();
});

observer.observe(document.documentElement, { childList: true, subtree: true });

document.addEventListener('keydown', (event) => {
  const dialog = getDialog();
  if (!dialog) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    dialog.querySelector<HTMLButtonElement>('[aria-label="Close"]')?.click();
    return;
  }
  trapTabKey(event, dialog);
}, true);
