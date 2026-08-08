import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Heart,
  Plus,
  Sparkles,
  StickyNote,
  X,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toAppPath } from '../../app/appLocation';
import { useAppStore, type EventRepeat } from '../../stores/useAppStore';
import './love.css';

type LoveComposer = 'plan' | 'moment' | 'note' | null;

const connectionLabels = ['Far away', 'A little distant', 'Steady', 'Close', 'Very close'];

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shortDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function timeLabel(value?: string) {
  if (!value) return '';
  return new Date(`2000-01-01T${value}:00`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function checkInValue(title?: string) {
  const match = title?.match(/^Connection check-in · ([1-5])$/);
  return match ? Number(match[1]) : undefined;
}

export function LovePage() {
  const navigate = useNavigate();
  const events = useAppStore((state) => state.events);
  const journalEntries = useAppStore((state) => state.journalEntries);
  const addEvent = useAppStore((state) => state.addEvent);
  const openEventEditor = useAppStore((state) => state.openEventEditor);
  const addJournalEntry = useAppStore((state) => state.addJournalEntry);
  const openJournalEditor = useAppStore((state) => state.openJournalEditor);

  const today = dateKey();
  const [composer, setComposer] = useState<LoveComposer>(null);
  const [plan, setPlan] = useState({ title: '', date: today, time: '19:00', repeat: 'none' as EventRepeat });
  const [moment, setMoment] = useState('');
  const [note, setNote] = useState('');

  const loveEvents = useMemo(() => events
    .filter((event) => event.areaId === 'love' || event.category === 'love')
    .sort((a, b) => `${a.startDate}${a.startTime ?? ''}`.localeCompare(`${b.startDate}${b.startTime ?? ''}`)), [events]);
  const upcomingPlans = loveEvents.filter((event) => event.endDate >= today);

  const loveEntries = useMemo(() => journalEntries
    .filter((entry) => entry.areaId === 'love')
    .sort((a, b) => b.entryDate.localeCompare(a.entryDate) || b.updatedAt - a.updatedAt), [journalEntries]);
  const notes = loveEntries.filter((entry) => entry.tags.includes('love-note'));
  const checkIns = loveEntries.filter((entry) => entry.tags.includes('love-checkin'));
  const moments = loveEntries.filter((entry) => !entry.tags.includes('love-note') && !entry.tags.includes('love-checkin'));
  const latestConnection = checkInValue(checkIns[0]?.title);

  const savePlan = (event: FormEvent) => {
    event.preventDefault();
    const title = plan.title.trim();
    if (!title) return;
    addEvent({ title, category: 'love', areaId: 'love', startDate: plan.date, endDate: plan.date, allDay: false, startTime: plan.time, endTime: plan.time, repeat: plan.repeat });
    setPlan({ title: '', date: today, time: '19:00', repeat: 'none' });
    setComposer(null);
  };

  const saveMoment = (event: FormEvent) => {
    event.preventDefault();
    const body = moment.trim();
    if (!body) return;
    addJournalEntry({ title: 'A moment', body, entryDate: today, tags: ['love', 'love-moment'], areaId: 'love' });
    setMoment('');
    setComposer(null);
  };

  const saveNote = (event: FormEvent) => {
    event.preventDefault();
    const body = note.trim();
    if (!body) return;
    addJournalEntry({ title: 'Love note', body, entryDate: today, tags: ['love', 'love-note'], areaId: 'love' });
    setNote('');
    setComposer(null);
  };

  const saveConnection = (value: number) => {
    addJournalEntry({ title: `Connection check-in · ${value}`, body: connectionLabels[value - 1], entryDate: today, tags: ['love', 'love-checkin'], areaId: 'love' });
  };

  return (
    <main className="shell love-page">
      <header className="love-header">
        <button className="love-back" onClick={() => navigate('/')} type="button" aria-label="Back home"><ArrowLeft size={19} /></button>
        <div><p className="section-kicker">Life area</p><h1>Love</h1></div>
        <img src={toAppPath('/assets/cozy/love-animal-friends.png')} alt="" aria-hidden="true" />
      </header>

      <section className="love-summary card" aria-label="Love summary">
        <div className="love-summary-main"><span className="love-summary-icon"><Heart size={22} /></span><div><small>Next together</small><strong>{upcomingPlans[0]?.title ?? 'Nothing planned'}</strong><span>{upcomingPlans[0] ? `${shortDate(upcomingPlans[0].startDate)}${upcomingPlans[0].startTime ? ` · ${timeLabel(upcomingPlans[0].startTime)}` : ''}` : 'Leave a little room for something good.'}</span></div></div>
        <div className="love-summary-grid"><div><strong>{upcomingPlans.length}</strong><span>plans</span></div><div><strong>{moments.length}</strong><span>moments</span></div><div><strong>{notes.length}</strong><span>notes</span></div></div>
      </section>

      <section className="love-section love-connection" aria-labelledby="love-connection-title">
        <div className="love-section-head"><div><h2 id="love-connection-title">Connection</h2><p>{latestConnection ? connectionLabels[latestConnection - 1] : 'How does it feel today?'}</p></div></div>
        <div className="love-pulse" aria-label="Connection check-in">{[1, 2, 3, 4, 5].map((value) => <button className={latestConnection === value ? 'is-selected' : ''} key={value} onClick={() => saveConnection(value)} type="button" aria-label={connectionLabels[value - 1]}><Heart size={18} fill={latestConnection === value ? 'currentColor' : 'none'} /></button>)}</div>
      </section>

      <section className="love-section" aria-labelledby="love-plans-title">
        <div className="love-section-head"><div><h2 id="love-plans-title">Plans</h2></div><button onClick={() => setComposer(composer === 'plan' ? null : 'plan')} type="button"><Plus size={16} /> Plan</button></div>
        {composer === 'plan' && <form className="love-inline-form" onSubmit={savePlan}><div className="love-form-top"><strong>Something to look forward to</strong><button type="button" onClick={() => setComposer(null)} aria-label="Close"><X size={17} /></button></div><input value={plan.title} onChange={(event) => setPlan({ ...plan, title: event.target.value })} placeholder="Dinner, anniversary, trip…" aria-label="Plan title" /><div className="love-form-grid"><input type="date" value={plan.date} onChange={(event) => setPlan({ ...plan, date: event.target.value })} aria-label="Plan date" /><input type="time" value={plan.time} onChange={(event) => setPlan({ ...plan, time: event.target.value })} aria-label="Plan time" /></div><select value={plan.repeat} onChange={(event) => setPlan({ ...plan, repeat: event.target.value as EventRepeat })} aria-label="Repeat"><option value="none">One time</option><option value="weekly">Every week</option><option value="monthly">Every month</option><option value="daily">Every day</option></select><button className="love-save" type="submit">Save plan</button></form>}
        <div className="love-list card">{upcomingPlans.length === 0 ? <div className="love-empty">No plans yet.</div> : upcomingPlans.slice(0, 4).map((event) => <button className="love-row" key={event.id} onClick={() => openEventEditor(event.id)} type="button"><CalendarDays size={17} /><div><strong>{event.title}</strong><small>{shortDate(event.startDate)}{event.startTime ? ` · ${timeLabel(event.startTime)}` : ''}{event.repeat !== 'none' ? ` · ${event.repeat}` : ''}</small></div><ChevronRight size={16} /></button>)}</div>
      </section>

      <section className="love-section" aria-labelledby="love-moments-title">
        <div className="love-section-head"><div><h2 id="love-moments-title">Moments</h2></div><button onClick={() => setComposer(composer === 'moment' ? null : 'moment')} type="button"><Plus size={16} /> Moment</button></div>
        {composer === 'moment' && <form className="love-inline-form" onSubmit={saveMoment}><div className="love-form-top"><strong>Keep a little moment</strong><button type="button" onClick={() => setComposer(null)} aria-label="Close"><X size={17} /></button></div><textarea value={moment} onChange={(event) => setMoment(event.target.value)} placeholder="Something you want to remember…" aria-label="Moment" /><button className="love-save" type="submit">Keep moment</button></form>}
        <div className="love-list card">{moments.length === 0 ? <div className="love-empty">No moments saved yet.</div> : moments.slice(0, 4).map((entry) => <button className="love-row" key={entry.id} onClick={() => openJournalEditor(entry.id)} type="button"><Sparkles size={17} /><div><strong>{entry.body}</strong><small>{shortDate(entry.entryDate)}</small></div><ChevronRight size={16} /></button>)}</div>
      </section>

      <section className="love-section" aria-labelledby="love-notes-title">
        <div className="love-section-head"><div><h2 id="love-notes-title">Notes</h2></div><button onClick={() => setComposer(composer === 'note' ? null : 'note')} type="button"><Plus size={16} /> Note</button></div>
        {composer === 'note' && <form className="love-inline-form" onSubmit={saveNote}><div className="love-form-top"><strong>Worth remembering</strong><button type="button" onClick={() => setComposer(null)} aria-label="Close"><X size={17} /></button></div><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Gift idea, favorite thing, a detail…" aria-label="Love note" /><button className="love-save" type="submit">Save note</button></form>}
        <div className="love-list card">{notes.length === 0 ? <div className="love-empty">No notes yet.</div> : notes.slice(0, 4).map((entry) => <button className="love-row" key={entry.id} onClick={() => openJournalEditor(entry.id)} type="button"><StickyNote size={17} /><div><strong>{entry.body}</strong><small>{shortDate(entry.entryDate)}</small></div><ChevronRight size={16} /></button>)}</div>
      </section>
    </main>
  );
}
