import { trapTabKey } from '../components/ui/dialogAccessibility';

let dirty = false;
let returnFocus: HTMLElement | null = null;
let pendingCloseTarget: HTMLElement | null = null;
let pendingToast = '';

const getSheet = () => document.querySelector<HTMLElement>('.task-sheet');
const getBackdrop = () => document.querySelector<HTMLElement>('.sheet-backdrop');

function toast(message: string) {
  document.querySelector('.still-toast')?.remove();
  const node = document.createElement('div');
  node.className = 'still-toast';
  node.setAttribute('role', 'status');
  node.textContent = `✓ ${message}`;
  document.body.appendChild(node);
  window.setTimeout(() => node.classList.add('is-visible'), 20);
  window.setTimeout(() => {
    node.classList.remove('is-visible');
    window.setTimeout(() => node.remove(), 220);
  }, 2200);
}

function closeDiscardDialog() {
  document.querySelector('.discard-confirm')?.remove();
  pendingCloseTarget = null;
}

function showDiscardDialog(target: HTMLElement) {
  if (document.querySelector('.discard-confirm')) return;
  pendingCloseTarget = target;
  const dialog = document.createElement('div');
  dialog.className = 'discard-confirm';
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.innerHTML = `
    <div><h3>Discard this draft?</h3><p>You have unsaved changes.</p></div>
    <div class="discard-confirm-actions">
      <button class="task-secondary-button" type="button" data-keep>Keep editing</button>
      <button class="discard-button" type="button" data-discard>Discard</button>
    </div>`;
  getSheet()?.appendChild(dialog);
  dialog.querySelector<HTMLElement>('[data-keep]')?.focus();
  dialog.querySelector('[data-keep]')?.addEventListener('click', closeDiscardDialog);
  dialog.querySelector('[data-discard]')?.addEventListener('click', () => {
    dirty = false;
    const closeTarget = pendingCloseTarget;
    closeDiscardDialog();
    closeTarget?.click();
  });
}

function inferToast(sheet: HTMLElement) {
  const title = sheet.querySelector('h2')?.textContent?.toLowerCase() ?? '';
  if (title.includes('task')) return title.includes('edit') ? 'Task updated' : 'Task added';
  if (title.includes('event')) return title.includes('edit') ? 'Event updated' : 'Event added';
  if (title.includes('expense')) return 'Expense logged';
  if (title.includes('journal') || title.includes('write')) return title.includes('edit') ? 'Journal updated' : 'Journal saved';
  if (title.includes('check-in')) return 'Check-in updated';
  return 'Saved';
}

function isCloseIntent(target: HTMLElement, event: MouseEvent) {
  const backdrop = getBackdrop();
  if (target === backdrop && event.target === backdrop) return true;
  if (target.closest('[aria-label="Close"]')) return true;
  if (target.closest('[aria-label="Back to quick add"]')) return true;
  const button = target.closest('button');
  return button?.textContent?.trim() === 'Cancel';
}

function onClickCapture(event: MouseEvent) {
  const target = event.target as HTMLElement;
  const sheet = getSheet();
  if (!sheet) return;

  if (isCloseIntent(target, event) && dirty) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    showDiscardDialog(target.closest('button') ?? getBackdrop() ?? target);
    return;
  }

  const submit = target.closest<HTMLButtonElement>('button[type="submit"]');
  if (submit && sheet.contains(submit)) pendingToast = inferToast(sheet);
}

function onInput(event: Event) {
  const sheet = getSheet();
  if (!sheet || !sheet.contains(event.target as Node)) return;
  if (sheet.querySelector('.quick-grid')) return;
  dirty = true;
}

function onSubmit(event: Event) {
  const form = event.target as HTMLFormElement;
  const sheet = getSheet();
  if (!sheet || !sheet.contains(form)) return;
  pendingToast = inferToast(sheet);
  dirty = false;
}

function onKeydown(event: KeyboardEvent) {
  const sheet = getSheet();
  if (!sheet) return;
  if (event.key === 'Escape' && dirty) {
    event.preventDefault();
    event.stopImmediatePropagation();
    showDiscardDialog(sheet.querySelector<HTMLElement>('[aria-label="Close"]') ?? sheet);
    return;
  }
  trapTabKey(event, sheet);
}

const observer = new MutationObserver(() => {
  const sheet = getSheet();
  if (sheet && !sheet.dataset.interactionsReady) {
    sheet.dataset.interactionsReady = 'true';
    dirty = false;
    returnFocus = document.activeElement as HTMLElement;
  }
  if (!sheet) {
    closeDiscardDialog();
    dirty = false;
    returnFocus?.focus?.();
    returnFocus = null;
    if (pendingToast) {
      const message = pendingToast;
      pendingToast = '';
      window.setTimeout(() => toast(message), 120);
    }
  }
});

observer.observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener('click', onClickCapture, true);
document.addEventListener('input', onInput, true);
document.addEventListener('change', onInput, true);
document.addEventListener('submit', onSubmit, true);
document.addEventListener('keydown', onKeydown, true);
