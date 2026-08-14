import { useAppStore } from '../stores/useAppStore';
import type { WorkChange, WorkChangeStatus, WorkProfile } from '../domain/work';

function workRouteFromDetails() {
  const path = window.location.pathname;
  return path.replace(/\/work\/details\/?$/, '/work');
}

function closeSheet() {
  document.querySelector('.work-change-sheet-backdrop')?.remove();
}

function openChangeSheet(existing?: WorkChange) {
  closeSheet();
  const backdrop = document.createElement('div');
  backdrop.className = 'work-change-sheet-backdrop';
  const sheet = document.createElement('section');
  sheet.className = 'work-change-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', existing ? 'Edit change' : 'Add change');
  sheet.innerHTML = `
    <div class="work-change-sheet-head"><h2>${existing ? 'Edit change' : 'Add change'}</h2><button class="work-change-sheet-close" type="button" aria-label="Close">×</button></div>
    <form>
      <div class="work-change-sheet-grid">
        <input name="reference" placeholder="CHG number" value="${escapeHtml(existing?.reference ?? '')}">
        <select name="status" aria-label="Change status">
          ${(['planned','in_progress','testing','ready','completed','cancelled'] as WorkChangeStatus[]).map((status) => `<option value="${status}"${existing?.status === status ? ' selected' : ''}>${status.replace('_',' ')}</option>`).join('')}
        </select>
      </div>
      <input name="title" required placeholder="What are you changing?" value="${escapeHtml(existing?.title ?? '')}">
      <div class="work-change-sheet-grid">
        <input name="system" placeholder="System / SID" value="${escapeHtml(existing?.system ?? '')}">
        <input name="environment" placeholder="Environment (DEV / QA / PRD)" value="${escapeHtml(existing?.environment ?? '')}">
      </div>
      <input name="plannedDate" type="date" aria-label="Planned date" value="${escapeHtml(existing?.plannedDate ?? '')}">
      <textarea name="note" placeholder="Steps, validation, rollback, handover…">${escapeHtml(existing?.note ?? '')}</textarea>
      <button class="work-change-sheet-save" type="submit">Save change</button>
    </form>`;
  backdrop.appendChild(sheet);
  document.body.appendChild(backdrop);

  const close = () => closeSheet();
  sheet.querySelector<HTMLButtonElement>('.work-change-sheet-close')?.addEventListener('click', close);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
  sheet.querySelector<HTMLFormElement>('form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formElement = event.currentTarget as HTMLFormElement;
    const form = new FormData(formElement);
    const title = String(form.get('title') ?? '').trim();
    if (!title) return;
    const state = useAppStore.getState();
    const profile = state.workProfile;
    const changes = profile.changes ?? [];
    const item: WorkChange = {
      id: existing?.id ?? createId(),
      reference: clean(form.get('reference')),
      title,
      system: clean(form.get('system')),
      environment: clean(form.get('environment')),
      status: String(form.get('status') ?? 'planned') as WorkChangeStatus,
      plannedDate: clean(form.get('plannedDate')),
      note: clean(form.get('note')),
    };
    state.updateWorkProfile({ ...profile, changes: [item, ...changes.filter((change) => change.id !== item.id)] } as WorkProfile);
    close();
  });
}

function clean(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim();
  return text || undefined;
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `change-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}

function findChangesSection(target: Element) {
  const section = target.closest('.work-section');
  if (!section) return null;
  const heading = section.querySelector('h2')?.textContent?.trim();
  return heading === 'Changes' ? section : null;
}

document.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;

  if (/\/work\/details\/?$/.test(window.location.pathname)) {
    const back = target.closest('.still-work-header button[aria-label="Back home"]');
    if (back) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.history.pushState({}, '', workRouteFromDetails());
      window.dispatchEvent(new PopStateEvent('popstate'));
      return;
    }
  }

  if (!/\/work\/?$/.test(window.location.pathname)) return;
  const button = target.closest('button');
  if (!button) return;
  const section = findChangesSection(button);
  if (!section) return;

  const headingButton = button.closest('.work-section-head > button');
  const recordButton = button.classList.contains('work-record') ? button : button.closest('.work-record');
  if (!headingButton && !recordButton) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  if (headingButton) {
    openChangeSheet();
    return;
  }

  const state = useAppStore.getState();
  const text = recordButton?.querySelector('strong')?.textContent?.trim() ?? '';
  const existing = (state.workProfile.changes ?? []).find((change) => {
    const label = `${change.reference ? `${change.reference} · ` : ''}${change.title}`;
    return label === text;
  });
  openChangeSheet(existing);
}, true);
