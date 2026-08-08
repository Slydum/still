import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Eye,
  EyeOff,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  Save,
  Settings2,
  Target,
  Trash2,
  UserRound,
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
  type WorkContact,
  type WorkProfile,
  type WorkProject,
  type WorkScheduleOverride,
  type WorkShift,
  type WorkShiftInput,
  type WorkTimeOff,
} from '../../domain/work';
import { useAppStore } from '../../stores/useAppStore';

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function currency(value: number, code: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
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
  if (shift) return {
    startedAt: shift.startedAt,
    endedAt: shift.endedAt ?? Date.now(),
    unpaidBreakMinutes: shift.unpaidBreakMinutes,
    note: shift.note,
  };
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

function dateLabel(value?: string) {
  if (!value) return 'No date';
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

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
    projects: profile.projects ?? [],
    timeOff: profile.timeOff ?? [],
    contacts: profile.contacts ?? [],
    responsibilities: profile.responsibilities ?? [],
  });
  const [saved, setSaved] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [scheduleView, setScheduleView] = useState<'week' | 'month'>('week');
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string>();
  const [overrideDraft, setOverrideDraft] = useState<WorkScheduleOverride>();
  const [editingShift, setEditingShift] = useState<{ id?: string; value: WorkShiftInput }>();
  const [shiftError, setShiftError] = useState('');
  const [quickTask, setQuickTask] = useState('');
  const [projectDraft, setProjectDraft] = useState<WorkProject>();
  const [timeOffDraft, setTimeOffDraft] = useState<WorkTimeOff>();
  const [contactDraft, setContactDraft] = useState<WorkContact>();

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
  const averageShift = completedWeekShifts.length > 0 ? completedWeekShifts.reduce((total, shift) => total + workedHours(shift, now), 0) / completedWeekShifts.length : 0;
  const weeklyProgress = Math.min(100, Math.round((weekHours / Math.max(1, profile.weeklyHours)) * 100));
  const scheduledDays = normalizedWorkSchedule(profile).filter((item) => item.enabled).length;
  const payday = useMemo(() => nextPayday(profile), [profile]);
  const periodEstimate = useMemo(() => payPeriodEstimate(profile), [profile]);
  const nextShift = useMemo(() => nextScheduledShift(profile), [profile]);
  const recentShifts = useMemo(() => [...shifts].sort((a, b) => b.startedAt - a.startedAt).slice(0, 8), [shifts]);

  const workTasks = useMemo(() => tasks
    .filter((task) => task.areaId === 'work')
    .sort((a, b) => Number(a.completed) - Number(b.completed) || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')),
  [tasks]);
  const openWorkTasks = workTasks.filter((task) => !task.completed);
  const workEvents = useMemo(() => events
    .filter((event) => event.areaId === 'work' || event.category === 'work')
    .filter((event) => event.endDate >= todayKey)
    .sort((a, b) => `${a.startDate}${a.startTime ?? ''}`.localeCompare(`${b.startDate}${b.startTime ?? ''}`))
    .slice(0, 4), [events, todayKey]);
  const workNotes = useMemo(() => journalEntries
    .filter((entry) => entry.areaId === 'work')
    .sort((a, b) => b.entryDate.localeCompare(a.entryDate) || b.updatedAt - a.updatedAt)
    .slice(0, 3), [journalEntries]);
  const projects = profile.projects ?? [];
  const activeProjects = projects.filter((project) => project.status !== 'done');
  const timeOff = profile.timeOff ?? [];
  const usedPto = timeOff.filter((item) => item.status === 'taken').reduce((total, item) => total + item.hours, 0);
  const ptoBalance = Math.max(0, (profile.ptoAllowanceHours ?? 0) - usedPto);
  const upcomingTimeOff = [...timeOff]
    .filter((item) => item.endDate >= todayKey && item.status !== 'taken')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

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

  const calendarDays = useMemo(() => {
    const firstDay = month.getDay();
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(firstDay).fill(null), ...Array.from({ length: count }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1))];
  }, [month]);

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

  const commitProfile = (patch: Partial<WorkProfile>) => {
    const current = useAppStore.getState().workProfile;
    const next = { ...current, ...patch };
    updateProfile(next);
    setDraft((value) => ({ ...value, ...patch }));
  };

  const setNumber = (key: keyof WorkProfile, value: string) => {
    setDraft((current) => ({ ...current, [key]: Number(value) }));
  };

  const updateScheduleDay = (day: number, patch: Partial<NonNullable<WorkProfile['weeklySchedule']>[number]>) => {
    setDraft((current) => ({
      ...current,
      weeklySchedule: normalizedWorkSchedule(current).map((item) => item.day === day ? { ...item, ...patch } : item),
    }));
  };

  const selectMonthDate = (date: Date) => {
    const key = dateKey(date);
    const schedule = scheduleForDate(draft, date);
    setSelectedDate(key);
    setOverrideDraft({ date: key, enabled: schedule?.enabled ?? false, start: schedule?.start ?? '09:00', end: schedule?.end ?? '17:00' });
  };

  const saveOverride = () => {
    if (!overrideDraft) return;
    setDraft((current) => ({
      ...current,
      scheduleOverrides: [...(current.scheduleOverrides ?? []).filter((item) => item.date !== overrideDraft.date), overrideDraft].sort((a, b) => a.date.localeCompare(b.date)),
    }));
    setSelectedDate(undefined);
  };

  const removeOverride = () => {
    if (!overrideDraft) return;
    setDraft((current) => ({ ...current, scheduleOverrides: (current.scheduleOverrides ?? []).filter((item) => item.date !== overrideDraft.date) }));
    setSelectedDate(undefined);
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

  const addQuickWorkTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = quickTask.trim();
    if (!title) return;
    addTask({ title, priority: 'medium', repeat: 'none', areaId: 'work' });
    setQuickTask('');
  };

  const saveProject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!projectDraft?.title.trim()) return;
    const item = { ...projectDraft, title: projectDraft.title.trim(), progress: Math.min(100, Math.max(0, projectDraft.progress)) };
    commitProfile({ projects: [...projects.filter((project) => project.id !== item.id), item] });
    setProjectDraft(undefined);
  };

  const saveTimeOff = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!timeOffDraft) return;
    const item = { ...timeOffDraft, endDate: timeOffDraft.endDate >= timeOffDraft.startDate ? timeOffDraft.endDate : timeOffDraft.startDate, hours: Math.max(0, timeOffDraft.hours) };
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

  return (
    <main className="shell work-page still-work-page still-work-hub">
      <header className="still-work-header">
        <button onClick={() => navigate('/')} type="button" aria-label="Back home"><ArrowLeft size={19} /></button>
        <div><p className="section-kicker">Life area</p><h1>Work</h1><p>{profile.jobTitle || profile.employer ? [profile.jobTitle, profile.employer].filter(Boolean).join(' · ') : 'Your whole working life, in one calm place.'}</p></div>
        <img src="/assets/cozy/work-cozy-desk.png" alt="" aria-hidden="true" />
        <button onClick={() => document.getElementById('work-profile')?.scrollIntoView({ behavior: 'smooth' })} type="button" aria-label="Work profile"><Settings2 size={19} /></button>
      </header>

      <section className="still-work-live card">
        <div className="still-work-live-top">
          <span className="still-work-icon"><BriefcaseBusiness size={18} /></span>
          <div><small>{liveLabel}</small><strong>{liveHeadline}</strong></div>
          <button onClick={() => setPrivacyBlur(!privacyBlur)} type="button" aria-label={privacyBlur ? 'Show earnings' : 'Hide earnings'}>{privacyBlur ? <Eye size={18} /> : <EyeOff size={18} />}</button>
        </div>
        <div className="still-work-live-meta"><span className={privacyBlur ? 'private-value is-blurred' : 'private-value'}>{currency(earnedToday, profile.currency)} today</span><span>{openWorkTasks.length} open task{openWorkTasks.length === 1 ? '' : 's'}</span></div>
        <div className="still-work-actions" aria-label="Shift controls">
          <button disabled={Boolean(activeShift)} onClick={startShift} type="button"><LogIn size={18} />Clock in</button>
          <button className={onBreak ? 'is-active' : ''} disabled={!activeShift} onClick={toggleBreak} type="button"><Coffee size={18} />{onBreak ? 'Resume' : 'Break'}</button>
          <button disabled={!activeShift} onClick={endShift} type="button"><LogOut size={18} />Clock out</button>
        </div>
      </section>

      <section className="still-work-summary" aria-label="Work overview">
        <article className="card"><small>Next shift</small><strong>{nextShift ? nextShift.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Not scheduled'}</strong><span>{nextShift ? `${nextShift.start} – ${nextShift.end}` : 'Set your schedule below'}</span></article>
        <article className="card"><small>Open work</small><strong>{openWorkTasks.length + activeProjects.length}</strong><span>{openWorkTasks.length} tasks · {activeProjects.length} projects/goals</span></article>
        <article className="card"><small>PTO balance</small><strong>{durationLabel(ptoBalance)}</strong><span>{upcomingTimeOff ? `Next: ${dateLabel(upcomingTimeOff.startDate)}` : 'No time off planned'}</span></article>
        <article className="card"><small>Next payday</small><strong>{payday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</strong><span className={privacyBlur ? 'private-value is-blurred' : 'private-value'}>{currency(periodEstimate, profile.currency)} estimate</span></article>
      </section>

      <section className="still-work-section still-work-now">
        <div className="still-work-section-heading"><div><p className="section-kicker">Today</p><h2>What needs your attention</h2><p>Tasks and calendar items connected to Work.</p></div></div>
        <div className="still-work-record-grid">
          <article className="card still-work-record-card">
            <div className="still-work-record-head"><strong>Tasks</strong><button onClick={() => openTaskEditor()} type="button">All tasks</button></div>
            <form className="still-work-quick-task" onSubmit={addQuickWorkTask}><input aria-label="New work task" onChange={(event) => setQuickTask(event.target.value)} placeholder="Add a work task" value={quickTask} /><button aria-label="Add work task" type="submit"><Plus size={16} /></button></form>
            <div className="still-work-record-list">{openWorkTasks.slice(0, 4).map((task) => <button className="still-work-task-row" key={task.id} onClick={() => toggleTask(task.id)} type="button"><span aria-hidden="true" /> <strong>{task.title}</strong><small>{task.dueDate ? dateLabel(task.dueDate) : 'No due date'}</small></button>)}{openWorkTasks.length === 0 && <p className="still-work-empty-copy">Nothing waiting for you.</p>}</div>
          </article>
          <article className="card still-work-record-card">
            <div className="still-work-record-head"><strong>Upcoming</strong><button onClick={() => openEventEditor(undefined, todayKey)} type="button"><Plus size={14} />Event</button></div>
            <div className="still-work-record-list">{workEvents.map((event) => <button className="still-work-event-row" key={event.id} onClick={() => openEventEditor(event.id)} type="button"><small>{dateLabel(event.startDate)}</small><strong>{event.title}</strong><span>{event.allDay ? 'All day' : event.startTime ?? ''}</span></button>)}{workEvents.length === 0 && <p className="still-work-empty-copy">No Work events coming up.</p>}</div>
          </article>
        </div>
      </section>

      <section className="still-work-section">
        <div className="still-work-section-heading"><div><p className="section-kicker">Projects & goals</p><h2>Keep the bigger picture visible</h2><p>Track outcomes without turning Still into project-management software.</p></div><button onClick={() => setProjectDraft({ id: createWorkId('work-project'), title: '', kind: 'project', status: 'active', progress: 0 })} type="button"><Plus size={16} />Add</button></div>
        <div className="still-work-projects">{activeProjects.length === 0 ? <div className="card still-work-empty-card"><Target size={20} /><strong>No active projects or goals</strong><span>Add what you are currently moving forward.</span></div> : activeProjects.map((project) => <button className="card still-work-project" key={project.id} onClick={() => setProjectDraft(project)} type="button"><div><small>{project.kind}</small><strong>{project.title}</strong><span>{project.dueDate ? `Due ${dateLabel(project.dueDate)}` : project.note || 'No deadline'}</span></div><div className="still-work-progress"><span><i style={{ width: `${project.progress}%` }} /></span><strong>{project.progress}%</strong></div></button>)}</div>
        {projects.some((project) => project.status === 'done') && <details className="still-work-completed"><summary>Completed ({projects.filter((project) => project.status === 'done').length})</summary><div>{projects.filter((project) => project.status === 'done').map((project) => <button key={project.id} onClick={() => setProjectDraft(project)} type="button">{project.title}</button>)}</div></details>}
      </section>

      <section className="still-work-section">
        <div className="still-work-section-heading"><div><p className="section-kicker">Time off</p><h2>Protect time away from work</h2><p>PTO, sick time, personal days, and planned leave.</p></div><button onClick={() => setTimeOffDraft({ id: createWorkId('time-off'), type: 'vacation', status: 'planned', startDate: todayKey, endDate: todayKey, hours: 8 })} type="button"><Plus size={16} />Add</button></div>
        <div className="still-work-timeoff card"><div><small>Allowance</small><strong>{durationLabel(profile.ptoAllowanceHours ?? 0)}</strong></div><div><small>Taken</small><strong>{durationLabel(usedPto)}</strong></div><div><small>Remaining</small><strong>{durationLabel(ptoBalance)}</strong></div></div>
        <div className="still-work-timeoff-list">{timeOff.slice().sort((a, b) => b.startDate.localeCompare(a.startDate)).slice(0, 5).map((item) => <button className="card" key={item.id} onClick={() => setTimeOffDraft(item)} type="button"><div><small>{item.type} · {item.status}</small><strong>{dateLabel(item.startDate)}{item.endDate !== item.startDate ? ` – ${dateLabel(item.endDate)}` : ''}</strong></div><span>{durationLabel(item.hours)}</span></button>)}{timeOff.length === 0 && <p className="still-work-empty-copy">No time off recorded yet.</p>}</div>
      </section>

      <section className="still-work-section">
        <div className="still-work-section-heading"><div><p className="section-kicker">Weekly pulse</p><h2>Your work at a glance</h2><p>Time and earnings stay visible without becoming the whole story.</p></div></div>
        <div className="card still-work-pulse">
          <div className="still-work-pulse-head"><strong>{durationLabel(weekHours)} this week</strong><span>{weeklyProgress}%</span></div>
          <div aria-label={`${weeklyProgress}% of weekly hours`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={weeklyProgress} className="still-work-pulse-bar"><span style={{ width: `${weeklyProgress}%` }} /></div>
          <div className="still-work-pulse-stats"><div><small>Shifts</small><strong>{completedWeekShifts.length}</strong></div><div><small>Average</small><strong>{averageShift ? durationLabel(averageShift) : '—'}</strong></div><div><small>Earned</small><strong className={privacyBlur ? 'private-value is-blurred' : 'private-value'}>{currency(weekEarnings, profile.currency)}</strong></div><div><small>Overtime</small><strong>{durationLabel(weekOvertime)}</strong></div></div>
        </div>
      </section>

      <section className="still-work-section" id="work-profile">
        <details>
          <summary className="card still-work-details-summary"><span><UserRound size={18} />Workplace & career</span><small>Employer, role, responsibilities, people, and career notes</small></summary>
          <form className="card still-work-settings still-work-profile-form" onSubmit={saveProfile}>
            <div className="still-work-form-grid">
              <label><span>Employer</span><input onChange={(event) => setDraft({ ...draft, employer: event.target.value })} placeholder="Company or workplace" value={draft.employer ?? ''} /></label>
              <label><span>Role / title</span><input onChange={(event) => setDraft({ ...draft, jobTitle: event.target.value })} placeholder="Your role" value={draft.jobTitle ?? ''} /></label>
              <label><span>Manager</span><input onChange={(event) => setDraft({ ...draft, manager: event.target.value })} placeholder="Manager or lead" value={draft.manager ?? ''} /></label>
              <label><span>Team</span><input onChange={(event) => setDraft({ ...draft, team: event.target.value })} placeholder="Team or department" value={draft.team ?? ''} /></label>
              <label><span>Work location</span><input onChange={(event) => setDraft({ ...draft, workLocation: event.target.value })} placeholder="Office, remote, hybrid…" value={draft.workLocation ?? ''} /></label>
              <label><span>Started</span><input onChange={(event) => setDraft({ ...draft, employmentStartDate: event.target.value })} type="date" value={draft.employmentStartDate ?? ''} /></label>
              <label><span>Annual PTO allowance</span><input min="0" onChange={(event) => setNumber('ptoAllowanceHours', event.target.value)} step="1" type="number" value={draft.ptoAllowanceHours ?? 0} /><small>Hours</small></label>
            </div>
            <label className="still-work-wide-field"><span>Responsibilities</span><textarea onChange={(event) => setDraft({ ...draft, responsibilities: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })} placeholder="One responsibility per line" rows={4} value={(draft.responsibilities ?? []).join('\n')} /></label>
            <label className="still-work-wide-field"><span>Career notes</span><textarea onChange={(event) => setDraft({ ...draft, careerNotes: event.target.value })} placeholder="Reviews, accomplishments, promotion ideas, skills to build…" rows={4} value={draft.careerNotes ?? ''} /></label>
            <button className="work-save-button" type="submit">{saved ? <Check size={16} /> : <Save size={16} />}{saved ? 'Saved' : 'Save work profile'}</button>
          </form>
          <div className="card still-work-people">
            <div className="still-work-record-head"><strong>Important people</strong><button onClick={() => setContactDraft({ id: createWorkId('contact'), name: '' })} type="button"><Plus size={14} />Person</button></div>
            {(profile.contacts ?? []).length === 0 ? <p className="still-work-empty-copy">Add your manager, teammates, clients, or other important work contacts.</p> : (profile.contacts ?? []).map((contact) => <button key={contact.id} onClick={() => setContactDraft(contact)} type="button"><strong>{contact.name}</strong><span>{contact.role || contact.note || 'Work contact'}</span></button>)}
          </div>
          {workNotes.length > 0 && <div className="card still-work-notes"><div className="still-work-record-head"><strong>Recent reflections</strong><button onClick={() => openJournalEditor(undefined, todayKey)} type="button"><Plus size={14} />Reflect</button></div>{workNotes.map((entry) => <button key={entry.id} onClick={() => openJournalEditor(entry.id)} type="button"><small>{dateLabel(entry.entryDate)}</small><strong>{entry.title || entry.body.slice(0, 54)}</strong></button>)}</div>}
        </details>
      </section>

      <section className="still-work-section">
        <div className="still-work-section-heading"><div><h2>Recent shifts</h2><p>Your latest recorded time and earnings.</p></div><button onClick={() => setEditingShift({ value: initialShiftDraft(profile) })} type="button"><Plus size={16} />Add shift</button></div>
        <div className="work-shift-list">
          {recentShifts.length === 0 ? <div className="card work-shift-empty">No shifts recorded yet. Clock in when work starts, or add a past shift.</div> : recentShifts.map((shift) => (
            <article className="card still-work-shift" key={shift.id}>
              <div><strong>{new Date(shift.startedAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</strong><span>{new Date(shift.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – {shift.endedAt ? new Date(shift.endedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : (shift.breakStartedAt ? 'On break' : 'Now')}</span>{shift.note && <small>{shift.note}</small>}</div>
              <div className="still-work-shift-value"><strong>{durationLabel(workedHours(shift, now))}</strong><span className={privacyBlur ? 'private-value is-blurred' : 'private-value'}>{currency(shift.endedAt && shift.expectedEarnings !== undefined ? shift.expectedEarnings : shiftEarnings(shift, profile, now), profile.currency)}</span></div>
              {shift.endedAt && <div className="still-work-row-actions"><button onClick={() => setEditingShift({ id: shift.id, value: initialShiftDraft(profile, shift) })} type="button" aria-label="Edit shift"><Pencil size={15} /></button><button onClick={() => window.confirm('Delete this shift?') && deleteShift(shift.id)} type="button" aria-label="Delete shift"><Trash2 size={15} /></button></div>}
            </article>
          ))}
        </div>
      </section>

      <section className="still-work-section" id="work-settings">
        <details>
          <summary className="card still-work-details-summary"><span><Settings2 size={18} />Schedule & pay settings</span><small>Workdays, pay rate, payday, breaks, and overtime</small></summary>
          <form className="card still-work-settings" onSubmit={saveProfile}>
            <div className="still-work-tabs"><button className={scheduleView === 'week' ? 'is-selected' : ''} onClick={() => setScheduleView('week')} type="button">Week</button><button className={scheduleView === 'month' ? 'is-selected' : ''} onClick={() => setScheduleView('month')} type="button">Month</button></div>
            {scheduleView === 'week' ? <div className="still-work-week">
              {normalizedWorkSchedule(draft).map((item) => <div className={item.enabled ? 'is-enabled' : ''} key={item.day}>
                <label><input checked={item.enabled} onChange={(event) => updateScheduleDay(item.day, { enabled: event.target.checked })} type="checkbox" /><span>{dayNames[item.day]}</span></label>
                <input aria-label={`${dayNames[item.day]} start`} disabled={!item.enabled} onChange={(event) => updateScheduleDay(item.day, { start: event.target.value })} type="time" value={item.start} />
                <span>to</span>
                <input aria-label={`${dayNames[item.day]} end`} disabled={!item.enabled} onChange={(event) => updateScheduleDay(item.day, { end: event.target.value })} type="time" value={item.end} />
              </div>)}
            </div> : <div className="still-work-month">
              <div className="still-work-month-nav"><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} type="button" aria-label="Previous month"><ChevronLeft size={17} /></button><strong>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} type="button" aria-label="Next month"><ChevronRight size={17} /></button></div>
              <div className="still-work-calendar-labels">{['S','M','T','W','T','F','S'].map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div>
              <div className="still-work-calendar">{calendarDays.map((date, index) => date ? <button className={`${scheduleForDate(draft, date)?.enabled ? 'is-scheduled' : ''} ${draft.scheduleOverrides?.some((item) => item.date === dateKey(date)) ? 'is-override' : ''}`} key={dateKey(date)} onClick={() => selectMonthDate(date)} type="button"><span>{date.getDate()}</span></button> : <span key={`blank-${index}`} />)}</div>
              {selectedDate && overrideDraft && <div className="still-work-override"><strong>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</strong><label><input checked={overrideDraft.enabled} onChange={(event) => setOverrideDraft({ ...overrideDraft, enabled: event.target.checked })} type="checkbox" />Working</label><input disabled={!overrideDraft.enabled} onChange={(event) => setOverrideDraft({ ...overrideDraft, start: event.target.value })} type="time" value={overrideDraft.start} /><span>to</span><input disabled={!overrideDraft.enabled} onChange={(event) => setOverrideDraft({ ...overrideDraft, end: event.target.value })} type="time" value={overrideDraft.end} /><div><button onClick={removeOverride} type="button">Use weekly schedule</button><button onClick={saveOverride} type="button">Save date</button></div></div>}
            </div>}
            <div className="still-work-form-grid">
              <label><span>Pay type</span><select value={draft.payType} onChange={(event) => setDraft({ ...draft, payType: event.target.value as WorkProfile['payType'] })}><option value="hourly">Hourly</option><option value="salary">Salary</option></select></label>
              <label><span>Currency</span><select value={draft.currency} onChange={(event) => setDraft({ ...draft, currency: event.target.value })}><option value="PHP">PHP — Peso</option><option value="USD">USD — Dollar</option><option value="EUR">EUR — Euro</option><option value="GBP">GBP — Pound</option><option value="CAD">CAD — Canadian dollar</option><option value="AUD">AUD — Australian dollar</option><option value="JPY">JPY — Yen</option></select></label>
              {draft.payType === 'hourly' ? <label><span>Hourly rate</span><input min="0" step="0.01" type="number" value={draft.hourlyRate} onChange={(event) => setNumber('hourlyRate', event.target.value)} /></label> : <label><span>Annual salary</span><input min="0" step="0.01" type="number" value={draft.annualSalary} onChange={(event) => setNumber('annualSalary', event.target.value)} /></label>}
              <label><span>Pay frequency</span><select value={draft.payFrequency} onChange={(event) => setDraft({ ...draft, payFrequency: event.target.value as WorkProfile['payFrequency'] })}><option value="weekly">Weekly</option><option value="biweekly">Every two weeks</option><option value="semimonthly">Twice a month</option><option value="monthly">Monthly</option></select></label>
              <label><span>Next payday</span><input onChange={(event) => setDraft({ ...draft, nextPaydayDate: event.target.value })} type="date" value={draft.nextPaydayDate ?? ''} /></label>
              <label><span>Pay period starts</span><input onChange={(event) => setDraft({ ...draft, payPeriodStartDate: event.target.value })} type="date" value={draft.payPeriodStartDate ?? ''} /></label>
              <label><span>Pay period ends</span><input onChange={(event) => setDraft({ ...draft, payPeriodEndDate: event.target.value })} type="date" value={draft.payPeriodEndDate ?? ''} /></label>
              <label><span>Weekly hours</span><input min="1" max="100" step="0.5" type="number" value={draft.weeklyHours} onChange={(event) => setNumber('weeklyHours', event.target.value)} /></label>
              <label><span>Default unpaid break</span><input min="0" max="480" step="5" type="number" value={draft.unpaidBreakMinutes} onChange={(event) => setNumber('unpaidBreakMinutes', event.target.value)} /><small>Minutes per shift</small></label>
              <label><span>Overtime after</span><input min="0" max="24" step="0.5" type="number" value={draft.overtimeAfterHours} onChange={(event) => setNumber('overtimeAfterHours', event.target.value)} /><small>Hours per shift</small></label>
              <label><span>Overtime multiplier</span><input min="1" max="5" step="0.1" type="number" value={draft.overtimeMultiplier} onChange={(event) => setNumber('overtimeMultiplier', event.target.value)} /></label>
              <label><span>Effective hourly</span><output>{currency(effectiveHourlyRate(draft), draft.currency)}</output></label>
            </div>
            <button className="work-save-button" type="submit">{saved ? <Check size={16} /> : <Save size={16} />}{saved ? 'Saved' : 'Save schedule & pay'}</button>
          </form>
        </details>
      </section>

      {editingShift && <div className="still-work-modal" role="presentation"><form className="card" onSubmit={submitShift}>
        <div className="still-work-modal-heading"><div><CalendarDays size={18} /><h2>{editingShift.id ? 'Edit shift' : 'Add past shift'}</h2></div><button onClick={() => setEditingShift(undefined)} type="button" aria-label="Close"><X size={18} /></button></div>
        <label><span>Started</span><input max={localDateTime(Date.now())} onChange={(event) => setEditingShift({ ...editingShift, value: { ...editingShift.value, startedAt: new Date(event.target.value).getTime() } })} required type="datetime-local" value={localDateTime(editingShift.value.startedAt)} /></label>
        <label><span>Ended</span><input max={localDateTime(Date.now())} onChange={(event) => setEditingShift({ ...editingShift, value: { ...editingShift.value, endedAt: new Date(event.target.value).getTime() } })} required type="datetime-local" value={editingShift.value.endedAt ? localDateTime(editingShift.value.endedAt) : ''} /></label>
        <label><span>Unpaid break</span><input min="0" max="480" onChange={(event) => setEditingShift({ ...editingShift, value: { ...editingShift.value, unpaidBreakMinutes: Number(event.target.value) } })} step="5" type="number" value={editingShift.value.unpaidBreakMinutes} /><small>Minutes</small></label>
        <label><span>Note</span><textarea onChange={(event) => setEditingShift({ ...editingShift, value: { ...editingShift.value, note: event.target.value } })} placeholder="Optional note" rows={3} value={editingShift.value.note ?? ''} /></label>
        {shiftError && <p className="still-work-error">{shiftError}</p>}
        <button className="work-save-button" type="submit"><Save size={16} />Save shift</button>
      </form></div>}

      {projectDraft && <div className="still-work-modal" role="presentation"><form className="card" onSubmit={saveProject}>
        <div className="still-work-modal-heading"><div><Target size={18} /><h2>{projects.some((item) => item.id === projectDraft.id) ? 'Edit work item' : 'Add project or goal'}</h2></div><button onClick={() => setProjectDraft(undefined)} type="button" aria-label="Close"><X size={18} /></button></div>
        <label><span>Title</span><input autoFocus={false} onChange={(event) => setProjectDraft({ ...projectDraft, title: event.target.value })} placeholder="What are you moving forward?" required value={projectDraft.title} /></label>
        <div className="still-work-modal-grid"><label><span>Type</span><select onChange={(event) => setProjectDraft({ ...projectDraft, kind: event.target.value as WorkProject['kind'] })} value={projectDraft.kind}><option value="project">Project</option><option value="goal">Goal</option></select></label><label><span>Status</span><select onChange={(event) => setProjectDraft({ ...projectDraft, status: event.target.value as WorkProject['status'] })} value={projectDraft.status}><option value="active">Active</option><option value="paused">Paused</option><option value="done">Done</option></select></label></div>
        <label><span>Progress</span><input min="0" max="100" onChange={(event) => setProjectDraft({ ...projectDraft, progress: Number(event.target.value) })} type="number" value={projectDraft.progress} /></label>
        <label><span>Due date</span><input onChange={(event) => setProjectDraft({ ...projectDraft, dueDate: event.target.value || undefined })} type="date" value={projectDraft.dueDate ?? ''} /></label>
        <label><span>Note</span><textarea onChange={(event) => setProjectDraft({ ...projectDraft, note: event.target.value })} rows={3} value={projectDraft.note ?? ''} /></label>
        <div className="still-work-modal-actions">{projects.some((item) => item.id === projectDraft.id) && <button className="is-danger" onClick={() => { commitProfile({ projects: projects.filter((item) => item.id !== projectDraft.id) }); setProjectDraft(undefined); }} type="button"><Trash2 size={15} />Delete</button>}<button className="work-save-button" type="submit"><Save size={16} />Save</button></div>
      </form></div>}

      {timeOffDraft && <div className="still-work-modal" role="presentation"><form className="card" onSubmit={saveTimeOff}>
        <div className="still-work-modal-heading"><div><CalendarDays size={18} /><h2>Time off</h2></div><button onClick={() => setTimeOffDraft(undefined)} type="button" aria-label="Close"><X size={18} /></button></div>
        <div className="still-work-modal-grid"><label><span>Type</span><select onChange={(event) => setTimeOffDraft({ ...timeOffDraft, type: event.target.value as WorkTimeOff['type'] })} value={timeOffDraft.type}><option value="vacation">Vacation</option><option value="sick">Sick</option><option value="personal">Personal</option><option value="other">Other</option></select></label><label><span>Status</span><select onChange={(event) => setTimeOffDraft({ ...timeOffDraft, status: event.target.value as WorkTimeOff['status'] })} value={timeOffDraft.status}><option value="planned">Planned</option><option value="approved">Approved</option><option value="taken">Taken</option></select></label></div>
        <div className="still-work-modal-grid"><label><span>Starts</span><input onChange={(event) => setTimeOffDraft({ ...timeOffDraft, startDate: event.target.value })} required type="date" value={timeOffDraft.startDate} /></label><label><span>Ends</span><input onChange={(event) => setTimeOffDraft({ ...timeOffDraft, endDate: event.target.value })} required type="date" value={timeOffDraft.endDate} /></label></div>
        <label><span>PTO hours</span><input min="0" onChange={(event) => setTimeOffDraft({ ...timeOffDraft, hours: Number(event.target.value) })} step="1" type="number" value={timeOffDraft.hours} /></label>
        <label><span>Note</span><textarea onChange={(event) => setTimeOffDraft({ ...timeOffDraft, note: event.target.value })} rows={3} value={timeOffDraft.note ?? ''} /></label>
        <div className="still-work-modal-actions">{timeOff.some((item) => item.id === timeOffDraft.id) && <button className="is-danger" onClick={() => { commitProfile({ timeOff: timeOff.filter((item) => item.id !== timeOffDraft.id) }); setTimeOffDraft(undefined); }} type="button"><Trash2 size={15} />Delete</button>}<button className="work-save-button" type="submit"><Save size={16} />Save</button></div>
      </form></div>}

      {contactDraft && <div className="still-work-modal" role="presentation"><form className="card" onSubmit={saveContact}>
        <div className="still-work-modal-heading"><div><UserRound size={18} /><h2>Work contact</h2></div><button onClick={() => setContactDraft(undefined)} type="button" aria-label="Close"><X size={18} /></button></div>
        <label><span>Name</span><input onChange={(event) => setContactDraft({ ...contactDraft, name: event.target.value })} required value={contactDraft.name} /></label>
        <label><span>Role / relationship</span><input onChange={(event) => setContactDraft({ ...contactDraft, role: event.target.value })} value={contactDraft.role ?? ''} /></label>
        <label><span>Note</span><textarea onChange={(event) => setContactDraft({ ...contactDraft, note: event.target.value })} rows={3} value={contactDraft.note ?? ''} /></label>
        <div className="still-work-modal-actions">{(profile.contacts ?? []).some((item) => item.id === contactDraft.id) && <button className="is-danger" onClick={() => { commitProfile({ contacts: (profile.contacts ?? []).filter((item) => item.id !== contactDraft.id) }); setContactDraft(undefined); }} type="button"><Trash2 size={15} />Delete</button>}<button className="work-save-button" type="submit"><Save size={16} />Save</button></div>
      </form></div>}
    </main>
  );
}
