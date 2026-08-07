import {
  addWeeks,
  format,
  parseISO,
} from 'date-fns';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  HeartPulse,
  ReceiptText,
  Sparkles,
  Timer,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listCheckIns, type CheckInRecord } from '../../data/stillDb';
import {
  buildWeeklyReflection,
  getWeekWindow,
  type WeeklyReflection,
} from '../../domain/weeklyReflection';
import type { LifeAreaId } from '../../domain/lifeAreas';
import { useAppStore } from '../../stores/useAppStore';
import { getLocalDateKey } from '../../theme/stillContext';
import { getEventOccurrences } from '../calendar/eventUtils';
import './weekly-reflection.css';

const lifeAreas: Array<{ id: LifeAreaId; label: string }> = [
  { id: 'work', label: 'Work' },
  { id: 'love', label: 'Love' },
  { id: 'health', label: 'Health' },
  { id: 'money', label: 'Money' },
];

function weekLabel(startDate: string, endDate: string) {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  if (start.getFullYear() === end.getFullYear()) {
    if (start.getMonth() === end.getMonth()) {
      return `${format(start, 'MMM d')}–${format(end, 'd, yyyy')}`;
    }
    return `${format(start, 'MMM d')}–${format(end, 'MMM d, yyyy')}`;
  }
  return `${format(start, 'MMM d, yyyy')}–${format(end, 'MMM d, yyyy')}`;
}

function metricDelta(current: number, previous: number) {
  const difference = current - previous;
  if (difference === 0) return 'Same as last week';
  return `${difference > 0 ? '+' : ''}${difference} from last week`;
}

function WeeklyMetric({
  icon,
  value,
  label,
  comparison,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  comparison?: string;
}) {
  return (
    <article className="card weekly-metric-card">
      <span className="weekly-metric-icon">{icon}</span>
      <strong>{value}</strong>
      <span>{label}</span>
      {comparison && <small>{comparison}</small>}
    </article>
  );
}

function buildReflectionForAnchor(
  anchorDate: string,
  tasks: ReturnType<typeof useAppStore.getState>['tasks'],
  events: ReturnType<typeof useAppStore.getState>['events'],
  journalEntries: ReturnType<typeof useAppStore.getState>['journalEntries'],
  expenses: ReturnType<typeof useAppStore.getState>['expenses'],
  workShifts: ReturnType<typeof useAppStore.getState>['workShifts'],
  checkIns: CheckInRecord[],
) {
  const { startDate, endDate } = getWeekWindow(anchorDate);
  const eventOccurrences = getEventOccurrences(events, startDate, endDate).map((event) => ({
    id: event.occurrenceId,
    date: event.occurrenceStartDate,
    areaId: event.areaId ?? (event.category === 'personal' ? undefined : event.category),
  }));

  return buildWeeklyReflection({
    anchorDate,
    tasks,
    events: eventOccurrences,
    journalEntries,
    expenses,
    workShifts,
    checkIns,
  });
}

export function WeeklyReflectionPage() {
  const navigate = useNavigate();
  const tasks = useAppStore((state) => state.tasks);
  const events = useAppStore((state) => state.events);
  const journalEntries = useAppStore((state) => state.journalEntries);
  const expenses = useAppStore((state) => state.expenses);
  const workShifts = useAppStore((state) => state.workShifts);
  const [anchorDate, setAnchorDate] = useState(() => getLocalDateKey());
  const [checkIns, setCheckIns] = useState<CheckInRecord[]>([]);
  const [loadingCheckIns, setLoadingCheckIns] = useState(true);

  const refreshCheckIns = useCallback(async () => {
    setCheckIns(await listCheckIns());
    setLoadingCheckIns(false);
  }, []);

  useEffect(() => {
    void refreshCheckIns();
  }, [refreshCheckIns]);

  const reflection = useMemo(() => buildReflectionForAnchor(
    anchorDate,
    tasks,
    events,
    journalEntries,
    expenses,
    workShifts,
    checkIns,
  ), [anchorDate, checkIns, events, expenses, journalEntries, tasks, workShifts]);

  const previousReflection = useMemo(() => buildReflectionForAnchor(
    format(addWeeks(parseISO(anchorDate), -1), 'yyyy-MM-dd'),
    tasks,
    events,
    journalEntries,
    expenses,
    workShifts,
    checkIns,
  ), [anchorDate, checkIns, events, expenses, journalEntries, tasks, workShifts]);

  const currentWindow = getWeekWindow(getLocalDateKey());
  const isCurrentWeek = reflection.startDate === currentWindow.startDate;
  const hasPreviousActivity = previousReflection.totalActivity > 0;
  const maxDayActivity = Math.max(1, ...reflection.dayActivity.map((day) => day.count));
  const maxAreaActivity = Math.max(1, ...lifeAreas.map((area) => reflection.areaActivity[area.id]));

  const moveWeek = (offset: number) => {
    setAnchorDate((current) => format(addWeeks(parseISO(current), offset), 'yyyy-MM-dd'));
  };

  return (
    <main className="shell weekly-reflection-page">
      <header className="weekly-reflection-header">
        <button className="checkin-back-button" onClick={() => navigate('/')} type="button" aria-label="Back to Life">
          <ArrowLeft size={20} />
        </button>
        <div>
          <p className="section-kicker">Look back gently</p>
          <h1>Weekly reflection</h1>
          <p className="subtle">A factual view of what your own records say about the week.</p>
        </div>
      </header>

      <section className="card weekly-reflection-hero" aria-labelledby="weekly-reflection-title">
        <div className="weekly-reflection-hero-copy">
          <span><Sparkles size={18} /> {isCurrentWeek ? 'This week' : 'Past week'}</span>
          <h2 id="weekly-reflection-title">{weekLabel(reflection.startDate, reflection.endDate)}</h2>
          <p>
            {reflection.totalActivity === 0
              ? 'No activity is recorded for this week yet.'
              : `${reflection.totalActivity} recorded moments across ${reflection.activeDays} ${reflection.activeDays === 1 ? 'day' : 'days'}.`}
          </p>
        </div>
        <div className="weekly-week-controls" aria-label="Choose week">
          <button onClick={() => moveWeek(-1)} type="button" aria-label="Previous week"><ChevronLeft size={18} /></button>
          <button disabled={isCurrentWeek} onClick={() => moveWeek(1)} type="button" aria-label="Next week"><ChevronRight size={18} /></button>
        </div>
      </section>

      <section className="weekly-metric-grid" aria-label="Week at a glance">
        <WeeklyMetric icon={<CheckSquare size={19} />} value={reflection.completedTasks} label="tasks completed" comparison={hasPreviousActivity ? metricDelta(reflection.completedTasks, previousReflection.completedTasks) : undefined} />
        <WeeklyMetric icon={<CalendarDays size={19} />} value={reflection.events} label="calendar events" comparison={hasPreviousActivity ? metricDelta(reflection.events, previousReflection.events) : undefined} />
        <WeeklyMetric icon={<BookOpen size={19} />} value={reflection.reflections} label="reflections" comparison={hasPreviousActivity ? metricDelta(reflection.reflections, previousReflection.reflections) : undefined} />
        <WeeklyMetric icon={<HeartPulse size={19} />} value={reflection.checkIns} label="check-ins" comparison={hasPreviousActivity ? metricDelta(reflection.checkIns, previousReflection.checkIns) : undefined} />
        <WeeklyMetric icon={<Timer size={19} />} value={reflection.shifts} label="work shifts" />
        <WeeklyMetric icon={<ReceiptText size={19} />} value={reflection.expenses} label="expenses recorded" />
      </section>

      {reflection.highlights.length > 0 && (
        <section className="card weekly-highlights" aria-labelledby="weekly-highlights-title">
          <div className="weekly-section-heading">
            <div><p className="section-kicker">What stands out</p><h2 id="weekly-highlights-title">From the records</h2></div>
            <span>Facts, not guesses</span>
          </div>
          <ul>
            {reflection.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
          </ul>
        </section>
      )}

      <section className="weekly-reflection-two-column">
        <article className="card weekly-life-areas" aria-labelledby="weekly-life-areas-title">
          <div className="weekly-section-heading">
            <div><p className="section-kicker">Life areas</p><h2 id="weekly-life-areas-title">Where records connected</h2></div>
          </div>
          <div className="weekly-area-list">
            {lifeAreas.map((area) => {
              const count = reflection.areaActivity[area.id];
              return (
                <button key={area.id} onClick={() => navigate(`/life/${area.id}`)} type="button">
                  <span><strong>{area.label}</strong><small>{count} {count === 1 ? 'record' : 'records'}</small></span>
                  <i><b style={{ width: `${(count / maxAreaActivity) * 100}%` }} /></i>
                </button>
              );
            })}
          </div>
          <p className="weekly-footnote">Check-ins stay separate here. Still does not infer a Life Area from mood or energy.</p>
        </article>

        <article className="card weekly-checkin-rhythm" aria-labelledby="weekly-checkin-rhythm-title">
          <div className="weekly-section-heading">
            <div><p className="section-kicker">Check-in rhythm</p><h2 id="weekly-checkin-rhythm-title">What you logged</h2></div>
          </div>
          {loadingCheckIns ? (
            <p className="weekly-empty-copy">Loading check-ins…</p>
          ) : reflection.checkIns === 0 ? (
            <p className="weekly-empty-copy">No check-ins are recorded for this week.</p>
          ) : (
            <div className="weekly-average-grid">
              <div><span>Mood average</span><strong>{reflection.moodAverage ?? '—'} <small>/ 5</small></strong></div>
              <div><span>Energy average</span><strong>{reflection.energyAverage ?? '—'} <small>/ 5</small></strong></div>
            </div>
          )}
          <p className="weekly-footnote">Averages summarize the values you chose; they are not a wellbeing score.</p>
        </article>
      </section>

      <section className="card weekly-rhythm-card" aria-labelledby="weekly-rhythm-title">
        <div className="weekly-section-heading">
          <div><p className="section-kicker">Week rhythm</p><h2 id="weekly-rhythm-title">Recorded activity by day</h2></div>
          <span>{reflection.activeDays} active {reflection.activeDays === 1 ? 'day' : 'days'}</span>
        </div>
        <div className="weekly-day-bars">
          {reflection.dayActivity.map((day) => (
            <div key={day.date} className="weekly-day-bar" aria-label={`${format(parseISO(day.date), 'EEEE')}: ${day.count} recorded items`}>
              <div><b style={{ height: `${Math.max(day.count ? 12 : 2, (day.count / maxDayActivity) * 100)}%` }} /></div>
              <strong>{format(parseISO(day.date), 'EEEEE')}</strong>
              <small>{day.count || '—'}</small>
            </div>
          ))}
        </div>
      </section>

      {reflection.currencyTotals.length > 0 && (
        <section className="card weekly-spending-card" aria-labelledby="weekly-spending-title">
          <div className="weekly-section-heading">
            <div><p className="section-kicker">Money recorded</p><h2 id="weekly-spending-title">Spending captured this week</h2></div>
          </div>
          <div className="weekly-currency-list">
            {reflection.currencyTotals.map((total) => (
              <div key={total.currency}>
                <span>{total.count} {total.count === 1 ? 'expense' : 'expenses'}</span>
                <strong>{total.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {total.currency}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="weekly-reflection-note">
        <Sparkles size={18} />
        <p>Still builds this reflection locally from the records already in your space. It does not send them to an AI service to interpret your week.</p>
      </section>
    </main>
  );
}
