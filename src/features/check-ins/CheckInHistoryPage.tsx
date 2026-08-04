import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
} from 'date-fns';
import { ArrowLeft, Flame, Pencil, Sparkles, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  deleteCheckIn,
  listCheckIns,
  saveCheckIn,
  type CheckInRecord,
} from '../../data/stillDb';
import { useAppStore } from '../../stores/useAppStore';
import { stillAssets } from '../../theme/stillAssets';
import { getLocalDateKey } from '../../theme/stillContext';

const moodOptions = [
  { asset: stillAssets.checkIn.mood.sad, label: 'Sad' },
  { asset: stillAssets.checkIn.mood.calm, label: 'Calm' },
  { asset: stillAssets.checkIn.mood.content, label: 'Content' },
  { asset: stillAssets.checkIn.mood.happy, label: 'Happy' },
  { asset: stillAssets.checkIn.mood.excited, label: 'Excited' },
];

const energyOptions = [
  { asset: stillAssets.checkIn.energy.exhausted, label: 'Exhausted' },
  { asset: stillAssets.checkIn.energy.low, label: 'Low' },
  { asset: stillAssets.checkIn.energy.balanced, label: 'Balanced' },
  { asset: stillAssets.checkIn.energy.high, label: 'High' },
  { asset: stillAssets.checkIn.energy.energized, label: 'Energized' },
];

function average(records: CheckInRecord[], key: 'mood' | 'energy') {
  const values = records.map((record) => record[key]).filter((value): value is number => value !== undefined);
  if (!values.length) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function CheckInEditor({
  record,
  onCancel,
  onSave,
}: {
  record: CheckInRecord;
  onCancel: () => void;
  onSave: (mood?: number, energy?: number) => void;
}) {
  const [mood, setMood] = useState(record.mood);
  const [energy, setEnergy] = useState(record.energy);

  return (
    <div className="sheet-backdrop" onClick={onCancel}>
      <section className="sheet checkin-history-editor" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="checkin-editor-title">
        <div className="sheet-handle" />
        <div className="checkin-editor-heading">
          <div>
            <p className="section-kicker">Correct your check-in</p>
            <h2 id="checkin-editor-title">{format(parseISO(record.date), 'MMMM d, yyyy')}</h2>
          </div>
          <button className="link-btn" onClick={onCancel} type="button" aria-label="Close"><X /></button>
        </div>
        <div className="checkin-editor-section">
          <strong>Mood</strong>
          <div className="checkin-editor-options">
            {moodOptions.map((option, index) => (
              <button className={mood === index + 1 ? 'is-selected' : ''} key={option.label} onClick={() => setMood(index + 1)} type="button" aria-pressed={mood === index + 1}>
                <img src={option.asset} alt="" /><span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="checkin-editor-section">
          <strong>Energy</strong>
          <div className="checkin-editor-options">
            {energyOptions.map((option, index) => (
              <button className={energy === index + 1 ? 'is-selected' : ''} key={option.label} onClick={() => setEnergy(index + 1)} type="button" aria-pressed={energy === index + 1}>
                <img src={option.asset} alt="" /><span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="task-editor-actions">
          <button className="task-secondary-button" onClick={onCancel} type="button">Cancel</button>
          <button className="task-primary-button" disabled={!mood && !energy} onClick={() => onSave(mood, energy)} type="button">Save changes</button>
        </div>
      </section>
    </div>
  );
}

export function CheckInHistoryPage() {
  const navigate = useNavigate();
  const replaceTodayCheckIn = useAppStore((state) => state.replaceTodayCheckIn);
  const [records, setRecords] = useState<CheckInRecord[]>([]);
  const [editing, setEditing] = useState<CheckInRecord>();
  const [loading, setLoading] = useState(true);
  const todayKey = getLocalDateKey();

  const refresh = useCallback(async () => {
    setRecords(await listCheckIns());
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const stats = useMemo(() => {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const weekly = records.filter((record) => {
      const date = parseISO(record.date);
      return date >= weekStart && date <= weekEnd;
    });
    const monthly = records.filter((record) => {
      const date = parseISO(record.date);
      return date >= monthStart && date <= monthEnd;
    });

    const dates = new Set(records.map((record) => record.date));
    let cursor = new Date();
    if (!dates.has(format(cursor, 'yyyy-MM-dd'))) cursor = subDays(cursor, 1);
    let streak = 0;
    while (dates.has(format(cursor, 'yyyy-MM-dd'))) {
      streak += 1;
      cursor = subDays(cursor, 1);
    }

    return { weekly, monthly, moodAverage: average(weekly, 'mood'), energyAverage: average(weekly, 'energy'), streak };
  }, [records]);

  const trendDays = useMemo(() => eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() }), []);
  const recordsByDate = useMemo(() => new Map(records.map((record) => [record.date, record])), [records]);

  const saveCorrection = async (mood?: number, energy?: number) => {
    if (!editing) return;
    const corrected = { ...editing, mood, energy, updatedAt: Date.now() };
    await saveCheckIn(corrected);
    if (editing.date === todayKey) replaceTodayCheckIn(mood, energy);
    setEditing(undefined);
    await refresh();
  };

  const remove = async (record: CheckInRecord) => {
    if (!window.confirm(`Delete the check-in from ${format(parseISO(record.date), 'MMMM d')}?`)) return;
    await deleteCheckIn(record.date);
    if (record.date === todayKey) replaceTodayCheckIn(undefined, undefined);
    await refresh();
  };

  return (
    <main className="shell checkin-history-page">
      <header className="checkin-history-header">
        <button className="checkin-back-button" onClick={() => navigate('/')} type="button" aria-label="Back to Life"><ArrowLeft size={20} /></button>
        <div>
          <p className="section-kicker">Your patterns</p>
          <h1>Check-in history</h1>
          <p className="subtle">Notice what changes without judging the day.</p>
        </div>
      </header>

      <section className="checkin-summary-grid" aria-label="Check-in summary">
        <article className="card checkin-summary-card"><Flame size={20} /><strong>{stats.streak}</strong><span>day streak</span></article>
        <article className="card checkin-summary-card"><Sparkles size={20} /><strong>{stats.weekly.length}</strong><span>this week</span></article>
        <article className="card checkin-summary-card"><span className="checkin-summary-emoji">🙂</span><strong>{stats.moodAverage?.toFixed(1) ?? '—'}</strong><span>avg. mood</span></article>
        <article className="card checkin-summary-card"><span className="checkin-summary-emoji">⚡</span><strong>{stats.energyAverage?.toFixed(1) ?? '—'}</strong><span>avg. energy</span></article>
      </section>

      <section className="card checkin-trend-card" aria-labelledby="checkin-trend-title">
        <div className="checkin-trend-heading"><div><p className="section-kicker">A gentle trend</p><h2 id="checkin-trend-title">Last seven days</h2></div><span>{stats.monthly.length} this month</span></div>
        <div className="checkin-trend-grid">
          {trendDays.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const record = recordsByDate.get(key);
            const mood = record?.mood ? moodOptions[record.mood - 1] : undefined;
            return (
              <div className="checkin-trend-day" key={key} aria-label={`${format(day, 'EEEE')}: ${mood?.label ?? 'no mood'}, energy ${record?.energy ?? 'not set'}`}>
                <span>{format(day, 'EEEEE')}</span>
                <div className="checkin-trend-mood">{mood ? <img src={mood.asset} alt="" /> : <i />}</div>
                <div className="checkin-energy-track"><b style={{ height: `${(record?.energy ?? 0) * 20}%` }} /></div>
              </div>
            );
          })}
        </div>
        <div className="checkin-trend-legend"><span><i className="mood-dot" />Mood</span><span><i className="energy-dot" />Energy</span></div>
      </section>

      <section className="checkin-history-list-section" aria-labelledby="checkin-list-title">
        <div className="checkin-list-heading"><div><p className="section-kicker">Past days</p><h2 id="checkin-list-title">All check-ins</h2></div><span>{records.length} saved</span></div>
        {loading ? <div className="checkin-history-empty">Loading your check-ins…</div> : records.length === 0 ? (
          <button className="checkin-history-empty" onClick={() => navigate('/')} type="button"><strong>No check-ins yet</strong><span>Return to Life and tell Still how today feels.</span></button>
        ) : (
          <div className="checkin-history-list">
            {records.map((record) => {
              const mood = record.mood ? moodOptions[record.mood - 1] : undefined;
              const energy = record.energy ? energyOptions[record.energy - 1] : undefined;
              return (
                <article className="card checkin-history-record" key={record.date}>
                  <time dateTime={record.date}><strong>{format(parseISO(record.date), 'd')}</strong><span>{format(parseISO(record.date), 'MMM')}</span></time>
                  <div className="checkin-record-values">
                    <div>{mood ? <img src={mood.asset} alt="" /> : <i />}<span><small>Mood</small><strong>{mood?.label ?? 'Not set'}</strong></span></div>
                    <div>{energy ? <img src={energy.asset} alt="" /> : <i />}<span><small>Energy</small><strong>{energy?.label ?? 'Not set'}</strong></span></div>
                  </div>
                  <div className="checkin-record-actions"><button onClick={() => setEditing(record)} type="button" aria-label={`Edit ${record.date}`}><Pencil size={16} /></button><button onClick={() => void remove(record)} type="button" aria-label={`Delete ${record.date}`}><Trash2 size={16} /></button></div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {editing && <CheckInEditor key={editing.date} record={editing} onCancel={() => setEditing(undefined)} onSave={(mood, energy) => void saveCorrection(mood, energy)} />}
    </main>
  );
}
