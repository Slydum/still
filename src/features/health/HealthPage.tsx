import {
  eachDayOfInterval,
  format,
  parseISO,
  subDays,
} from 'date-fns';
import {
  Activity,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Check,
  CheckSquare,
  ChevronRight,
  Droplets,
  HeartPulse,
  Moon,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  StickyNote,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../../components/navigation/useBackNavigation';
import { listCheckIns, saveCheckIn, type CheckInRecord } from '../../data/stillDb';
import {
  createHealthRecordId,
  DEFAULT_HEALTH_SIGNAL_PREFERENCES,
  EMPTY_HEALTH_ROUTINES,
  HEALTH_NOTE_LABELS,
  healthNoteKind,
  healthNoteTags,
  normalizeOptionalHealthNumber,
  routineCadenceLabel,
  routineCompletedForDate,
  type HealthNoteKind,
  type HealthRoutineCadence,
  type HealthSettingsState,
} from '../../domain/health';
import { useAppStore, type JournalEntry } from '../../stores/useAppStore';
import { getLocalDateKey } from '../../theme/stillContext';
import { getCheckInEnergy, getCheckInMood } from '../check-ins/checkInScale';
import './health.css';

type StoreWithHealth = ReturnType<typeof useAppStore.getState> & Partial<HealthSettingsState>;
type RoutineDraft = { id?: string; title: string; cadence: HealthRoutineCadence; note: string };
type NoteDraft = { id?: string; kind: HealthNoteKind; date: string; body: string };
type SignalKey = 'sleep' | 'hydration' | 'movement';

function setHealthState(patch: Partial<HealthSettingsState>) {
  const setState = useAppStore.setState as unknown as (value: Partial<HealthSettingsState>) => void;
  setState(patch);
}

function average(records: CheckInRecord[], key: 'mood' | 'energy' | 'sleepHours' | 'hydrationCups' | 'movementMinutes') {
  const values = records
    .map((record) => record[key])
    .filter((value): value is number => value !== undefined && Number.isFinite(value));
  if (!values.length) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rounded(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function parseOptionalNumber(value: string, maximum: number) {
  const normalized = value.trim();
  if (!normalized) return undefined;
  return normalizeOptionalHealthNumber(Number(normalized), maximum);
}

function noteSort(left: JournalEntry, right: JournalEntry) {
  return right.entryDate.localeCompare(left.entryDate) || right.updatedAt - left.updatedAt;
}

export function HealthPage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/');
  const today = getLocalDateKey();
  const storedMood = useAppStore((state) => state.mood);
  const storedEnergy = useAppStore((state) => state.energy);
  const checkInDate = useAppStore((state) => state.checkInDate);
  const openQuickAdd = useAppStore((state) => state.openQuickAdd);
  const journalEntries = useAppStore((state) => state.journalEntries);
  const addJournalEntry = useAppStore((state) => state.addJournalEntry);
  const updateJournalEntry = useAppStore((state) => state.updateJournalEntry);
  const deleteJournalEntry = useAppStore((state) => state.deleteJournalEntry);
  const tasks = useAppStore((state) => state.tasks);
  const events = useAppStore((state) => state.events);
  const openTaskEditor = useAppStore((state) => state.openTaskEditor);
  const openEventEditor = useAppStore((state) => state.openEventEditor);
  const openJournalEditor = useAppStore((state) => state.openJournalEditor);
  const healthRoutines = useAppStore((state) => (state as StoreWithHealth).healthRoutines ?? EMPTY_HEALTH_ROUTINES);
  const signalPreferences = useAppStore((state) => (state as StoreWithHealth).healthSignalPreferences ?? DEFAULT_HEALTH_SIGNAL_PREFERENCES);

  const [records, setRecords] = useState<CheckInRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [routineDraft, setRoutineDraft] = useState<RoutineDraft>();
  const [noteDraft, setNoteDraft] = useState<NoteDraft>();
  const [sleepHours, setSleepHours] = useState('');
  const [hydrationCups, setHydrationCups] = useState('');
  const [movementMinutes, setMovementMinutes] = useState('');
  const [signalStatus, setSignalStatus] = useState('');

  const refresh = useCallback(async () => {
    setRecords(await listCheckIns());
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const recordsByDate = useMemo(() => new Map(records.map((record) => [record.date, record])), [records]);
  const todayRecord = recordsByDate.get(today);
  const todayMood = checkInDate === today ? storedMood : todayRecord?.mood;
  const todayEnergy = checkInDate === today ? storedEnergy : todayRecord?.energy;
  const hasTodayCheckIn = Boolean(todayMood && todayEnergy);

  useEffect(() => {
    if (checkInDate !== today || !storedMood || !storedEnergy) return;
    if (todayRecord?.mood === storedMood && todayRecord?.energy === storedEnergy) return;

    let disposed = false;
    void saveCheckIn({
      ...(todayRecord ?? {}),
      date: today,
      mood: storedMood,
      energy: storedEnergy,
      updatedAt: Date.now(),
    }).then(() => {
      if (!disposed) void refresh();
    }).catch(() => undefined);

    return () => { disposed = true; };
  }, [checkInDate, refresh, storedEnergy, storedMood, today, todayRecord]);

  useEffect(() => {
    setSleepHours(todayRecord?.sleepHours === undefined ? '' : String(todayRecord.sleepHours));
    setHydrationCups(todayRecord?.hydrationCups === undefined ? '' : String(todayRecord.hydrationCups));
    setMovementMinutes(todayRecord?.movementMinutes === undefined ? '' : String(todayRecord.movementMinutes));
  }, [todayRecord]);

  useEffect(() => {
    if (!signalStatus) return undefined;
    const timeout = window.setTimeout(() => setSignalStatus(''), 2400);
    return () => window.clearTimeout(timeout);
  }, [signalStatus]);

  const recentDays = useMemo(() => eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() }), []);
  const recentRecords = useMemo(() => {
    const keys = new Set(recentDays.map((day) => format(day, 'yyyy-MM-dd')));
    return records.filter((record) => keys.has(record.date));
  }, [recentDays, records]);
  const averageMood = average(recentRecords, 'mood');
  const averageEnergy = average(recentRecords, 'energy');
  const recentMood = getCheckInMood(averageMood === undefined ? undefined : Math.round(averageMood));
  const recentEnergy = getCheckInEnergy(averageEnergy === undefined ? undefined : Math.round(averageEnergy));
  const averageSleep = average(recentRecords, 'sleepHours');
  const averageHydration = average(recentRecords, 'hydrationCups');
  const averageMovement = average(recentRecords, 'movementMinutes');

  const healthNotes = useMemo(
    () => journalEntries
      .filter((entry) => entry.areaId === 'health' && entry.tags.includes('health-note'))
      .sort(noteSort),
    [journalEntries],
  );
  const connectedReflections = useMemo(
    () => journalEntries
      .filter((entry) => entry.areaId === 'health' && !entry.tags.includes('health-note'))
      .sort(noteSort),
    [journalEntries],
  );
  const healthTasks = useMemo(
    () => tasks.filter((task) => task.areaId === 'health').sort((a, b) => Number(a.completed) - Number(b.completed) || b.updatedAt - a.updatedAt),
    [tasks],
  );
  const healthEvents = useMemo(
    () => events.filter((event) => event.areaId === 'health' || event.category === 'health').sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [events],
  );

  const beginRoutine = (id?: string) => {
    const existing = id ? healthRoutines.find((routine) => routine.id === id) : undefined;
    setRoutineDraft(existing
      ? { id: existing.id, title: existing.title, cadence: existing.cadence, note: existing.note ?? '' }
      : { title: '', cadence: 'daily', note: '' });
  };

  const saveRoutine = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!routineDraft?.title.trim()) return;
    const now = Date.now();
    const title = routineDraft.title.trim();
    const note = routineDraft.note.trim() || undefined;
    const next = routineDraft.id
      ? healthRoutines.map((routine) => routine.id === routineDraft.id
        ? { ...routine, title, cadence: routineDraft.cadence, note, updatedAt: now }
        : routine)
      : [...healthRoutines, {
          id: createHealthRecordId('health-routine'),
          title,
          cadence: routineDraft.cadence,
          note,
          createdAt: now,
          updatedAt: now,
        }];
    setHealthState({ healthRoutines: next });
    setRoutineDraft(undefined);
  };

  const toggleRoutine = (id: string) => {
    setHealthState({
      healthRoutines: healthRoutines.map((routine) => {
        if (routine.id !== id) return routine;
        const completed = routineCompletedForDate(routine, today);
        return { ...routine, lastCompletedDate: completed ? undefined : today, updatedAt: Date.now() };
      }),
    });
  };

  const removeRoutine = (id: string) => {
    const selected = healthRoutines.find((routine) => routine.id === id);
    if (!selected || !window.confirm(`Remove “${selected.title}” from your routines?`)) return;
    setHealthState({ healthRoutines: healthRoutines.filter((routine) => routine.id !== id) });
    if (routineDraft?.id === id) setRoutineDraft(undefined);
  };

  const beginNote = (id?: string) => {
    const existing = id ? healthNotes.find((entry) => entry.id === id) : undefined;
    setNoteDraft(existing
      ? { id: existing.id, kind: healthNoteKind(existing.tags), date: existing.entryDate, body: existing.body }
      : { kind: 'note', date: today, body: '' });
  };

  const saveNote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!noteDraft?.body.trim()) return;
    const input = {
      title: HEALTH_NOTE_LABELS[noteDraft.kind],
      body: noteDraft.body.trim(),
      entryDate: noteDraft.date,
      mood: undefined,
      tags: healthNoteTags(noteDraft.kind),
      areaId: 'health' as const,
    };
    if (noteDraft.id) updateJournalEntry(noteDraft.id, input);
    else addJournalEntry(input);
    setNoteDraft(undefined);
  };

  const removeNote = (entry: JournalEntry) => {
    if (!window.confirm('Delete this Health note?')) return;
    deleteJournalEntry(entry.id);
    if (noteDraft?.id === entry.id) setNoteDraft(undefined);
  };

  const saveSignals = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!todayMood || !todayEnergy) {
      openQuickAdd('check-in');
      return;
    }

    const next: CheckInRecord = {
      ...(todayRecord ?? {}),
      date: today,
      mood: todayMood,
      energy: todayEnergy,
      updatedAt: Date.now(),
    };
    if (signalPreferences.sleep) next.sleepHours = parseOptionalNumber(sleepHours, 24);
    if (signalPreferences.hydration) next.hydrationCups = parseOptionalNumber(hydrationCups, 40);
    if (signalPreferences.movement) next.movementMinutes = parseOptionalNumber(movementMinutes, 1440);

    await saveCheckIn(next);
    await refresh();
    setSignalStatus('Saved for today.');
  };

  const updateSignalPreference = (key: SignalKey, enabled: boolean) => {
    setHealthState({
      healthSignalPreferences: { ...signalPreferences, [key]: enabled },
    });
  };

  const enabledSignals = signalPreferences.sleep || signalPreferences.hydration || signalPreferences.movement;
  const connectedCount = healthTasks.length + healthEvents.length + connectedReflections.length;

  return (
    <main className="shell health-page">
      <header className="still-page-header health-header">
        <button className="btn-icon" onClick={goBack} type="button" aria-label="Go back"><ArrowLeft size={20} /></button>
        <div className="still-page-heading">
          <div className="still-page-heading-copy">
            <p className="section-kicker">Health area · overview</p>
            <h1>How have you been lately?</h1>
            <p className="subtle">Notice patterns, keep what matters, and leave the scoring out.</p>
          </div>
          <button className="btn btn-secondary btn-compact still-action-button" onClick={() => beginNote()} type="button"><Plus size={16} /> Add note</button>
        </div>
      </header>

      <section className="still-summary-grid health-summary-grid" aria-label="Recent Health summary">
        <article className="card still-summary-tile health-summary-tile">
          <HeartPulse size={19} />
          <strong>{recentMood?.label ?? '—'}</strong>
          <span>mood lately</span>
        </article>
        <article className="card still-summary-tile health-summary-tile">
          <Activity size={19} />
          <strong>{recentEnergy?.label ?? '—'}</strong>
          <span>energy lately</span>
        </article>
        {signalPreferences.sleep && <article className="card still-summary-tile health-summary-tile">
          <Moon size={19} />
          <strong>{averageSleep === undefined ? '—' : `${rounded(averageSleep)}h`}</strong>
          <span>sleep avg · 7 days</span>
        </article>}
        {signalPreferences.hydration && <article className="card still-summary-tile health-summary-tile">
          <Droplets size={19} />
          <strong>{averageHydration === undefined ? '—' : rounded(averageHydration, 0)}</strong>
          <span>cups avg · 7 days</span>
        </article>}
        {signalPreferences.movement && <article className="card still-summary-tile health-summary-tile">
          <RefreshCw size={19} />
          <strong>{averageMovement === undefined ? '—' : `${rounded(averageMovement, 0)}m`}</strong>
          <span>movement avg · 7 days</span>
        </article>}
      </section>

      <section className="health-section" aria-labelledby="health-today-title">
        <div className="health-section-head">
          <div><p className="section-kicker">Today</p><h2 id="health-today-title">A small check-in</h2></div>
          <button className="health-text-action" onClick={() => openQuickAdd('check-in')} type="button">{hasTodayCheckIn ? 'Update check-in' : 'Check in'}</button>
        </div>
        <article className="card health-today-card">
          <div className="health-today-checkin">
            <span className="health-checkin-mark" aria-hidden="true"><HeartPulse size={20} /></span>
            <div>
              <small>Mood & energy</small>
              <strong>{hasTodayCheckIn ? `${getCheckInMood(todayMood)?.label} · ${getCheckInEnergy(todayEnergy)?.label}` : 'Nothing saved yet'}</strong>
              <span>{hasTodayCheckIn ? 'Today is recorded without turning it into a score.' : 'A quick mood and energy check-in gives today some context.'}</span>
            </div>
          </div>

          {enabledSignals && <form className="health-signal-form" onSubmit={saveSignals}>
            <div className="health-signal-fields">
              {signalPreferences.sleep && <label><span>Sleep / rest</span><div><input inputMode="decimal" max="24" min="0" onChange={(event) => setSleepHours(event.target.value)} placeholder="7.5" step="0.25" type="number" value={sleepHours} /><small>hours</small></div></label>}
              {signalPreferences.hydration && <label><span>Hydration</span><div><input inputMode="numeric" max="40" min="0" onChange={(event) => setHydrationCups(event.target.value)} placeholder="6" step="1" type="number" value={hydrationCups} /><small>cups</small></div></label>}
              {signalPreferences.movement && <label><span>Movement</span><div><input inputMode="numeric" max="1440" min="0" onChange={(event) => setMovementMinutes(event.target.value)} placeholder="20" step="1" type="number" value={movementMinutes} /><small>minutes</small></div></label>}
            </div>
            <div className="health-signal-actions">
              <span role="status" aria-live="polite">{signalStatus || (hasTodayCheckIn ? 'Only track what is useful to you.' : 'Check in first to attach today’s signals.')}</span>
              <button className="health-soft-button" type="submit">{hasTodayCheckIn ? 'Save today' : 'Check in first'}</button>
            </div>
          </form>}
        </article>
      </section>

      <section className="health-section" aria-labelledby="health-pattern-title">
        <div className="health-section-head">
          <div><p className="section-kicker">Mood & energy</p><h2 id="health-pattern-title">Last seven days</h2><p>Look for a rhythm, not a grade.</p></div>
          <button className="health-text-action" onClick={() => navigate('/check-ins')} type="button">Full history <ChevronRight size={15} /></button>
        </div>
        <div className="card health-week-strip" aria-label="Seven-day mood and energy history">
          {recentDays.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const record = recordsByDate.get(key);
            const moodOption = getCheckInMood(record?.mood);
            const energyOption = getCheckInEnergy(record?.energy);
            return <div className="health-week-day" key={key} aria-label={`${format(day, 'EEEE')}: ${moodOption?.label ?? 'no mood'}, ${energyOption?.label ?? 'no energy'}`}>
              <span>{format(day, 'EEEEE')}</span>
              <strong aria-hidden="true">{moodOption?.emoji ?? '·'}</strong>
              <small>{energyOption?.label ?? '—'}</small>
            </div>;
          })}
        </div>
      </section>

      <section className="health-section" aria-labelledby="health-routines-title">
        <div className="health-section-head">
          <div><p className="section-kicker">Routines</p><h2 id="health-routines-title">Things that help</h2><p>Simple reminders, without streak pressure.</p></div>
          <button className="health-text-action" onClick={() => beginRoutine()} type="button"><Plus size={15} /> Add</button>
        </div>

        {routineDraft && <form className="health-inline-form" onSubmit={saveRoutine}>
          <div className="health-inline-form-head"><strong>{routineDraft.id ? 'Edit routine' : 'New routine'}</strong><button onClick={() => setRoutineDraft(undefined)} type="button">Cancel</button></div>
          <div className="health-form-grid">
            <label><span>Routine</span><input autoFocus maxLength={80} onChange={(event) => setRoutineDraft({ ...routineDraft, title: event.target.value })} placeholder="Take medication" required type="text" value={routineDraft.title} /></label>
            <label><span>Rhythm</span><select onChange={(event) => setRoutineDraft({ ...routineDraft, cadence: event.target.value as HealthRoutineCadence })} value={routineDraft.cadence}><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label>
          </div>
          <label><span>Note <small>(optional)</small></span><input maxLength={160} onChange={(event) => setRoutineDraft({ ...routineDraft, note: event.target.value })} placeholder="Anything useful to remember" type="text" value={routineDraft.note} /></label>
          <button className="health-soft-button" disabled={!routineDraft.title.trim()} type="submit">Save routine</button>
        </form>}

        {healthRoutines.length === 0 ? <button className="card health-empty" onClick={() => beginRoutine()} type="button"><RefreshCw size={20} /><span><strong>No routines here yet</strong><small>Add one small thing that helps you feel cared for.</small></span></button> : <div className="card health-routine-list">
          {healthRoutines.map((routine) => {
            const completed = routineCompletedForDate(routine, today);
            return <article className={`health-routine-row ${completed ? 'is-complete' : ''}`} key={routine.id}>
              <button className="health-routine-check" onClick={() => toggleRoutine(routine.id)} type="button" aria-label={`${completed ? 'Mark incomplete' : 'Mark complete'}: ${routine.title}`} aria-pressed={completed}>{completed ? <Check size={17} /> : <span />}</button>
              <div><strong>{routine.title}</strong><span>{routineCadenceLabel(routine.cadence)}{routine.note ? ` · ${routine.note}` : ''}</span></div>
              <div className="health-row-actions"><button onClick={() => beginRoutine(routine.id)} type="button" aria-label={`Edit ${routine.title}`}><Pencil size={15} /></button><button onClick={() => removeRoutine(routine.id)} type="button" aria-label={`Remove ${routine.title}`}><Trash2 size={15} /></button></div>
            </article>;
          })}
        </div>}
      </section>

      <section className="health-section" aria-labelledby="health-notes-title">
        <div className="health-section-head">
          <div><p className="section-kicker">Health notes</p><h2 id="health-notes-title">Worth remembering</h2><p>Symptoms, appointments, medication notes, or questions for later.</p></div>
          <button className="health-text-action" onClick={() => beginNote()} type="button"><Plus size={15} /> Add</button>
        </div>

        {noteDraft && <form className="health-inline-form" onSubmit={saveNote}>
          <div className="health-inline-form-head"><strong>{noteDraft.id ? 'Edit Health note' : 'New Health note'}</strong><button onClick={() => setNoteDraft(undefined)} type="button">Cancel</button></div>
          <div className="health-form-grid">
            <label><span>Type</span><select onChange={(event) => setNoteDraft({ ...noteDraft, kind: event.target.value as HealthNoteKind })} value={noteDraft.kind}><option value="note">Note</option><option value="symptom">Symptom</option><option value="appointment">Appointment</option><option value="medication">Medication</option><option value="question">Question for a doctor</option></select></label>
            <label><span>Date</span><input onChange={(event) => setNoteDraft({ ...noteDraft, date: event.target.value })} required type="date" value={noteDraft.date} /></label>
          </div>
          <label><span>What do you want to remember?</span><textarea autoFocus maxLength={2000} onChange={(event) => setNoteDraft({ ...noteDraft, body: event.target.value })} placeholder="Keep it factual and useful for future you." required rows={4} value={noteDraft.body} /></label>
          <button className="health-soft-button" disabled={!noteDraft.body.trim()} type="submit">Save note</button>
        </form>}

        {healthNotes.length === 0 ? <button className="card health-empty" onClick={() => beginNote()} type="button"><StickyNote size={20} /><span><strong>No Health notes yet</strong><small>Keep the first one short—just what future you may need.</small></span></button> : <div className="card health-note-list">
          {healthNotes.map((entry) => <article className="health-note-row" key={entry.id}>
            <span className="health-note-icon" aria-hidden="true"><StickyNote size={17} /></span>
            <div><span>{HEALTH_NOTE_LABELS[healthNoteKind(entry.tags)]} · {format(parseISO(entry.entryDate), 'MMM d')}</span><strong>{entry.body}</strong></div>
            <div className="health-row-actions"><button onClick={() => beginNote(entry.id)} type="button" aria-label="Edit Health note"><Pencil size={15} /></button><button onClick={() => removeNote(entry)} type="button" aria-label="Delete Health note"><Trash2 size={15} /></button></div>
          </article>)}
        </div>}
      </section>

      <section className="health-section health-last-section" aria-labelledby="health-settings-title">
        <details className="card health-details">
          <summary><span><Settings2 size={18} /><span><strong id="health-settings-title">History & settings</strong><small>Track only what helps, and keep older connected records nearby.</small></span></span><ChevronRight size={17} /></summary>
          <div className="health-details-content">
            <section className="health-settings-group" aria-labelledby="health-trackers-title">
              <div><strong id="health-trackers-title">Daily signals</strong><span>These are optional observations, not health targets.</span></div>
              <label><span><Moon size={16} /> Sleep / rest</span><input checked={signalPreferences.sleep} onChange={(event) => updateSignalPreference('sleep', event.target.checked)} type="checkbox" /></label>
              <label><span><Droplets size={16} /> Hydration</span><input checked={signalPreferences.hydration} onChange={(event) => updateSignalPreference('hydration', event.target.checked)} type="checkbox" /></label>
              <label><span><Activity size={16} /> Movement</span><input checked={signalPreferences.movement} onChange={(event) => updateSignalPreference('movement', event.target.checked)} type="checkbox" /></label>
            </section>

            <button className="health-history-link" onClick={() => navigate('/check-ins')} type="button"><HeartPulse size={17} /><span><strong>Check-in history</strong><small>{loading ? 'Loading…' : `${records.filter((record) => record.mood || record.energy).length} saved mood/energy check-ins`}</small></span><ChevronRight size={16} /></button>

            {connectedCount > 0 && <section className="health-connected" aria-labelledby="health-connected-title">
              <div><strong id="health-connected-title">Connected records</strong><span>Tasks, events, and reflections already linked to Health stay accessible here.</span></div>
              {healthTasks.slice(0, 3).map((task) => <button key={task.id} onClick={() => openTaskEditor(task.id)} type="button"><CheckSquare size={16} /><span><strong>{task.title}</strong><small>{task.completed ? 'Completed task' : 'Health task'}</small></span><ChevronRight size={15} /></button>)}
              {healthEvents.slice(0, 3).map((event) => <button key={event.id} onClick={() => openEventEditor(event.id)} type="button"><CalendarDays size={16} /><span><strong>{event.title}</strong><small>{format(parseISO(event.startDate), 'MMM d, yyyy')}</small></span><ChevronRight size={15} /></button>)}
              {connectedReflections.slice(0, 3).map((entry) => <button key={entry.id} onClick={() => openJournalEditor(entry.id)} type="button"><BookOpen size={16} /><span><strong>{entry.title || 'Health reflection'}</strong><small>{format(parseISO(entry.entryDate), 'MMM d, yyyy')}</small></span><ChevronRight size={15} /></button>)}
            </section>}
          </div>
        </details>
      </section>
    </main>
  );
}
