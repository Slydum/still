import {
  ArrowLeft,
  BriefcaseBusiness,
  Check,
  Coffee,
  Eye,
  EyeOff,
  LogIn,
  LogOut,
  Save,
  Settings2,
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
  return `${Math.floor(totalMinutes / 60)}h ${String(totalMinutes % 60).padStart(2, '0')}m`;
}

function nextScheduledDay(profile: WorkProfile) {
  const now = new Date();
  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    if (profile.regularDays.includes(candidate.getDay())) return candidate;
  }
  return now;
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
  const setPrivacyBlur = useAppStore((state) => state.setWorkPrivacyBlur);
  const [draft, setDraft] = useState<WorkProfile>(profile);
  const [saved, setSaved] = useState(false);
  const [now, setNow] = useState(Date.now());

  const activeShift = shifts.find((shift) => !shift.endedAt);
  const onBreak = Boolean(activeShift?.breakStartedAt);

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
  const payday = useMemo(() => nextPayday(profile), [profile]);
  const periodEstimate = useMemo(() => payPeriodEstimate(profile), [profile]);
  const scheduledDay = useMemo(() => nextScheduledDay(profile), [profile]);

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
    <main className="shell cozy-area-page cozy-work-page">
      <header className="cozy-topbar">
        <button onClick={() => navigate('/')} type="button" aria-label="Back home"><ArrowLeft size={19} /></button>
        <span className="cozy-brand">Still.</span>
        <button onClick={() => document.getElementById('work-settings')?.scrollIntoView({ behavior: 'smooth' })} type="button" aria-label="Work settings"><Settings2 size={19} /></button>
      </header>

      <section className="cozy-area-intro">
        <div><p className="section-kicker">Life area</p><h1>Work</h1><p>Do your best, then rest.</p></div>
        <img src="/assets/cozy/work-teddy-shelf.png" alt="" aria-hidden="true" />
      </section>

      <section className="cozy-next-shift card">
        <div>
          <p className="section-kicker">Next shift</p>
          <strong>{scheduledDay.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</strong>
          <span>{profile.shiftStart} – {profile.shiftEnd}</span>
        </div>
        <img src="/assets/cozy/work-cozy-desk.png" alt="" aria-hidden="true" />
      </section>

      <section className="cozy-earned-card">
        <div>
          <p className="section-kicker">{activeShift ? (onBreak ? 'On break' : 'Earning now') : 'Earned today'}</p>
          <strong className={privacyBlur ? 'private-value is-blurred' : 'private-value'}>{currency(earnedToday, profile.currency)}</strong>
          <span>{activeShift ? durationLabel(workedHours(activeShift, now)) : `${durationLabel(workedToday)} worked`}</span>
        </div>
        <button onClick={() => setPrivacyBlur(!privacyBlur)} type="button" aria-label={privacyBlur ? 'Show earnings' : 'Hide earnings'}>{privacyBlur ? <Eye size={18} /> : <EyeOff size={18} />}</button>
        <img src="/assets/cozy/work-briefcase.png" alt="" aria-hidden="true" />
      </section>

      <section className="cozy-clock-actions" aria-label="Shift controls">
        <button disabled={Boolean(activeShift)} onClick={startShift} type="button"><span><LogIn size={21} /></span><strong>Clock in</strong></button>
        <button className={onBreak ? 'is-active' : ''} disabled={!activeShift} onClick={toggleBreak} type="button"><span><Coffee size={21} /></span><strong>{onBreak ? 'Resume' : 'Start break'}</strong></button>
        <button disabled={!activeShift} onClick={endShift} type="button"><span><LogOut size={21} /></span><strong>Clock out</strong></button>
      </section>

      <label className="cozy-privacy-card card">
        <span><strong>Privacy mode</strong><small>Blur sensitive earnings on this screen.</small></span>
        <input checked={privacyBlur} onChange={(event) => setPrivacyBlur(event.target.checked)} type="checkbox" />
      </label>

      <section className="cozy-work-summary">
        <article className="card"><small>Next pay cycle</small><strong className={privacyBlur ? 'private-value is-blurred' : 'private-value'}>{currency(periodEstimate, profile.currency)}</strong><span>{payday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></article>
        <article className="card"><small>Effective hourly</small><strong className={privacyBlur ? 'private-value is-blurred' : 'private-value'}>{currency(effectiveHourlyRate(profile), profile.currency)}</strong><span>{profile.weeklyHours}h each week</span></article>
      </section>

      <section className="settings-section">
        <div className="settings-section-heading"><span><BriefcaseBusiness size={19} /></span><div><h2>Recent shifts</h2><p>Your latest sessions on this device.</p></div></div>
        <div className="work-shift-list">
          {shifts.length === 0 ? <div className="card work-shift-empty">Your first shift will appear here.</div> : shifts.slice(0, 6).map((shift) => (
            <article className="card work-shift-row" key={shift.id}>
              <div><strong>{new Date(shift.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</strong><span>{new Date(shift.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – {shift.endedAt ? new Date(shift.endedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : (shift.breakStartedAt ? 'On break' : 'Now')}</span></div>
              <div><strong>{durationLabel(workedHours(shift, now))}</strong><span className={privacyBlur ? 'private-value is-blurred' : 'private-value'}>{currency(shift.endedAt && shift.expectedEarnings !== undefined ? shift.expectedEarnings : shiftEarnings(shift, profile, now), profile.currency)}</span></div>
            </article>
          ))}
        </div>
      </section>

      <details className="cozy-work-settings card" id="work-settings">
        <summary><span><Settings2 size={18} /><strong>Work profile & pay rules</strong></span><small>Tap to edit</small></summary>
        <form onSubmit={save}>
          <div className="work-form-grid">
            <label><span>Pay type</span><select value={draft.payType} onChange={(event) => setDraft({ ...draft, payType: event.target.value as WorkProfile['payType'] })}><option value="hourly">Hourly</option><option value="salary">Salary</option></select></label>
            <label><span>Currency</span><select value={draft.currency} onChange={(event) => setDraft({ ...draft, currency: event.target.value })}><option value="PHP">PHP — Peso</option><option value="USD">USD — Dollar</option><option value="EUR">EUR — Euro</option><option value="GBP">GBP — Pound</option><option value="CAD">CAD — Canadian dollar</option><option value="AUD">AUD — Australian dollar</option><option value="JPY">JPY — Yen</option></select></label>
            {draft.payType === 'hourly' ? <label><span>Hourly rate</span><input min="0" step="0.01" type="number" value={draft.hourlyRate} onChange={(event) => setNumber('hourlyRate', event.target.value)} /></label> : <label><span>Annual salary</span><input min="0" step="0.01" type="number" value={draft.annualSalary} onChange={(event) => setNumber('annualSalary', event.target.value)} /></label>}
            <label><span>Pay frequency</span><select value={draft.payFrequency} onChange={(event) => setDraft({ ...draft, payFrequency: event.target.value as WorkProfile['payFrequency'] })}><option value="weekly">Weekly</option><option value="biweekly">Every two weeks</option><option value="semimonthly">Twice a month</option><option value="monthly">Monthly</option></select></label>
            <label><span>Weekly hours</span><input min="1" max="100" step="0.5" type="number" value={draft.weeklyHours} onChange={(event) => setNumber('weeklyHours', event.target.value)} /></label>
            <label><span>Unpaid break</span><input min="0" max="480" step="5" type="number" value={draft.unpaidBreakMinutes} onChange={(event) => setNumber('unpaidBreakMinutes', event.target.value)} /><small>Minutes per shift</small></label>
            <label><span>Regular start</span><input type="time" value={draft.shiftStart} onChange={(event) => setDraft({ ...draft, shiftStart: event.target.value })} /></label>
            <label><span>Regular end</span><input type="time" value={draft.shiftEnd} onChange={(event) => setDraft({ ...draft, shiftEnd: event.target.value })} /></label>
            <label><span>Overtime after</span><input min="0" max="24" step="0.5" type="number" value={draft.overtimeAfterHours} onChange={(event) => setNumber('overtimeAfterHours', event.target.value)} /></label>
            <label><span>Overtime multiplier</span><input min="1" max="5" step="0.1" type="number" value={draft.overtimeMultiplier} onChange={(event) => setNumber('overtimeMultiplier', event.target.value)} /></label>
          </div>
          <fieldset className="work-days-field"><legend>Regular workdays</legend><div>{dayOptions.map((day) => <button className={draft.regularDays.includes(day.value) ? 'is-selected' : ''} key={`${day.value}-${day.label}`} onClick={() => setDraft((current) => ({ ...current, regularDays: current.regularDays.includes(day.value) ? current.regularDays.filter((value) => value !== day.value) : [...current.regularDays, day.value] }))} type="button" aria-pressed={draft.regularDays.includes(day.value)}>{day.label}</button>)}</div></fieldset>
          <button className="work-save-button" type="submit">{saved ? <Check size={16} /> : <Save size={16} />} {saved ? 'Saved' : 'Save work profile'}</button>
        </form>
      </details>
    </main>
  );
}
