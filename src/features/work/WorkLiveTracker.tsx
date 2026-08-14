import { BriefcaseBusiness, Eye, EyeOff, LogIn, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  effectiveHourlyRate,
  shiftEarnings,
  shiftEarningsInRange,
  workedHours,
} from '../../domain/work';
import { useAppStore } from '../../stores/useAppStore';

function durationLabel(hours: number) {
  const totalSeconds = Math.max(0, Math.floor(hours * 3600));
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function money(value: number, currency: string, digits = 2) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);
}

export function WorkLiveTracker() {
  const profile = useAppStore((state) => state.workProfile);
  const shifts = useAppStore((state) => state.workShifts);
  const privacyBlur = useAppStore((state) => state.workPrivacyBlur);
  const startWorkShift = useAppStore((state) => state.startWorkShift);
  const endWorkShift = useAppStore((state) => state.endWorkShift);
  const setWorkPrivacyBlur = useAppStore((state) => state.setWorkPrivacyBlur);
  const [now, setNow] = useState(Date.now());
  const activeShift = shifts.find((shift) => !shift.endedAt);

  useEffect(() => {
    const refreshClock = () => setNow(Date.now());
    refreshClock();
    const timer = window.setInterval(refreshClock, activeShift ? 1000 : 30_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshClock();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [activeShift]);

  const nowDate = new Date(now);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const earnedToday = shifts.reduce(
    (total, shift) => total + shiftEarningsInRange(shift, profile, todayStart.getTime(), now, now),
    0,
  );
  const liveEarnings = activeShift ? shiftEarnings(activeShift, profile, now) : 0;
  const livePerSecond = activeShift
    ? Math.max(0, shiftEarnings(activeShift, profile, now + 1000) - liveEarnings)
    : Math.max(0, effectiveHourlyRate(profile) / 3600);
  const liveElapsed = activeShift ? workedHours(activeShift, now) : 0;

  return (
    <section className="work-live-card card" aria-label="Live work and pay tracker">
      <div className="work-live-top"><span className="work-live-icon"><BriefcaseBusiness size={21} /></span><div className="work-live-copy"><small>{activeShift ? 'Working now' : 'Ready when you are'}</small><strong className={privacyBlur && activeShift ? 'is-private' : ''}>{activeShift ? money(liveEarnings, profile.currency) : nowDate.toLocaleDateString(undefined, { weekday: 'long' })}</strong></div><button className="work-live-eye" onClick={() => setWorkPrivacyBlur(!privacyBlur)} type="button" aria-label={privacyBlur ? 'Show earnings' : 'Hide earnings'}>{privacyBlur ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>
      <div className="work-live-meta">{activeShift ? <><span>{durationLabel(liveElapsed)}</span><span className={privacyBlur ? 'is-private' : ''}>{money(livePerSecond, profile.currency, 4)} / sec</span><span className={privacyBlur ? 'is-private' : ''}>{money(earnedToday, profile.currency)} today</span></> : <><span>No break timer</span><span className={privacyBlur ? 'is-private' : ''}>{money(livePerSecond, profile.currency, 4)} / sec</span></>}</div>
      <div className="work-live-actions"><button disabled={Boolean(activeShift)} onClick={startWorkShift} type="button"><LogIn size={18} />Clock in</button><button disabled={!activeShift} onClick={endWorkShift} type="button"><LogOut size={18} />Clock out</button></div>
    </section>
  );
}
