import {
  ArrowLeft,
  BellRing,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  Coffee,
  Eye,
  EyeOff,
  LogIn,
  LogOut,
  Pencil,
  Pin,
  Plus,
  Save,
  Settings2,
  StickyNote,
  Trash2,
  UserRound,
  Wrench,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  effectiveHourlyRate,
  nextPayday,
  normalizedWorkSchedule,
  overtimeHours,
  payPeriodEstimate,
  shiftEarnings,
  workedHours,
  type WorkChange,
  type WorkContact,
  type WorkNote,
  type WorkProfile,
  type WorkShift,
  type WorkShiftInput,
  type WorkTimeOff,
} from '../../domain/work';
import { useAppStore } from '../../stores/useAppStore';

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function currency(value: number, code: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: code, maximumFractionDigits: 2 })
    .format(Number.isFinite(value) ? value : 0);
}

function durationLabel(hours: number) {
  const totalMinutes = Math.max(0, Math.floor(hours * 60));
  return `${Math.floor(totalMinutes / 60)}h ${String(totalMinutes % 60).padStart(2, '0')}m`;
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateLabel(value?: string) {
  if (!value) return 'No date';
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function localDateTime(timestamp: number) {
  const date = new Date(timestamp);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(timestamp - offset).toISOString().slice(0, 16);
}

function dateTimeValue(date: Date, time: string) {
  return new Date(`${dateKey(date)}T${time}`).getTime();
}

function scheduleForDate(profile: WorkProfile, date: Date) {
  const override = profile.scheduleOverrides?.find((item) => item.date === dateKey(date));
  if (override) return override;
  return normalizedWorkSchedule(profile).find((item) => item.day === date.getDay());
}

function nextScheduledShift(profile: WorkProfile) {
  const now = new Date();
  for (let offset = 0; offset < 62; offset += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() + offset);
    const schedule = scheduleForDate(profile, date);
    if (!schedule?.enabled) continue;
    if (offset === 0 && dateTimeValue(date, schedule.end) < now.getTime()) continue;
    return { date, start: schedule.start, end: schedule.end };
  }
  return undefined;
}

function initialShiftDraft(profile: WorkProfile, shift?: WorkShift): WorkShiftInput {
  if (shift) {
    return {
      startedAt: shift.startedAt,
      endedAt: shift.endedAt ?? Date.now(),
      unpaidBreakMinutes: shift.unpaidBreakMinutes,
      note: shift.note,
    };
  }
  const date = new Date();
  const schedule = scheduleForDate(profile, date);
  return {
    startedAt: dateTimeValue(date, schedule?.start ?? profile.shiftStart),
    endedAt: dateTimeValue(date, schedule?.end ?? profile.shiftEnd),
    unpaidBreakMinutes: profile.unpaidBreakMinutes,
    note: '',
  };
}

function createWorkId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const statusLabel: Record<WorkChange['status'], string> = {
  planned: 'Planned',
  in_progress: 'In progress',
  testing: 'Testing',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function WorkPage() {
  const navigate = useNavigate();
  const profile = useAppStore((state) => state.workProfile);
  const shifts = useAppStore((state) => state.workShifts);
  const tasks = useAppStore((state) => state.tasks);
  const events = useAppStore((state) => state.events);
  const journalEntries = useAppStore((state) => state.journalEntries);
  const privacyBlur = useAppStore((state) => state.workPrivacyBlur);
  const updateProfile = useAppStore((state) => state.updateWorkProfile);
  const startShift = useAppStore((state) => state.startWorkShift);
  const endShift = useAppStore((state) => state.endWorkShift);
  const toggleBreak = useAppStore((state) => state.toggleWorkBreak);
  const addShift = useAppStore((state) => state.addWorkShift);
  const updateShift = useAppStore((state) => state.updateWorkShift);
  const deleteShift = useAppStore((state) => state.deleteWorkShift);
  const setPrivacyBlur = useAppStore((state) => state.setWorkPrivacyBlur);
  const addTask = useAppStore((state) => state.addTask);
  const toggleTask = useAppStore((state) => state.toggleTask);
  const openTaskEditor = useAppStore((state) => state.openTaskEditor);
  const openEventEditor = useAppStore((state) => state.openEventEditor);
  const openJournalEditor = useAppStore((state) => state.openJournalEditor);

  const [draft, setDraft] = useState<WorkProfile>({
    ...profile,
    weeklySchedule: normalizedWorkSchedule(profile),
    scheduleOverrides: profile.scheduleOverrides ?? [],
    changes: profile.changes ?? [],
    notes: profile.notes ?? [],
    timeOff: profile.timeOff ?? [],
    contacts: profile.contacts ?? [],
    responsibilities: profile.responsibilities ?? [],
  });
  const [saved, setSaved] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [quickTask, setQuickTask] = useState('');
  const [quickNote, setQuickNote] = useState('');
  const [changeDraft, setChangeDraft] = useState<WorkChange>();
  const [noteDraft, setNoteDraft] = useState<WorkNote>();
  const [timeOffDraft, setTimeOffDraft] = useState<WorkTimeOff>();
  const [contactDraft, setContactDraft] = useState<WorkContact>();
  const [editingShift, setEditingShift] = useState<{ id?: string; value: WorkShiftInput }>();
  const [shiftError, setShiftError] = useState('');

  const activeShift = shifts.find((shift) => !shift.endedAt);
  const onBreak = Boolean(activeShift?.breakStartedAt);

  useEffect(() => {
    if (!activeShift) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [activeShift]);

  const today = new Date();
  const todayKey = dateKey(today);
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() - ((todayStart.getDay() + 6) % 7));

  const todayShifts = shifts.filter((shift) => shift.startedAt >= todayStart.getTime());
  const weekShifts = shifts.filter((shift) => shift.startedAt >= weekStart.getTime());
  const earnedToday = todayShifts.reduce((total, shift) => total + (shift.endedAt && shift.expectedEarnings !== undefined ? shift.expectedEarnings : shiftEarnings(shift, profile, now)), 0);
  const workedToday = todayShifts.reduce((total, shift) => total + workedHours(shift, now), 0);
  const weekHours = weekShifts.reduce((total, shift) => total + workedHours(shift, now), 0);
  const weekOvertime = weekShifts.reduce((total, shift) => total + overtimeHours(shift, profile, now), 0);
  const weekEarnings = weekShifts.reduce((total, shift) => total + (shift.endedAt && shift.expectedEarnings !== undefined ? shift.expectedEarnings : shiftEarnings(shift, profile, now)), 0);
  const completedWeekShifts = weekShifts.filter((shift) => shift.endedAt);
  const weeklyProgress = Math.min(100, Math.round((weekHours / Math.max(1, profile.weeklyHours)) * 100));

  const payday = useMemo(() => nextPayday(profile), [profile]);
  const periodEstimate = useMemo(() => payPeriodEstimate(profile), [profile]);
  const nextShift = useMemo(() => nextScheduledShift(profile), [profile]);
  const recentShifts = useMemo(() => [...shifts].sort((a, b) => b.startedAt - a.startedAt).slice(0, 6), [shifts]);

  const workTasks = useMemo(() => tasks
    .filter((task) => task.areaId === 'work')
    .sort((a, b) => Number(a.completed) - Number(b.completed) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')), [tasks]);
  const openWorkTasks = workTasks.filter((task) => !task.completed);
  const workEvents = useMemo(() => events
    .filter((event) => event.areaId === 'work' || event.category === 'work')
    .filter((event) => event.endDate >= todayKey)
    .sort((a, b) => `${a.startDate}${a.startTime ?? ''}`.localeCompare(`${b.startDate}${b.startTime ?? ''}`))
    .slice(0, 4), [events, todayKey]);
  const workReflections = useMemo(() => journalEntries
    .filter((entry) => entry.areaId === 'work')
    .sort((a, b) => b.entryDate.localeCompare(a.entryDate) || b.updatedAt - a.updatedAt)
    .slice(0, 3), [journalEntries]);

  const changes = profile.changes ?? [];
  const openChanges = changes
    .filter((change) => change.status !== 'completed' && change.status !== 'cancelled')
    .sort((a, b) => (a.plannedDate ?? '9999').localeCompare(b.plannedDate ?? '9999'));
  const notes = [...(profile.notes ?? [])]
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.createdAt - a.createdAt);
  const reminders = notes.filter((note) => note.kind === 'reminder' && note.reminderDate && note.reminderDate >= todayKey);
  const timeOff = profile.timeOff ?? [];
  const usedPto = timeOff.filter((item) => item.status === 'taken').reduce((total, item) => total + item.hours, 0);
  const ptoBalance = Math.max(0, (profile.ptoAllowanceHours ?? 0) - usedPto);

  const todaySchedule = scheduleForDate(profile, today);
  const todayStartAt = todaySchedule?.enabled ? dateTimeValue(today, todaySchedule.start) : undefined;
  const todayEndAt = todaySchedule?.enabled ? dateTimeValue(today, todaySchedule.end) : undefined;
  const liveLabel = activeShift
    ? (onBreak ? 'On break' : 'Working now')
    : !todaySchedule?.enabled
      ? 'Day off'
      : workedToday > 0 && todayEndAt && now >= todayEndAt
        ? 'Workday complete'
        : todayStartAt && now < todayStartAt
          ? `Starts ${todaySchedule.start}`
          : 'Ready when you are';
  const liveHeadline = activeShift
    ? durationLabel(workedHours(activeShift, now))
    : workedToday > 0
      ? durationLabel(workedToday)
      : nextShift
        ? nextShift.date.toLocaleDateString(undefined, { weekday: 'long' })
        : 'No shift planned';

  const commitProfile = (patch: Partial<WorkProfile>) => {
    const current = useAppStore.getState().workProfile;
    const next = { ...current, ...patch };
    updateProfile(next);
    setDraft((value) => ({ ...value, ...patch }));
  };

  const saveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const schedule = draft.weeklySchedule ?? normalizedWorkSchedule(draft);
    const normalized: WorkProfile = {
      ...draft,
      hourlyRate: Math.max(0, Number(draft.hourlyRate) || 0),
      annualSalary: Math.max(0, Number(draft.annualSalary) || 0),
      weeklyHours: Math.max(1, Number(draft.weeklyHours) || 40),
      unpaidBreakMinutes: Math.max(0, Number(draft.unpaidBreakMinutes) || 0),
      overtimeAfterHours: Math.max(0, Number(draft.overtimeAfterHours) || 0),
      overtimeMultiplier: Math.max(1, Number(draft.overtimeMultiplier) || 1),
      ptoAllowanceHours: Math.max(0, Number(draft.ptoAllowanceHours) || 0),
      weeklySchedule: schedule,
      regularDays: schedule.filter((item) => item.enabled).map((item) => item.day),
      shiftStart: schedule.find((item) => item.enabled)?.start ?? draft.shiftStart,
      shiftEnd: schedule.find((item) => item.enabled)?.end ?? draft.shiftEnd,
    };
    updateProfile(normalized);
    setDraft(normalized);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  const updateScheduleDay = (day: number, patch: Partial<NonNullable<WorkProfile['weeklySchedule']>[number]>) => {
    setDraft((current) => ({
      ...current,
      weeklySchedule: normalizedWorkSchedule(current).map((item) => item.day === day ? { ...item, ...patch } : item),
    }));
  };

  const addQuickWorkTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = quickTask.trim();
    if (!title) return;
    addTask({ title, priority: 'medium', repeat: 'none', areaId: 'work' });
    setQuickTask('');
  };

  const addQuickNote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = quickNote.trim();
    if (!text) return;
    commitProfile({ notes: [{ id: createWorkId('work-note'), text, kind: 'note', createdAt: Date.now() }, ...(profile.notes ?? [])] });
    setQuickNote('');
  };

  const saveChange = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!changeDraft?.title.trim()) return;
    const item = { ...changeDraft, title: changeDraft.title.trim() };
    commitProfile({ changes: [...changes.filter((change) => change.id !== item.id), item] });
    setChangeDraft(undefined);
  };

  const saveNote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!noteDraft?.text.trim()) return;
    const item = { ...noteDraft, text: noteDraft.text.trim() };
    commitProfile({ notes: [...(profile.notes ?? []).filter((note) => note.id !== item.id), item] });
    setNoteDraft(undefined);
  };

  const saveTimeOff = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!timeOffDraft) return;
    const item = {
      ...timeOffDraft,
      endDate: timeOffDraft.endDate >= timeOffDraft.startDate ? timeOffDraft.endDate : timeOffDraft.startDate,
      hours: Math.max(0, timeOffDraft.hours),
    };
    commitProfile({ timeOff: [...timeOff.filter((entry) => entry.id !== item.id), item].sort((a, b) => a.startDate.localeCompare(b.startDate)) });
    setTimeOffDraft(undefined);
  };

  const saveContact = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!contactDraft?.name.trim()) return;
    const contacts = profile.contacts ?? [];
    const item = { ...contactDraft, name: contactDraft.name.trim() };
    commitProfile({ contacts: [...contacts.filter((contact) => contact.id !== item.id), item] });
    setContactDraft(undefined);
  };

  const submitShift = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingShift?.value.endedAt || editingShift.value.endedAt <= editingShift.value.startedAt) {
      setShiftError('End time must be after the start time.');
      return;
    }
    const value = { ...editingShift.value, note: editingShift.value.note?.trim() || undefined };
    if (editingShift.id) updateShift(editingShift.id, value);
    else addShift(value);
    setEditingShift(undefined);
    setShiftError('');
  };

  return (
    <main className="shell work-page still-work-page still-work-hub still-work-refined">
      <header className="still-work-header">
        <button onClick={() => navigate('/')} type="button" aria-label="Back home"><ArrowLeft size={19} /></button>
        <div><p className="section-kicker">Life area</p><h1>Work</h1><p>{profile.jobTitle || profile.employer ? [profile.jobTitle, profile.employer].filter(Boolean).join(' · ') : 'Your workday, changes, notes, time, and pay.'}</p></div>
        <img src="/assets/cozy/work-cozy-desk.png" alt="" aria-hidden="true" />
        <button onClick={() => document.getElementById('work-profile')?.scrollIntoView({ behavior: 'smooth' })} type="button" aria-label="Work settings"><Settings2 size={19} /></button>
      </header>

      <section className="still-work-live card">
        <div className="still-work-live-top">
          <span className="still-work-icon"><BriefcaseBusiness size={18} /></span>
          <div><small>{liveLabel}</small><strong>{liveHeadline}</strong></div>
          <button onClick={() => setPrivacyBlur(!privacyBlur)} type="button" aria-label={privacyBlur ? 'Show earnings' : 'Hide earnings'}>{privacyBlur ? <Eye size={18} /> : <EyeOff size={18} />}</button>
        </div>
        <div className="still-work-live-meta"><span>{openChanges.length} open change{openChanges.length === 1 ? '' : 's'}</span><span>{openWorkTasks.length} task{openWorkTasks.length === 1 ? '' : 's'} waiting</span></div>
        <div className="still-work-actions" aria-label="Shift controls">
          <button disabled={Boolean(activeShift)} onClick={startShift} type="button"><LogIn size={18} />Clock in</button>
          <button className={onBreak ? 'is-active' : ''} disabled={!activeShift} onClick={toggleBreak} type="button"><Coffee size={18} />{onBreak ? 'Resume' : 'Break'}</button>
          <button disabled={!activeShift} onClick={endShift} type="button"><LogOut size={18} />Clock out</button>
        </div>
      </section>

      <section className="still-work-summary" aria-label="Work overview">
        <article className="card"><small>Next shift</small><strong>{nextShift ? nextShift.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Not scheduled'}</strong><span>{nextShift ? `${nextShift.start} – ${nextShift.end}` : 'No upcoming shift'}</span></article>
        <article className="card"><small>Changes</small><strong>{openChanges.length}</strong><span>{openChanges[0] ? `${openChanges[0].reference || 'Next'} · ${openChanges[0].title}` : 'Nothing open'}</span></article>
        <article className="card"><small>Reminders</small><strong>{reminders.length}</strong><span>{reminders[0]?.reminderDate ? `Next ${dateLabel(reminders[0].reminderDate)}` : 'Nothing coming up'}</span></article>
        <article className="card"><small>Next payday</small><strong>{payday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</strong><span className={privacyBlur ? 'private-value is-blurred' : 'private-value'}>{currency(periodEstimate, profile.currency)} estimate</span></article>
      </section>

      <section className="still-work-section still-work-now">
        <div className="still-work-section-heading"><div><p className="section-kicker">Today</p><h2>What needs your attention</h2><p>Only the work that matters right now.</p></div></div>
        <div className="still-work-record-grid">
          <article className="card still-work-record-card">
            <div className="still-work-record-head"><strong>Tasks</strong><button onClick={() => openTaskEditor()} type="button">All</button></div>
            <form className="still-work-quick-task" onSubmit={addQuickWorkTask}><input aria-label="New work task" onChange={(event) => setQuickTask(event.target.value)} placeholder="Add a work task" value={quickTask} /><button aria-label="Add work task" type="submit"><Plus size={16} /></button></form>
            <div className="still-work-record-list">{openWorkTasks.slice(0, 4).map((task) => <button className="still-work-task-row" key={task.id} onClick={() => toggleTask(task.id)} type="button"><span aria-hidden="true" /><strong>{task.title}</strong><small>{task.dueDate ? dateLabel(task.dueDate) : 'No due date'}</small></button>)}{openWorkTasks.length === 0 && <p className="still-work-empty-copy">Nothing waiting for you.</p>}</div>
          </article>
          <article className="card still-work-record-card">
            <div className="still-work-record-head"><strong>Upcoming</strong><button onClick={() => openEventEditor(undefined, todayKey)} type="button"><Plus size={14} />Event</button></div>
            <div className="still-work-record-list">{workEvents.map((event) => <button className="still-work-event-row" key={event.id} onClick={() => openEventEditor(event.id)} type="button"><small>{dateLabel(event.startDate)}</small><strong>{event.title}</strong><span>{event.allDay ? 'All day' : event.startTime ?? ''}</span></button>)}{workEvents.length === 0 && <p className="still-work-empty-copy">Calendar is clear.</p>}</div>
          </article>
        </div>
      </section>

      <section className="still-work-section still-work-changes">
        <div className="still-work-section-heading"><div><p className="section-kicker">Changes</p><h2>Your SAP changes in one place</h2><p>Track the change, system, status, schedule, and the details you need to remember.</p></div><button onClick={() => setChangeDraft({ id: createWorkId('change'), title: '', status: 'planned' })} type="button"><Plus size={16} />Change</button></div>
        <div className="still-work-change-list">{openChanges.length === 0 ? <div className="card still-work-empty-card"><Wrench size={20} /><strong>No open changes</strong><span>Add a change when something enters your queue.</span></div> : openChanges.map((change) => <button className="card still-work-change" key={change.id} onClick={() => setChangeDraft(change)} type="button"><div className="still-work-change-top"><span className={`still-work-status status-${change.status}`}>{statusLabel[change.status]}</span>{change.reference && <small>{change.reference}</small>}</div><strong>{change.title}</strong><span>{[change.system, change.environment, change.plannedDate ? dateLabel(change.plannedDate) : undefined].filter(Boolean).join(' · ') || change.note || 'No additional details'}</span></button>)}</div>
        {changes.some((change) => change.status === 'completed' || change.status === 'cancelled') && <details className="still-work-completed"><summary>Closed changes ({changes.filter((change) => change.status === 'completed' || change.status === 'cancelled').length})</summary><div>{changes.filter((change) => change.status === 'completed' || change.status === 'cancelled').slice(0, 8).map((change) => <button key={change.id} onClick={() => setChangeDraft(change)} type="button">{change.reference ? `${change.reference} · ` : ''}{change.title}</button>)}</div></details>}
      </section>

      <section className="still-work-section still-work-notebook">
        <div className="still-work-section-heading"><div><p className="section-kicker">Notes</p><h2>Your work scratchpad</h2><p>Random details, reminders, handover notes, references—anything worth keeping.</p></div><button onClick={() => setNoteDraft({ id: createWorkId('work-note'), text: '', kind: 'note', createdAt: Date.now() })} type="button"><Plus size={16} />Note</button></div>
        <form className="card still-work-quick-note" onSubmit={addQuickNote}><StickyNote size={18} /><input aria-label="Quick work note" onChange={(event) => setQuickNote(event.target.value)} placeholder="Jot something down…" value={quickNote} /><button type="submit">Save</button></form>
        <div className="still-work-note-list">{notes.length === 0 ? <p className="still-work-empty-copy">Your work notes will stay here when you need them.</p> : notes.slice(0, 10).map((note) => <button className="card still-work-note" key={note.id} onClick={() => setNoteDraft(note)} type="button"><div>{note.pinned && <Pin size={13} />}<small>{note.kind}{note.reminderDate ? ` · ${dateLabel(note.reminderDate)}` : ''}</small></div><strong>{note.text}</strong></button>)}</div>
      </section>

      <section className="still-work-section">
        <details className="still-work-calm-details">
          <summary className="card still-work-details-summary"><span><CalendarDays size={18} />Time, pay & time off</span><small>Shifts, hours, earnings, PTO, and your weekly schedule</small></summary>
          <div className="still-work-details-body">
            <div className="card still-work-pulse"><div className="still-work-pulse-head"><strong>{durationLabel(weekHours)} this week</strong><span>{weeklyProgress}%</span></div><div className="still-work-pulse-bar"><span style={{ width: `${weeklyProgress}%` }} /></div><div className="still-work-pulse-stats"><div><small>Shifts</small><strong>{completedWeekShifts.length}</strong></div><div><small>Earned</small><strong className={privacyBlur ? 'private-value is-blurred' : 'private-value'}>{currency(weekEarnings, profile.currency)}</strong></div><div><small>Overtime</small><strong>{durationLabel(weekOvertime)}</strong></div><div><small>PTO</small><strong>{durationLabel(ptoBalance)}</strong></div></div></div>

            <div className="still-work-subhead"><strong>Recent shifts</strong><button onClick={() => setEditingShift({ value: initialShiftDraft(profile) })} type="button"><Plus size={14} />Past shift</button></div>
            <div className="work-shift-list">{recentShifts.length === 0 ? <p className="still-work-empty-copy">No shifts recorded yet.</p> : recentShifts.map((shift) => <article className="card still-work-shift" key={shift.id}><div><strong>{new Date(shift.startedAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</strong><span>{new Date(shift.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – {shift.endedAt ? new Date(shift.endedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Now'}</span></div><div className="still-work-shift-value"><strong>{durationLabel(workedHours(shift, now))}</strong><span className={privacyBlur ? 'private-value is-blurred' : 'private-value'}>{currency(shift.endedAt && shift.expectedEarnings !== undefined ? shift.expectedEarnings : shiftEarnings(shift, profile, now), profile.currency)}</span></div>{shift.endedAt && <div className="still-work-row-actions"><button onClick={() => setEditingShift({ id: shift.id, value: initialShiftDraft(profile, shift) })} type="button"><Pencil size={14} /></button><button onClick={() => window.confirm('Delete this shift?') && deleteShift(shift.id)} type="button"><Trash2 size={14} /></button></div>}</article>)}</div>

            <div className="still-work-subhead"><strong>Time off</strong><button onClick={() => setTimeOffDraft({ id: createWorkId('time-off'), type: 'vacation', status: 'planned', startDate: todayKey, endDate: todayKey, hours: 8 })} type="button"><Plus size={14} />Add</button></div>
            <div className="still-work-timeoff card"><div><small>Allowance</small><strong>{durationLabel(profile.ptoAllowanceHours ?? 0)}</strong></div><div><small>Taken</small><strong>{durationLabel(usedPto)}</strong></div><div><small>Remaining</small><strong>{durationLabel(ptoBalance)}</strong></div></div>
            <div className="still-work-timeoff-list">{timeOff.slice().sort((a, b) => b.startDate.localeCompare(a.startDate)).slice(0, 4).map((item) => <button className="card" key={item.id} onClick={() => setTimeOffDraft(item)} type="button"><div><small>{item.type} · {item.status}</small><strong>{dateLabel(item.startDate)}{item.endDate !== item.startDate ? ` – ${dateLabel(item.endDate)}` : ''}</strong></div><span>{durationLabel(item.hours)}</span></button>)}</div>
          </div>
        </details>
      </section>

      <section className="still-work-section" id="work-profile">
        <details className="still-work-calm-details">
          <summary className="card still-work-details-summary"><span><UserRound size={18} />Workplace & settings</span><small>Role, people, responsibilities, schedule, and pay</small></summary>
          <div className="still-work-details-body">
            <form className="card still-work-settings still-work-profile-form" onSubmit={saveProfile}>
              <div className="still-work-form-grid">
                <label><span>Employer</span><input onChange={(event) => setDraft({ ...draft, employer: event.target.value })} value={draft.employer ?? ''} /></label>
                <label><span>Role / title</span><input onChange={(event) => setDraft({ ...draft, jobTitle: event.target.value })} value={draft.jobTitle ?? ''} /></label>
                <label><span>Manager</span><input onChange={(event) => setDraft({ ...draft, manager: event.target.value })} value={draft.manager ?? ''} /></label>
                <label><span>Team</span><input onChange={(event) => setDraft({ ...draft, team: event.target.value })} value={draft.team ?? ''} /></label>
                <label><span>Work location</span><input onChange={(event) => setDraft({ ...draft, workLocation: event.target.value })} value={draft.workLocation ?? ''} /></label>
                <label><span>Annual PTO</span><input min="0" onChange={(event) => setDraft({ ...draft, ptoAllowanceHours: Number(event.target.value) })} type="number" value={draft.ptoAllowanceHours ?? 0} /></label>
              </div>
              <label className="still-work-wide-field"><span>Responsibilities</span><textarea onChange={(event) => setDraft({ ...draft, responsibilities: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })} placeholder="One responsibility per line" rows={3} value={(draft.responsibilities ?? []).join('\n')} /></label>
              <label className="still-work-wide-field"><span>Career notes</span><textarea onChange={(event) => setDraft({ ...draft, careerNotes: event.target.value })} placeholder="Reviews, accomplishments, skills to build…" rows={3} value={draft.careerNotes ?? ''} /></label>

              <div className="still-work-settings-divider"><strong>Weekly schedule</strong></div>
              <div className="still-work-week">{normalizedWorkSchedule(draft).map((item) => <div className={item.enabled ? 'is-enabled' : ''} key={item.day}><label><input checked={item.enabled} onChange={(event) => updateScheduleDay(item.day, { enabled: event.target.checked })} type="checkbox" /><span>{dayNames[item.day]}</span></label><input disabled={!item.enabled} onChange={(event) => updateScheduleDay(item.day, { start: event.target.value })} type="time" value={item.start} /><span>to</span><input disabled={!item.enabled} onChange={(event) => updateScheduleDay(item.day, { end: event.target.value })} type="time" value={item.end} /></div>)}</div>

              <div className="still-work-settings-divider"><strong>Pay</strong></div>
              <div className="still-work-form-grid">
                <label><span>Pay type</span><select value={draft.payType} onChange={(event) => setDraft({ ...draft, payType: event.target.value as WorkProfile['payType'] })}><option value="hourly">Hourly</option><option value="salary">Salary</option></select></label>
                <label><span>Currency</span><select value={draft.currency} onChange={(event) => setDraft({ ...draft, currency: event.target.value })}><option value="PHP">PHP</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="CAD">CAD</option><option value="AUD">AUD</option><option value="JPY">JPY</option></select></label>
                {draft.payType === 'hourly' ? <label><span>Hourly rate</span><input min="0" step="0.01" type="number" value={draft.hourlyRate} onChange={(event) => setDraft({ ...draft, hourlyRate: Number(event.target.value) })} /></label> : <label><span>Annual salary</span><input min="0" step="0.01" type="number" value={draft.annualSalary} onChange={(event) => setDraft({ ...draft, annualSalary: Number(event.target.value) })} /></label>}
                <label><span>Pay frequency</span><select value={draft.payFrequency} onChange={(event) => setDraft({ ...draft, payFrequency: event.target.value as WorkProfile['payFrequency'] })}><option value="weekly">Weekly</option><option value="biweekly">Every two weeks</option><option value="semimonthly">Twice a month</option><option value="monthly">Monthly</option></select></label>
                <label><span>Next payday</span><input onChange={(event) => setDraft({ ...draft, nextPaydayDate: event.target.value })} type="date" value={draft.nextPaydayDate ?? ''} /></label>
                <label><span>Weekly hours</span><input min="1" max="100" step="0.5" type="number" value={draft.weeklyHours} onChange={(event) => setDraft({ ...draft, weeklyHours: Number(event.target.value) })} /></label>
                <label><span>Unpaid break</span><input min="0" step="5" type="number" value={draft.unpaidBreakMinutes} onChange={(event) => setDraft({ ...draft, unpaidBreakMinutes: Number(event.target.value) })} /></label>
                <label><span>Overtime after</span><input min="0" step="0.5" type="number" value={draft.overtimeAfterHours} onChange={(event) => setDraft({ ...draft, overtimeAfterHours: Number(event.target.value) })} /></label>
                <label><span>Overtime multiplier</span><input min="1" step="0.1" type="number" value={draft.overtimeMultiplier} onChange={(event) => setDraft({ ...draft, overtimeMultiplier: Number(event.target.value) })} /></label>
                <label><span>Effective hourly</span><output>{currency(effectiveHourlyRate(draft), draft.currency)}</output></label>
              </div>
              <button className="work-save-button" type="submit">{saved ? <Check size={16} /> : <Save size={16} />}{saved ? 'Saved' : 'Save work settings'}</button>
            </form>

            <div className="card still-work-people"><div className="still-work-record-head"><strong>Important people</strong><button onClick={() => setContactDraft({ id: createWorkId('contact'), name: '' })} type="button"><Plus size={14} />Person</button></div>{(profile.contacts ?? []).length === 0 ? <p className="still-work-empty-copy">Manager, teammates, vendors, or anyone you regularly need.</p> : (profile.contacts ?? []).map((contact) => <button key={contact.id} onClick={() => setContactDraft(contact)} type="button"><strong>{contact.name}</strong><span>{contact.role || contact.note || 'Work contact'}</span></button>)}</div>
            {workReflections.length > 0 && <div className="card still-work-reflections"><div className="still-work-record-head"><strong>Reflections</strong><button onClick={() => openJournalEditor(undefined, todayKey)} type="button"><Plus size={14} />Reflect</button></div>{workReflections.map((entry) => <button key={entry.id} onClick={() => openJournalEditor(entry.id)} type="button"><small>{dateLabel(entry.entryDate)}</small><strong>{entry.title || entry.body.slice(0, 54)}</strong></button>)}</div>}
          </div>
        </details>
      </section>

      {editingShift && <div className="still-work-modal" role="presentation"><form className="card" onSubmit={submitShift}><div className="still-work-modal-heading"><div><CalendarDays size={18} /><h2>{editingShift.id ? 'Edit shift' : 'Add past shift'}</h2></div><button onClick={() => setEditingShift(undefined)} type="button" aria-label="Close"><X size={18} /></button></div><label><span>Started</span><input max={localDateTime(Date.now())} onChange={(event) => setEditingShift({ ...editingShift, value: { ...editingShift.value, startedAt: new Date(event.target.value).getTime() } })} required type="datetime-local" value={localDateTime(editingShift.value.startedAt)} /></label><label><span>Ended</span><input max={localDateTime(Date.now())} onChange={(event) => setEditingShift({ ...editingShift, value: { ...editingShift.value, endedAt: new Date(event.target.value).getTime() } })} required type="datetime-local" value={editingShift.value.endedAt ? localDateTime(editingShift.value.endedAt) : ''} /></label><label><span>Unpaid break</span><input min="0" onChange={(event) => setEditingShift({ ...editingShift, value: { ...editingShift.value, unpaidBreakMinutes: Number(event.target.value) } })} step="5" type="number" value={editingShift.value.unpaidBreakMinutes} /></label><label><span>Note</span><textarea onChange={(event) => setEditingShift({ ...editingShift, value: { ...editingShift.value, note: event.target.value } })} rows={3} value={editingShift.value.note ?? ''} /></label>{shiftError && <p className="still-work-error">{shiftError}</p>}<button className="work-save-button" type="submit"><Save size={16} />Save shift</button></form></div>}

      {changeDraft && <div className="still-work-modal" role="presentation"><form className="card" onSubmit={saveChange}><div className="still-work-modal-heading"><div><Wrench size={18} /><h2>{changes.some((item) => item.id === changeDraft.id) ? 'Edit change' : 'Add change'}</h2></div><button onClick={() => setChangeDraft(undefined)} type="button" aria-label="Close"><X size={18} /></button></div><label><span>Change summary</span><input onChange={(event) => setChangeDraft({ ...changeDraft, title: event.target.value })} placeholder="What is changing?" required value={changeDraft.title} /></label><div className="still-work-modal-grid"><label><span>Change / ticket ID</span><input onChange={(event) => setChangeDraft({ ...changeDraft, reference: event.target.value })} placeholder="CHG…" value={changeDraft.reference ?? ''} /></label><label><span>Status</span><select onChange={(event) => setChangeDraft({ ...changeDraft, status: event.target.value as WorkChange['status'] })} value={changeDraft.status}><option value="planned">Planned</option><option value="in_progress">In progress</option><option value="testing">Testing</option><option value="ready">Ready</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label></div><div className="still-work-modal-grid"><label><span>System</span><input onChange={(event) => setChangeDraft({ ...changeDraft, system: event.target.value })} placeholder="SID / landscape" value={changeDraft.system ?? ''} /></label><label><span>Environment</span><input onChange={(event) => setChangeDraft({ ...changeDraft, environment: event.target.value })} placeholder="DEV / QA / PRD" value={changeDraft.environment ?? ''} /></label></div><div className="still-work-modal-grid"><label><span>Planned date</span><input onChange={(event) => setChangeDraft({ ...changeDraft, plannedDate: event.target.value || undefined })} type="date" value={changeDraft.plannedDate ?? ''} /></label><label><span>Owner / requester</span><input onChange={(event) => setChangeDraft({ ...changeDraft, owner: event.target.value })} value={changeDraft.owner ?? ''} /></label></div><label><span>Details</span><textarea onChange={(event) => setChangeDraft({ ...changeDraft, note: event.target.value })} placeholder="Steps, risk, validation, rollback, handover…" rows={4} value={changeDraft.note ?? ''} /></label><div className="still-work-modal-actions">{changes.some((item) => item.id === changeDraft.id) && <button className="is-danger" onClick={() => { commitProfile({ changes: changes.filter((item) => item.id !== changeDraft.id) }); setChangeDraft(undefined); }} type="button"><Trash2 size={15} />Delete</button>}<button className="work-save-button" type="submit"><Save size={16} />Save change</button></div></form></div>}

      {noteDraft && <div className="still-work-modal" role="presentation"><form className="card" onSubmit={saveNote}><div className="still-work-modal-heading"><div>{noteDraft.kind === 'reminder' ? <BellRing size={18} /> : <StickyNote size={18} />}<h2>Work note</h2></div><button onClick={() => setNoteDraft(undefined)} type="button" aria-label="Close"><X size={18} /></button></div><label><span>Note</span><textarea onChange={(event) => setNoteDraft({ ...noteDraft, text: event.target.value })} placeholder="Write down whatever you need…" required rows={5} value={noteDraft.text} /></label><div className="still-work-modal-grid"><label><span>Type</span><select onChange={(event) => setNoteDraft({ ...noteDraft, kind: event.target.value as WorkNote['kind'] })} value={noteDraft.kind}><option value="note">Note</option><option value="reminder">Reminder</option><option value="reference">Reference</option><option value="handover">Handover</option></select></label><label className="still-work-pin-toggle"><span>Pin</span><input checked={Boolean(noteDraft.pinned)} onChange={(event) => setNoteDraft({ ...noteDraft, pinned: event.target.checked })} type="checkbox" /></label></div>{noteDraft.kind === 'reminder' && <label><span>Remind me on</span><input onChange={(event) => setNoteDraft({ ...noteDraft, reminderDate: event.target.value || undefined })} type="date" value={noteDraft.reminderDate ?? ''} /></label>}<div className="still-work-modal-actions">{(profile.notes ?? []).some((item) => item.id === noteDraft.id) && <button className="is-danger" onClick={() => { commitProfile({ notes: (profile.notes ?? []).filter((item) => item.id !== noteDraft.id) }); setNoteDraft(undefined); }} type="button"><Trash2 size={15} />Delete</button>}<button className="work-save-button" type="submit"><Save size={16} />Save note</button></div></form></div>}

      {timeOffDraft && <div className="still-work-modal" role="presentation"><form className="card" onSubmit={saveTimeOff}><div className="still-work-modal-heading"><div><CalendarDays size={18} /><h2>Time off</h2></div><button onClick={() => setTimeOffDraft(undefined)} type="button" aria-label="Close"><X size={18} /></button></div><div className="still-work-modal-grid"><label><span>Type</span><select onChange={(event) => setTimeOffDraft({ ...timeOffDraft, type: event.target.value as WorkTimeOff['type'] })} value={timeOffDraft.type}><option value="vacation">Vacation</option><option value="sick">Sick</option><option value="personal">Personal</option><option value="other">Other</option></select></label><label><span>Status</span><select onChange={(event) => setTimeOffDraft({ ...timeOffDraft, status: event.target.value as WorkTimeOff['status'] })} value={timeOffDraft.status}><option value="planned">Planned</option><option value="approved">Approved</option><option value="taken">Taken</option></select></label></div><div className="still-work-modal-grid"><label><span>Starts</span><input onChange={(event) => setTimeOffDraft({ ...timeOffDraft, startDate: event.target.value })} required type="date" value={timeOffDraft.startDate} /></label><label><span>Ends</span><input onChange={(event) => setTimeOffDraft({ ...timeOffDraft, endDate: event.target.value })} required type="date" value={timeOffDraft.endDate} /></label></div><label><span>PTO hours</span><input min="0" onChange={(event) => setTimeOffDraft({ ...timeOffDraft, hours: Number(event.target.value) })} type="number" value={timeOffDraft.hours} /></label><label><span>Note</span><textarea onChange={(event) => setTimeOffDraft({ ...timeOffDraft, note: event.target.value })} rows={3} value={timeOffDraft.note ?? ''} /></label><div className="still-work-modal-actions">{timeOff.some((item) => item.id === timeOffDraft.id) && <button className="is-danger" onClick={() => { commitProfile({ timeOff: timeOff.filter((item) => item.id !== timeOffDraft.id) }); setTimeOffDraft(undefined); }} type="button"><Trash2 size={15} />Delete</button>}<button className="work-save-button" type="submit"><Save size={16} />Save</button></div></form></div>}

      {contactDraft && <div className="still-work-modal" role="presentation"><form className="card" onSubmit={saveContact}><div className="still-work-modal-heading"><div><UserRound size={18} /><h2>Work contact</h2></div><button onClick={() => setContactDraft(undefined)} type="button" aria-label="Close"><X size={18} /></button></div><label><span>Name</span><input onChange={(event) => setContactDraft({ ...contactDraft, name: event.target.value })} required value={contactDraft.name} /></label><label><span>Role / relationship</span><input onChange={(event) => setContactDraft({ ...contactDraft, role: event.target.value })} value={contactDraft.role ?? ''} /></label><label><span>Note</span><textarea onChange={(event) => setContactDraft({ ...contactDraft, note: event.target.value })} rows={3} value={contactDraft.note ?? ''} /></label><div className="still-work-modal-actions">{(profile.contacts ?? []).some((item) => item.id === contactDraft.id) && <button className="is-danger" onClick={() => { commitProfile({ contacts: (profile.contacts ?? []).filter((item) => item.id !== contactDraft.id) }); setContactDraft(undefined); }} type="button"><Trash2 size={15} />Delete</button>}<button className="work-save-button" type="submit"><Save size={16} />Save</button></div></form></div>}
    </main>
  );
}
