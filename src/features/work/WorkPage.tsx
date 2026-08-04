import {
  ArrowLeft,
  BriefcaseBusiness,
  Clock3,
  Eye,
  EyeOff,
  Play,
  Save,
  Square,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  effectiveHourlyRate,
  nextPayday,
  payPeriodEstimate,
  shiftEarnings,
  workedHours,
  type WorkProfile,
} from '../../domain/work';
import { useAppStore } from '../../stores/useAppStore';

const dayOptions = [
  { value: 1, label: 'M' },
  { value: 2, label: 'T' },
  { value: 3, label: 'W' },
  { value: 4, label: 'T' },
  { value: 5, label: 'F' },
  { value: 6, label: 'S' },
  { value: 0, label: 'S' },
];

function currency(value: number, code: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function durationLabel(hours: number) {
  const totalMinutes = Math.max(0, Math.floor(hours * 60));
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${wholeHours}h ${String(minutes).padStart(2, '0')}m`;
}

export function WorkPage() {
  const navigate = useNavigate();
  const profile = useAppStore((state) => state.workProfile);
  const shifts = useAppStore((state) => state.workShifts);
  const privacyBlur = useAppStore((state) => state.workPrivacyBlur);
  const updateProfile = useAppStore((state) => state.updateWorkProfile);
  const startShift = useAppStore((state) => state.startWorkShift);
  const endShift = useAppStore((state) => state.endWorkShift);
  const setPrivacyBlur = useAppStore((state) => state.setWorkPrivacyBlur);
  const [draft, setDraft] = useState<WorkProfile>(profile);
  const [saved, setSaved] = useState(false);
  const [now, setNow] = useState(Date.now());

  const activeShift = shifts.find((shift) => !shift.endedAt);

  useEffect(() => {
    if (!activeShift) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [activeShift]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayShifts = shifts.filter((shift) => shift.startedAt >= todayStart.getTime());
  const earnedToday = todayShifts.reduce((total, shift) =>
    total + (shift.endedAt && shift.expectedEarnings !== undefined
      ? shift.expectedEarnings
      : shiftEarnings(shift, profile, now)), 0);
  const workedToday = todayShifts.reduce((total, shift) => total + workedHours(shift, now), 0);
  const activeEarnings = activeShift ? shiftEarnings(activeShift, profile, now) : 0;

  const payday = useMemo(() => nextPayday(profile), [profile]);
  const periodEstimate = useMemo(() => payPeriodEstimate(profile), [profile]);

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized: WorkProfile = {
      ...draft,
      hourlyRate: Math.max(0, Number(draft.hourlyRate) || 0),
      annualSalary: Math.max(0, Number(draft.annualSalary) || 0),
      weeklyHours: Math.max(1, Number(draft.weeklyHours) || 40),
      unpaidBreakMinutes: Math.max(0, Number(draft.unpaidBreakMinutes) || 0),
      overtimeAfterHours: Math.max(0, Number(draft.overtimeAfterHours) || 0),
      overtimeMultiplier: Math.max(1, Number(draft.overtimeMultiplier) || 1),
    };
    updateProfile(normalized);
    setDraft(normalized);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  const setNumber = (key: keyof WorkProfile, value: string) => {
    setDraft((current) => ({ ...current, [key]: Number(value) }));
  };

  return (
    <main className="shell work-page">
      <header className="work-page-header">
        <button onClick={() => navigate('/')} type="button" aria-label="Back home"><ArrowLeft size={19} /></button>
        <div><p className="section-kicker">Life area</p><h1>Work</h1><p className="subtle">Your time, effort, and earnings in one calm view.</p></div>
        <button onClick={() => setPrivacyBlur(!privacyBlur)} type="button" aria-label={privacyBlur ? 'Show financial values' : 'Hide financial values'}>
          {privacyBlur ? <Eye size={19} /> : <EyeOff size={19} />}
        </button>
      </header>

      <section className="work-live-card">
        <div className="work-live-heading">
          <span><BriefcaseBusiness size={19} /></span>
          <div><p className="section-kicker">{activeShift ? 'Shift in progress' : 'Today at work'}</p><strong>{activeShift ? durationLabel(workedHours(activeShift, now)) : durationLabel(workedToday)}</strong></div>
        </div>
        <div className={privacyBlur ? 'private-value is-blurred' : 'private-value'}>
          <small>{activeShift ? 'Earned this shift' : 'Earned today'}</small>
          <strong>{currency(activeShift ? activeEarnings : earnedToday, profile.currency)}</strong>
        </div>
        <button className={activeShift ? 'work-clock-button is-active' : 'work-clock-button'} onClick={activeShift ? endShift : startShift} type="button">
          {activeShift ? <><Square size={17} /> Clock out</> : <><Play size={17} /> Clock in</>}
        </button>
        <p className="work-live-note">Includes {profile.unpaidBreakMinutes} min unpaid break and overtime after {profile.overtimeAfterHours} hours.</p>
      </section>

      <section className="work-summary-grid">
        <article className="card">
          <Clock3 size={18} />
          <small>Effective hourly</small>
          <strong className={privacyBlur ? 'private-value is-blurred' : 'private-value'}>{currency(effectiveHourlyRate(profile), profile.currency)}</strong>
        </article>
        <article className="card">
          <BriefcaseBusiness size={18} />
          <small>Next period estimate</small>
          <strong className={privacyBlur ? 'private-value is-blurred' : 'private-value'}>{currency(periodEstimate, profile.currency)}</strong>
          <span>Cycle near {payday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
        </article>
      </section>

      <section className="settings-section">
        <div className="settings-section-heading"><span><BriefcaseBusiness size={19} /></span><div><h2>Work profile</h2><p>These settings power live earnings and future payday estimates.</p></div></div>
        <form className="card work-profile-form" onSubmit={save}>
          <div className="work-form-grid">
            <label><span>Pay type</span><select value={draft.payType} onChange={(event) => setDraft({ ...draft, payType: event.target.value as WorkProfile['payType'] })}><option value="hourly">Hourly</option><option value="salary">Salary</option></select></label>
            <label><span>Currency</span><select value={draft.currency} onChange={(event) => setDraft({ ...draft, currency: event.target.value })}><option value="PHP">PHP — Philippine peso</option><option value="USD">USD — US dollar</option><option value="EUR">EUR — Euro</option><option value="GBP">GBP — British pound</option><option value="CAD">CAD — Canadian dollar</option><option value="AUD">AUD — Australian dollar</option><option value="JPY">JPY — Japanese yen</option></select></label>
            {draft.payType === 'hourly' ? (
              <label><span>Hourly rate</span><input min="0" step="0.01" type="number" value={draft.hourlyRate} onChange={(event) => setNumber('hourlyRate', event.target.value)} /></label>
            ) : (
              <label><span>Annual salary</span><input min="0" step="0.01" type="number" value={draft.annualSalary} onChange={(event) => setNumber('annualSalary', event.target.value)} /></label>
            )}
            <label><span>Pay frequency</span><select value={draft.payFrequency} onChange={(event) => setDraft({ ...draft, payFrequency: event.target.value as WorkProfile['payFrequency'] })}><option value="weekly">Weekly</option><option value="biweekly">Every two weeks</option><option value="semimonthly">Twice a month</option><option value="monthly">Monthly</option></select></label>
            <label><span>Weekly hours</span><input min="1" max="100" step="0.5" type="number" value={draft.weeklyHours} onChange={(event) => setNumber('weeklyHours', event.target.value)} /></label>
            <label><span>Unpaid break</span><input min="0" max="480" step="5" type="number" value={draft.unpaidBreakMinutes} onChange={(event) => setNumber('unpaidBreakMinutes', event.target.value)} /><small>Minutes per shift</small></label>
            <label><span>Regular start</span><input type="time" value={draft.shiftStart} onChange={(event) => setDraft({ ...draft, shiftStart: event.target.value })} /></label>
            <label><span>Regular end</span><input type="time" value={draft.shiftEnd} onChange={(event) => setDraft({ ...draft, shiftEnd: event.target.value })} /></label>
            <label><span>Overtime after</span><input min="0" max="24" step="0.5" type="number" value={draft.overtimeAfterHours} onChange={(event) => setNumber('overtimeAfterHours', event.target.value)} /><small>Hours per shift</small></label>
            <label><span>Overtime multiplier</span><input min="1" max="5" step="0.1" type="number" value={draft.overtimeMultiplier} onChange={(event) => setNumber('overtimeMultiplier', event.target.value)} /><small>For example, 1.5×</small></label>
          </div>

          <fieldset className="work-days-field">
            <legend>Regular workdays</legend>
            <div>{dayOptions.map((day) => <button className={draft.regularDays.includes(day.value) ? 'is-selected' : ''} key={`${day.value}-${day.label}`} onClick={() => setDraft((current) => ({ ...current, regularDays: current.regularDays.includes(day.value) ? current.regularDays.filter((value) => value !== day.value) : [...current.regularDays, day.value] }))} type="button" aria-pressed={draft.regularDays.includes(day.value)}>{day.label}</button>)}</div>
          </fieldset>

          <button className="work-save-button" type="submit"><Save size={16} /> {saved ? 'Saved' : 'Save work profile'}</button>
        </form>
      </section>

      <section className="settings-section">
        <div className="settings-section-heading"><span><Clock3 size={19} /></span><div><h2>Recent shifts</h2><p>Your latest clocked sessions on this device.</p></div></div>
        <div className="work-shift-list">
          {shifts.length === 0 ? <div className="card work-shift-empty">Clock in when your next shift begins.</div> : shifts.slice(0, 8).map((shift) => (
            <article className="card work-shift-row" key={shift.id}>
              <div><strong>{new Date(shift.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</strong><span>{new Date(shift.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – {shift.endedAt ? new Date(shift.endedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Now'}</span></div>
              <div><strong>{durationLabel(workedHours(shift, now))}</strong><span className={privacyBlur ? 'private-value is-blurred' : 'private-value'}>{currency(shift.endedAt && shift.expectedEarnings !== undefined ? shift.expectedEarnings : shiftEarnings(shift, profile, now), profile.currency)}</span></div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
