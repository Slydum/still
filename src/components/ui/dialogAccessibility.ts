const focusableSelector = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function focusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector))
    .filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true');
}

export function focusFirst(container: HTMLElement) {
  const preferred = container.querySelector<HTMLElement>('[data-autofocus]');
  const target = preferred ?? focusableElements(container)[0] ?? container;
  if (!container.hasAttribute('tabindex') && target === container) container.tabIndex = -1;
  target.focus();
}

export function trapTabKey(event: KeyboardEvent, container: HTMLElement) {
  if (event.key !== 'Tab') return false;
  const focusable = focusableElements(container);
  if (!focusable.length) {
    event.preventDefault();
    container.focus();
    return true;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && (document.activeElement === last || !container.contains(document.activeElement))) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}

export function setDialogSemantics(dialog: HTMLElement, label?: string) {
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  if (label && !dialog.hasAttribute('aria-label') && !dialog.hasAttribute('aria-labelledby')) {
    dialog.setAttribute('aria-label', label);
  }
}
