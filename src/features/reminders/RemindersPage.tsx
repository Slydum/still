import {
  ArrowLeft,
  Bell,
  BellOff,
  CalendarClock,
  Check,
  Link2,
  Pencil,
  Plus,
  Repeat2,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../../components/navigation/useBackNavigation';
import { attachmentFromEntry, isAttachmentEntry } from '../../domain/attachments';
import { goalFromEntry, isGoalEntry } from '../../domain/goals';
import {
  nextReminderOccurrence,
  reminderFromEntry,
  reminderJournalInput,
  reminderRepeatLabel,
  type ReminderDraft,
  type ReminderRecord,
  type ReminderRepeat,
  type ReminderTarget,
} from '../../domain/reminders';
import { useAppStore } from '../../stores/useAppStore';
import { getLocalDateKey } from '../../theme/stillContext';
import './reminders.css';

type SupplementState = {
  moneyBills?: Array<{ id: string; title: string; dueDay?: number }>;
  moneySavingsGoals?: Array<{ id: string; title: string }>;
  healthRoutines?: Array<{ id: string; title: string }>;
};

type TargetOption = ReminderTarget & { detail: string };

type FormState = {
  id?: string;
  title: string;
  note: string;
  date: string;
  time: string;
  repeat: ReminderRepeat;
  targetKey: string;
};

function localDateTimeParts(timestamp: number) {
  const date = new Date(timestamp);
  const dateKey = getLocalDateKey(date);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return { date: dateKey, time: `${hours}:${minutes}` };
}

function initialForm(reminder?: ReminderRecord): FormState {
  const source = reminder ? localDateTimeParts(reminder.remindAt) : { date: getLocalDateKey(), time: '09:00' };
  return {
    id: reminder?.id,
    title: reminder?.title ?? '',
    note: reminder?.note ?? '',
    date: source.date,
    time: source.time,
    repeat: reminder?.repeat ?? 'none',
    targetKey: reminder?.target ? `${reminder.target.kind}:${reminder.target.id}` : '',
  };
}

function reminderTimeLabel(reminder: ReminderRecord, now: Date) {
  const next = nextReminderOccurrence(reminder, now);
  if (!next) return reminder.active ? 'Past' : 'Paused';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: next.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    hour: 'numeric',
    minute: '2-digit',
  }).format(next);
}

export function RemindersPage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/notifications');
  const journalEntries = useAppStore((state) => state.journalEntries);
  const tasks = useAppStore((state) => state.tasks);
  const events = useAppStore((state) => state.events);
  const expenses = useAppStore((state) => state.expenses);
  const workShifts = useAppStore((state) => state.workShifts);
  const addJournalEntry = useAppStore((state) => state.addJournalEntry);
  const updateJournalEntry = useAppStore((state) => state.updateJournalEntry);
  const deleteJournalEntry = useAppStore((state) => state.deleteJournalEntry);
  const notificationsEnabled = useAppStore((state) => state.notificationsEnabled);
  const setNotificationsEnabled = useAppStore((state) => state.setNotificationsEnabled);
  const moneyBills = useAppStore((state) => (state as unknown as SupplementState).moneyBills ?? []);
  const savingsGoals = useAppStore((state) => (state as unknown as SupplementState).moneySavingsGoals ?? []);
  const healthRoutines = useAppStore((state) => (state as unknown as SupplementState).healthRoutines ?? []);
  const [form, setForm] = useState<FormState>();
  const [notice, setNotice] = useState('');
  const now = new Date();

  const reminders = useMemo(() => journalEntries
    .map(reminderFromEntry)
    .filter((item): item is ReminderRecord => Boolean(item))
    .sort((left, right) => {
      const leftNext = nextReminderOccurrence(left, now)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightNext = nextReminderOccurrence(right, now)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (left.active !== right.active) return left.active ? -1 : 1;
      return leftNext - rightNext || right.updatedAt - left.updatedAt;
    }), [journalEntries]);

  const targetOptions = useMemo<TargetOption[]>(() => {
    const options: TargetOption[] = [];
    tasks.forEach((task) => options.push({ kind: 'task', id: task.id, title: task.title, route: '/tasks', detail: task.completed ? 'Completed task' : 'Task' }));
    events.forEach((event) => options.push({ kind: 'event', id: event.id, title: event.title, route: '/calendar', detail: 'Calendar event' }));
    expenses.forEach((expense) => options.push({ kind: 'transaction', id: expense.id, title: expense.title, route: '/money', detail: 'Money transaction' }));
    workShifts.forEach((shift) => options.push({ kind: 'shift', id: shift.id, title: shift.note?.trim() || 'Work shift', route: '/work', detail: new Date(shift.startedAt).toLocaleDateString() }));
    moneyBills.forEach((bill) => options.push({ kind: 'bill', id: bill.id, title: bill.title, route: '/money', detail: bill.dueDay ? `Bill · due day ${bill.dueDay}` : 'Bill' }));
    savingsGoals.forEach((goal) => options.push({ kind: 'savings-goal', id: goal.id, title: goal.title, route: '/money', detail: 'Savings goal' }));
    healthRoutines.forEach((routine) => options.push({ kind: 'health-routine', id: routine.id, title: routine.title, route: '/health', detail: 'Health routine' }));

    journalEntries.forEach((entry) => {
      if (isGoalEntry(entry)) {
        const goal = goalFromEntry(entry);
        if (goal) options.push({ kind: 'goal', id: goal.id, title: goal.title, route: `/goals?goal=${encodeURIComponent(goal.id)}`, detail: 'Life goal' });
        return;
      }
      if (isAttachmentEntry(entry) || reminderFromEntry(entry) || attachmentFromEntry(entry)) return;
      if (entry.tags.includes('love-person')) {
        options.push({ kind: 'person', id: entry.id, title: entry.title || 'Someone important', route: '/life/love', detail: 'Relationship' });
        return;
      }
      if (entry.tags.includes('health-note') || entry.tags.includes('love-checkin')) return;
      options.push({ kind: 'journal', id: entry.id, title: entry.title || 'Untitled reflection', route: '/today', detail: 'Journal entry' });
    });

    return options.sort((a, b) => a.detail.localeCompare(b.detail) || a.title.localeCompare(b.title));
  }, [events, expenses, healthRoutines, journalEntries, moneyBills, savingsGoals, tasks, workShifts]);

  const requestNotifications = async () => {
    if (!('Notification' in window)) {
      setNotice('This browser does not support notifications. Reminders will still stay in Still.');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === 'granted');
    setNotice(permission === 'granted'
      ? 'Notifications are on.'
      : 'Notifications are not allowed. Your reminders will still be saved here.');
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!form?.title.trim() || !form.date || !form.time) return;
    const remindAt = new Date(`${form.date}T${form.time}:00`).getTime();
    if (!Number.isFinite(remindAt)) return;
    const target = targetOptions.find((option) => `${option.kind}:${option.id}` === form.targetKey);
    const draft: ReminderDraft = {
      title: form.title,
      note: form.note,
      remindAt,
      repeat: form.repeat,
      active: true,
      target: target ? { kind: target.kind, id: target.id, title: target.title, route: target.route } : undefined,
    };
    if (form.id) updateJournalEntry(form.id, reminderJournalInput(draft));
    else addJournalEntry(reminderJournalInput(draft));
    setForm(undefined);
  };

  const toggleActive = (reminder: ReminderRecord) => {
    updateJournalEntry(reminder.id, reminderJournalInput({
      title: reminder.title,
      note: reminder.note,
      remindAt: reminder.remindAt,
      repeat: reminder.repeat,
      target: reminder.target,
      active: !reminder.active,
    }));
  };

  return (
    <main className="shell reminders-page">
      <header className="reminders-header">
        <button className="btn-icon" onClick={goBack} type="button" aria-label="Go back"><ArrowLeft size={20} /></button>
        <div><p className="section-kicker">Bring it back later</p><h1>Reminders</h1><p className="subtle">A reminder can stand alone or point back to something already in Still.</p></div>
        <button className="btn" onClick={() => setForm(initialForm())} type="button"><Plus size={17} /> Add reminder</button>
      </header>

      <section className={`reminder-permission-card ${notificationsEnabled ? 'is-on' : ''}`}>
        <span>{notificationsEnabled ? <Bell size={19} /> : <BellOff size={19} />}</span>
        <div><strong>{notificationsEnabled ? 'Notifications are on' : 'Saved reminders, quiet device'}</strong><p>{notificationsEnabled ? 'Still can surface due reminders when the app is active or resumes.' : 'Turn on notifications if you want Still to surface reminders outside this list.'}</p></div>
        {!notificationsEnabled && <button onClick={() => void requestNotifications()} type="button">Turn on</button>}
      </section>
      {notice && <p className="reminder-notice" role="status">{notice}</p>}

      {reminders.length === 0 ? (
        <button className="reminders-empty" onClick={() => setForm(initialForm())} type="button">
          <CalendarClock size={28} /><strong>Nothing waiting for later.</strong><span>Add a date and time when something deserves to come back.</span>
        </button>
      ) : (
        <section className="reminders-list" aria-label="Saved reminders">
          {reminders.map((reminder) => (
            <article className={`card reminder-card${reminder.active ? '' : ' is-paused'}`} key={reminder.id}>
              <span className="reminder-card-icon"><CalendarClock size={18} /></span>
              <div className="reminder-card-copy">
                <div><strong>{reminder.title}</strong><span>{reminderTimeLabel(reminder, now)}</span></div>
                <p>{reminder.note || (reminder.target ? `Related to ${reminder.target.title}` : 'No extra note')}</p>
                <div className="reminder-meta">
                  <span><Repeat2 size={13} /> {reminderRepeatLabel(reminder.repeat)}</span>
                  {reminder.target && <button onClick={() => navigate(reminder.target!.route)} type="button"><Link2 size={13} /> {reminder.target.title}</button>}
                </div>
              </div>
              <div className="reminder-card-actions">
                <button className="btn-icon" onClick={() => setForm(initialForm(reminder))} type="button" aria-label={`Edit ${reminder.title}`}><Pencil size={15} /></button>
                <button className="btn-icon" onClick={() => toggleActive(reminder)} type="button" aria-label={reminder.active ? `Pause ${reminder.title}` : `Reactivate ${reminder.title}`}><Check size={15} /></button>
                <button className="btn-icon" onClick={() => { if (window.confirm(`Delete reminder “${reminder.title}”?`)) deleteJournalEntry(reminder.id); }} type="button" aria-label={`Delete ${reminder.title}`}><Trash2 size={15} /></button>
              </div>
            </article>
          ))}
        </section>
      )}

      <button className="reminder-attachments-link" onClick={() => navigate('/attachments')} type="button">
        <Link2 size={17} /><span><strong>Photos, receipts, and files</strong><small>Attach lightweight context to journal entries and Money transactions.</small></span>
      </button>

      {form && (
        <div className="reminder-dialog-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setForm(undefined); }}>
          <section className="reminder-dialog" role="dialog" aria-modal="true" aria-labelledby="reminder-form-title">
            <header><div><p className="section-kicker">Bring it back</p><h2 id="reminder-form-title">{form.id ? 'Edit reminder' : 'New reminder'}</h2></div><button className="btn-icon" onClick={() => setForm(undefined)} type="button" aria-label="Close"><X size={18} /></button></header>
            <form onSubmit={save}>
              <label><span>Reminder</span><input autoFocus maxLength={120} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="What should come back?" required value={form.title} /></label>
              <div className="reminder-form-row">
                <label><span>Date</span><input onChange={(event) => setForm({ ...form, date: event.target.value })} required type="date" value={form.date} /></label>
                <label><span>Time</span><input onChange={(event) => setForm({ ...form, time: event.target.value })} required type="time" value={form.time} /></label>
              </div>
              <label><span>Repeat</span><select onChange={(event) => setForm({ ...form, repeat: event.target.value as ReminderRepeat })} value={form.repeat}><option value="none">Once</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label>
              <label><span>Related to <small>(optional)</small></span><select onChange={(event) => setForm({ ...form, targetKey: event.target.value })} value={form.targetKey}><option value="">Nothing specific</option>{targetOptions.map((target) => <option key={`${target.kind}:${target.id}`} value={`${target.kind}:${target.id}`}>{target.detail} · {target.title}</option>)}</select></label>
              <label><span>Note <small>(optional)</small></span><textarea maxLength={500} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Anything useful when this comes back" rows={3} value={form.note} /></label>
              <div className="reminder-dialog-actions"><button className="task-secondary-button" onClick={() => setForm(undefined)} type="button">Cancel</button><button className="task-primary-button" disabled={!form.title.trim()} type="submit">Save reminder</button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
