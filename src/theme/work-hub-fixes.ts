import { useAppStore } from '../stores/useAppStore';
import type { WorkChange, WorkChangeStatus, WorkProfile } from '../domain/work';

const styleId = 'still-work-hub-fixes';

if (!document.getElementById(styleId)) {
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
@media (max-width: 620px) {
  .work-hub-page input,
  .work-hub-page select,
  .work-hub-page textarea { font-size: 16px !important; }
}
.work-change-sheet-backdrop{position:fixed;inset:0;z-index:2500;background:rgba(46,39,57,.24);backdrop-filter:blur(12px);display:flex;align-items:flex-end;justify-content:center;padding:16px}
.work-change-sheet{width:min(100%,620px);max-height:min(82vh,760px);overflow:auto;padding:18px;border:1px solid rgba(93,78,119,.12);border-radius:28px;background:rgba(255,252,250,.98);box-shadow:0 24px 70px rgba(61,47,82,.2);color:var(--text-strong)}
.work-change-sheet-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.work-change-sheet-head h2{margin:0;font-family:var(--font-display);font-size:1.55rem}.work-change-sheet-close{width:38px;height:38px;border:0;border-radius:12px;background:rgba(113,94,168,.08);font-size:22px;color:#725eaa}
.work-change-sheet form{display:grid;gap:10px}.work-change-sheet input,.work-change-sheet select,.work-change-sheet textarea{width:100%;box-sizing:border-box;min-height:46px;padding:11px 12px;border:1px solid rgba(93,78,119,.13);border-radius:13px;background:rgba(255,255,255,.82);font:inherit;font-size:16px;color:inherit}.work-change-sheet textarea{min-height:92px;resize:vertical}.work-change-sheet-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.work-change-sheet-save{min-height:48px;border:0;border-radius:14px;background:rgba(113,94,168,.16);color:#665196;font-weight:850;font-size:16px}
@media(max-width:520px){.work-change-sheet-grid{grid-template-columns:1fr}}
`;
  document.head.appendChild(style);
}

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
    const form = new FormData(event.currentTarget);
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
