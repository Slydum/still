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
import {
  ArrowLeft,
  BookOpen,
  Flame,
  Pencil,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { selectUpliftingCheckInQuote } from '../../content/quoteEngine';
import {
  deleteCheckIn,
  listCheckIns,
  saveCheckIn,
  type CheckInRecord,
} from '../../data/stillDb';
import { useAppStore } from '../../stores/useAppStore';
import { stillAssets } from '../../theme/stillAssets';
import { createStillContext, getLocalDateKey } from '../../theme/stillContext';

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
  const values = records
    .map((record) => record[key])
    .filter((value): value is number => value !== undefined);

  if (!values.length) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function moodInsight(value?: number) {
  if (value === undefined) {
    return {
      title: 'Still unfolding',
      detail: 'A few more check-ins will reveal a gentler pattern.',
    };
  }

  if (value < 2.5) {
    return {
      title: 'Heavier days',
      detail: 'You have been carrying more lately. Extra kindness may help.',
    };
  }

  if (value < 3.75) {
    return {
      title: 'Finding balance',
      detail: 'Your feelings have been settling around a steadier middle.',
    };
  }

  return {
    title: 'Brighter moments',
    detail: 'More warmth and lift have been showing up in your week.',
  };
}

function energyInsight(value?: number) {
  if (value === undefined) {
    return {
      title: 'No rhythm yet',
      detail: 'Keep checking in and your energy pattern will become clearer.',
    };
  }

  if (value < 2.5) {
    return {
      title: 'Quieter energy',
      detail: 'Your body has been asking for a slower and more restorative pace.',
    };
  }

  if (value < 3.75) {
    return {
      title: 'Steady energy',
      detail: 'Your energy has stayed mostly grounded and manageable.',
    };
  }

  return {
    title: 'More momentum',
    detail: 'You have had more energy available to move and engage.',
  };
}

function answerForRecord(record: CheckInRecord) {
  if (!record.mood || !record.energy) {
    return "I left this check-in unfinished, and I can return when I'm ready.";
  }

  return selectUpliftingCheckInQuote(createStillContext({
    date: parseISO(record.date),
    mood: record.mood,
    energy: record.energy,
  }));
}

function CheckInEditor({
  record,
  onCancel,
  onSave,
}: {
  record: CheckInRecord;
  onCancel: () => void;
  onSave: (mood: number, energy: number) => void;
}) {
  const [mood, setMood] = useState<number>();
  const [energy, setEnergy] = useState<number>();
  const [completed, setCompleted] = useState<{ mood: number; energy: number }>();

  const chooseMood = (value: number) => {
    setMood(value);
    if (energy) setCompleted({ mood: value, energy });
  };

  const chooseEnergy = (value: number) => {
    setEnergy(value);
    if (mood) setCompleted({ mood, energy: value });
  };

  const chooseAgain = () => {
    setMood(undefined);
    setEnergy(undefined);
    setCompleted(undefined);
  };

  const answer = completed
    ? selectUpliftingCheckInQuote(createStillContext({
        date: parseISO(record.date),
        mood: completed.mood,
        energy: completed.energy,
      }))
    : '';

  return (
    <div className="sheet-backdrop" onClick={onCancel}>
      <section
        className="sheet checkin-history-editor"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkin-editor-title"
      >
        <div className="sheet-handle" />
        <div className="checkin-editor-heading">
          <div>
            <p className="section-kicker">Change your answer</p>
            <h2 id="checkin-editor-title">{format(parseISO(record.date), 'MMMM d, yyyy')}</h2>
          </div>
          <button className="link-btn" onClick={onCancel} type="button" aria-label="Close">
            <X />
          </button>
        </div>

        {completed ? (
          <div className="checkin-history-editor-answer" aria-live="polite">
            <blockquote>{answer}</blockquote>
            <div className="task-editor-actions">
              <button className="task-secondary-button" onClick={chooseAgain} type="button">
                Choose again
              </button>
              <button
                className="task-primary-button"
                onClick={() => onSave(completed.mood, completed.energy)}
                type="button"
              >
                Save answer
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="checkin-editor-section">
              <strong>Mood</strong>
              <div className="checkin-editor-options">
                {moodOptions.map((option, index) => (
                  <button
                    className={mood === index + 1 ? 'is-selected' : ''}
                    key={option.label}
                    onClick={() => chooseMood(index + 1)}
                    type="button"
                    aria-label={`Mood: ${option.label}`}
                    aria-pressed={mood === index + 1}
                  >
                    <img src={option.asset} alt="" />
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="checkin-editor-section">
              <strong>Energy</strong>
              <div className="checkin-editor-options">
                {energyOptions.map((option, index) => (
                  <button
                    className={energy === index + 1 ? 'is-selected' : ''}
                    key={option.label}
                    onClick={() => chooseEnergy(index + 1)}
                    type="button"
                    aria-label={`Energy: ${option.label}`}
                    aria-pressed={energy === index + 1}
                  >
                    <img src={option.asset} alt="" />
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="task-editor-actions">
              <button className="task-secondary-button" onClick={onCancel} type="button">
                Cancel
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export function CheckInHistoryPage() {
  const navigate = useNavigate();
  const replaceTodayCheckIn = useAppStore((state) => state.replaceTodayCheckIn);
  const openJournalEditor = useAppStore((state) => state.openJournalEditor);
  const [records, setRecords] = useState<CheckInRecord[]>([]);
  const [editing, setEditing] = useState<CheckInRecord>();
  const [flippedDate, setFlippedDate] = useState<string>();
  const [loading, setLoading] = useState(true);
  const todayKey = getLocalDateKey();

  const refresh = useCallback(async () => {
    setRecords(await listCheckIns());
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

    return {
      weekly,
      monthly,
      mood: moodInsight(average(weekly, 'mood')),
      energy: energyInsight(average(weekly, 'energy')),
      streak,
    };
  }, [records]);

  const trendDays = useMemo(
    () => eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() }),
    [],
  );
  const recordsByDate = useMemo(
    () => new Map(records.map((record) => [record.date, record])),
    [records],
  );

  const saveCorrection = async (mood: number, energy: number) => {
    if (!editing) return;

    const corrected = { ...editing, mood, energy, updatedAt: Date.now() };
    await saveCheckIn(corrected);
    if (editing.date === todayKey) replaceTodayCheckIn(mood, energy);
    setEditing(undefined);
    setFlippedDate(undefined);
    await refresh();
  };

  const remove = async (record: CheckInRecord) => {
    if (!window.confirm(`Delete the check-in from ${format(parseISO(record.date), 'MMMM d')}?`)) {
      return;
    }

    await deleteCheckIn(record.date);
    if (record.date === todayKey) replaceTodayCheckIn(undefined, undefined);
    setFlippedDate(undefined);
    await refresh();
  };

  const openJournalForRecord = (record: CheckInRecord) => {
    setFlippedDate(undefined);
    openJournalEditor(undefined, record.date);
  };

  return (
    <main className="shell checkin-history-page">
      <header className="checkin-history-header">
        <button
          className="checkin-back-button"
          onClick={() => navigate('/')}
          type="button"
          aria-label="Back to Life"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <p className="section-kicker">Your patterns</p>
          <h1>Check-in history</h1>
          <p className="subtle">Notice what changes without judging the day.</p>
        </div>
      </header>

      <section className="checkin-summary-grid" aria-label="Check-in summary">
        <article className="card checkin-summary-card">
          <Flame size={20} />
          <strong>{stats.streak}</strong>
          <span>day streak</span>
        </article>
        <article className="card checkin-summary-card">
          <Sparkles size={20} />
          <strong>{stats.weekly.length}</strong>
          <span>check-ins this week</span>
        </article>
        <article className="card checkin-summary-card checkin-summary-insight">
          <span className="checkin-summary-emoji">🌿</span>
          <strong>{stats.mood.title}</strong>
          <span>{stats.mood.detail}</span>
        </article>
        <article className="card checkin-summary-card checkin-summary-insight">
          <span className="checkin-summary-emoji">✨</span>
          <strong>{stats.energy.title}</strong>
          <span>{stats.energy.detail}</span>
        </article>
      </section>

      <section className="card checkin-trend-card" aria-labelledby="checkin-trend-title">
        <div className="checkin-trend-heading">
          <div>
            <p className="section-kicker">A gentle trend</p>
            <h2 id="checkin-trend-title">Last seven days</h2>
          </div>
          <span>{stats.monthly.length} check-ins this month</span>
        </div>
        <div className="checkin-trend-grid">
          {trendDays.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const record = recordsByDate.get(key);
            const mood = record?.mood ? moodOptions[record.mood - 1] : undefined;

            return (
              <div
                className="checkin-trend-day"
                key={key}
                aria-label={`${format(day, 'EEEE')}: ${record ? 'check-in saved' : 'no check-in'}`}
              >
                <span>{format(day, 'EEEEE')}</span>
                <div className="checkin-trend-mood">
                  {mood ? <img src={mood.asset} alt="" /> : <i />}
                </div>
                <div className="checkin-energy-track">
                  <b style={{ height: `${(record?.energy ?? 0) * 20}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="checkin-trend-legend">
          <span><i className="mood-dot" />Feeling</span>
          <span><i className="energy-dot" />Energy</span>
        </div>
      </section>

      <section className="checkin-history-list-section" aria-labelledby="checkin-list-title">
        <div className="checkin-list-heading">
          <div>
            <p className="section-kicker">Past days</p>
            <h2 id="checkin-list-title">Your answers</h2>
          </div>
          <span>{records.length} saved</span>
        </div>

        {loading ? (
          <div className="checkin-history-empty">Loading your check-ins…</div>
        ) : records.length === 0 ? (
          <button className="checkin-history-empty" onClick={() => navigate('/')} type="button">
            <strong>No check-ins yet</strong>
            <span>Return to Life and tell Still how today feels.</span>
          </button>
        ) : (
          <div className="checkin-history-list">
            {records.map((record) => {
              const flipped = flippedDate === record.date;
              const answer = answerForRecord(record);

              return (
                <article
                  className={`card checkin-history-answer-card ${flipped ? 'is-flipped' : ''}`}
                  key={record.date}
                >
                  <div className="checkin-history-answer-inner">
                    <button
                      className="checkin-history-answer-face checkin-history-answer-front"
                      onClick={() => setFlippedDate(record.date)}
                      type="button"
                      aria-controls={`checkin-actions-${record.date}`}
                      aria-expanded={flipped}
                      aria-label={`Show options for ${format(parseISO(record.date), 'MMMM d')}`}
                      tabIndex={flipped ? -1 : 0}
                    >
                      <time dateTime={record.date}>
                        <strong>{format(parseISO(record.date), 'd')}</strong>
                        <span>{format(parseISO(record.date), 'MMM')}</span>
                      </time>
                      <blockquote>{answer}</blockquote>
                      <small>Tap for options</small>
                    </button>

                    <div
                      className="checkin-history-answer-face checkin-history-answer-back"
                      id={`checkin-actions-${record.date}`}
                      aria-hidden={!flipped}
                    >
                      <div>
                        <time dateTime={record.date}>{format(parseISO(record.date), 'MMMM d, yyyy')}</time>
                        <p>What would help you hold this day?</p>
                      </div>
                      <div className="checkin-history-answer-actions">
                        <button
                          onClick={() => setEditing(record)}
                          type="button"
                          tabIndex={flipped ? 0 : -1}
                        >
                          <Pencil size={16} />
                          Change answer
                        </button>
                        <button
                          className="is-primary"
                          onClick={() => openJournalForRecord(record)}
                          type="button"
                          tabIndex={flipped ? 0 : -1}
                        >
                          <BookOpen size={16} />
                          Let it out
                        </button>
                        <button
                          className="is-danger"
                          onClick={() => void remove(record)}
                          type="button"
                          tabIndex={flipped ? 0 : -1}
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      </div>
                      <button
                        className="checkin-history-answer-close"
                        onClick={() => setFlippedDate(undefined)}
                        type="button"
                        tabIndex={flipped ? 0 : -1}
                      >
                        Back to answer
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {editing && (
        <CheckInEditor
          key={editing.date}
          record={editing}
          onCancel={() => setEditing(undefined)}
          onSave={(mood, energy) => void saveCorrection(mood, energy)}
        />
      )}
    </main>
  );
}
