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
  Trash2,
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
  type WorkProfile,
  type WorkScheduleOverride,
  type WorkShift,
  type WorkShiftInput,
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

export function WorkPage() {
  const navigate = useNavigate();
  const profile = useAppStore((state) => state.workProfile);
  const shifts = useAppStore((state) => state.workShifts);
  const privacyBlur = useAppStore((state) => state.workPrivacyBlur);
  const updateProfile = useAppStore((state) => state.updateWorkProfile);
  const startShift = useAppStore((state) => state.startWorkShift);
  const endShift = useAppStore((state) => state.endWorkShift);
  const toggleBreak = useAppStore((state) => state.toggleWorkBreak);
  const addShift = useAppStore((state) => state.addWorkShift);
  const updateShift = useAppStore((state) => state.updateWorkShift);
  const deleteShift = useAppStore((state) => state.deleteWorkShift);
  const setPrivacyBlur = useAppStore((state) => state.setWorkPrivacyBlur);
  const [draft, setDraft] = useState<WorkProfile>({
    ...profile,
    weeklySchedule: normalizedWorkSchedule(profile),
    scheduleOverrides: profile.scheduleOverrides ?? [],
  });
  const [saved, setSaved] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [scheduleView, setScheduleView] = useState<'week' | 'month'>('week');
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string>();
  const [overrideDraft, setOverrideDraft] = useState<WorkScheduleOverride>();
  const [editingShift, setEditingShift] = useState<{ id?: string; value: WorkShiftInput }>();
  const [shiftError, setShiftError] = useState('');

  const activeShift = shifts.find((shift) => !shift.endedAt);
  const onBreak = Boolean(activeShift?.breakStartedAt);

  useEffect(() => {
    if (!activeShift) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [activeShift]);

  const todayStart = new Date();
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
  const recentShifts = useMemo(() => [...shifts].sort((a, b) => b.startedAt - a.startedAt).slice(0, 12), [shifts]);

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

  return (
    <main className="shell work-page still-work-page">
      <header className="still-work-header">
        <button onClick={() => navigate('/')} type="button" aria-label="Back home"><ArrowLeft size={19} /></button>
        <div><p className="section-kicker">Life area</p><h1>Work</h1><p>Your shifts, time, and pay in one calm place.</p></div>
        <img src="/assets/cozy/work-cozy-desk.png" alt="" aria-hidden="true" />
        <button onClick={() => document.getElementById('work-settings')?.scrollIntoView({ behavior: 'smooth' })} type="button" aria-label="Work settings"><Settings2 size={19} /></button>
      </header>

      <section className="still-work-live card">
        <div className="still-work-live-top">
          <span className="still-work-icon"><BriefcaseBusiness size={18} /></span>
          <div><small>{activeShift ? (onBreak ? 'On break' : 'Working now') : 'Today'}</small><strong className={privacyBlur ? 'private-value is-blurred' : 'private-value'}>{currency(earnedToday, profile.currency)}</strong></div>
          <button onClick={() => setPrivacyBlur(!privacyBlur)} type="button" aria-label={privacyBlur ? 'Show earnings' : 'Hide earnings'}>{privacyBlur ? <Eye size={18} /> : <EyeOff size={18} />}</button>
        </div>
        <div className="still-work-live-meta"><span>{durationLabel(activeShift ? workedHours(activeShift, now) : workedToday)}</span><span>{activeShift ? (onBreak ? 'paused' : 'on the clock') : 'worked today'}</span></div>
        <div className="still-work-actions" aria-label="Shift controls">
          <button disabled={Boolean(activeShift)} onClick={startShift} type="button"><LogIn size={18} />Clock in</button>
          <button className={onBreak ? 'is-active' : ''} disabled={!activeShift} onClick={toggleBreak} type="button"><Coffee size={18} />{onBreak ? 'Resume' : 'Break'}</button>
          <button disabled={!activeShift} onClick={endShift} type="button"><LogOut size={18} />Clock out</button>
        </div>
      </section>

      <section className="still-work-summary" aria-label="Work overview">
        <article className="card"><small>Next shift</small><strong>{nextShift ? nextShift.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Not scheduled'}</strong><span>{nextShift ? `${nextShift.start} – ${nextShift.end}` : 'Set your schedule below'}</span></article>
        <article className="card"><small>This week</small><strong>{durationLabel(weekHours)}</strong><span>{weeklyProgress}% of {durationLabel(profile.weeklyHours)}</span></article>
        <article className="card"><small>Week earned</small><strong className={privacyBlur ? 'private-value is-blurred' : 'private-value'}>{currency(weekEarnings, profile.currency)}</strong><span>{durationLabel(weekOvertime)} overtime</span></article>
        <article className="card"><small>Next payday</small><strong>{payday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</strong><span className={privacyBlur ? 'private-value is-blurred' : 'private-value'}>{currency(periodEstimate, profile.currency)} estimate</span></article>
      </section>

      <section className="still-work-section">
        <div className="still-work-section-heading"><div><p className="section-kicker">Weekly pulse</p><h2>Your work at a glance</h2><p>Progress without turning work into a scoreboard.</p></div></div>
        <div className="card" style={{ padding: '18px 18px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}><strong style={{ color: 'var(--text-strong)', fontSize: 16 }}>{durationLabel(weekHours)} this week</strong><span style={{ color: 'var(--muted)', fontSize: 12 }}>{weeklyProgress}%</span></div>
          <div aria-label={`${weeklyProgress}% of weekly hours`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={weeklyProgress} style={{ height: 8, marginTop: 12, overflow: 'hidden', borderRadius: 999, background: 'rgba(139,116,222,.10)' }}><span style={{ display: 'block', width: `${weeklyProgress}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#b7a4ef,#8a72d8)' }} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10, marginTop: 18 }}>
            <div><small style={{ display: 'block', color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>Shifts</small><strong style={{ color: 'var(--text-strong)', fontSize: 15 }}>{completedWeekShifts.length}</strong></div>
            <div><small style={{ display: 'block', color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>Average</small><strong style={{ color: 'var(--text-strong)', fontSize: 15 }}>{averageShift ? durationLabel(averageShift) : '—'}</strong></div>
            <div><small style={{ display: 'block', color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>Workdays</small><strong style={{ color: 'var(--text-strong)', fontSize: 15 }}>{scheduledDays}/week</strong></div>
          </div>
        </div>
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
          <summary className="card" style={{ cursor: 'pointer', fontWeight: 800, color: 'var(--text-strong)', listStyle: 'none' }}><span>Schedule & pay settings</span><small style={{ display: 'block', marginTop: 4, color: 'var(--muted)', fontWeight: 500 }}>Workdays, pay rate, payday, breaks, and overtime</small></summary>
          <form className="card still-work-settings" onSubmit={saveProfile} style={{ marginTop: 10 }}>
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
    </main>
  );
}
