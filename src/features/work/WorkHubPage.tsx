import {
  ArrowLeft,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  Clock3,
  Eye,
  EyeOff,
  LogIn,
  LogOut,
  Plus,
  Repeat2,
  StickyNote,
  Wrench,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { effectiveHourlyRate, shiftEarnings, workedHours, type WorkNote, type WorkProfile } from '../../domain/work';
import { getEventOccurrences, getOccurrencesForDay } from '../calendar/eventUtils';
import { useAppStore, type EventRepeat } from '../../stores/useAppStore';
import './work-hub.css';

type QueueStatus = 'todo' | 'progress' | 'done';
type IncidentStatus = 'new' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
type WorkIncident = {
  id: string;
  reference: string;
  title: string;
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  system?: string;
  status: IncidentStatus;
  note?: string;
  createdAt: number;
  updatedAt: number;
};
type ExtendedWorkProfile = WorkProfile & {
  incidents?: WorkIncident[];
  workTaskStates?: Record<string, QueueStatus>;
};
type QueueItem = {
  id: string;
  kind: 'task' | 'meeting' | 'incident' | 'change' | 'reminder';
  title: string;
  meta: string;
  status: QueueStatus;
  sort: string;
};

type MeetingDraft = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  repeat: EventRepeat;
  note: string;
};

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function shortDate(value?: string) {
  return value ? new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
}

function timeLabel(value?: string) {
  if (!value) return '';
  return new Date(`2000-01-01T${value}:00`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

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

export function WorkHubPage() {
  const navigate = useNavigate();
  const profile = useAppStore((state) => state.workProfile) as ExtendedWorkProfile;
  const shifts = useAppStore((state) => state.workShifts);
  const privacyBlur = useAppStore((state) => state.workPrivacyBlur);
  const tasks = useAppStore((state) => state.tasks);
  const events = useAppStore((state) => state.events);
  const updateProfile = useAppStore((state) => state.updateWorkProfile);
  const startWorkShift = useAppStore((state) => state.startWorkShift);
  const endWorkShift = useAppStore((state) => state.endWorkShift);
  const setWorkPrivacyBlur = useAppStore((state) => state.setWorkPrivacyBlur);
  const addTask = useAppStore((state) => state.addTask);
  const toggleTask = useAppStore((state) => state.toggleTask);
  const addEvent = useAppStore((state) => state.addEvent);
  const openEventEditor = useAppStore((state) => state.openEventEditor);

  const [tab, setTab] = useState<QueueStatus>('todo');
  const [taskTitle, setTaskTitle] = useState('');
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incident, setIncident] = useState({ reference: '', title: '', priority: 'P3' as WorkIncident['priority'], system: '' });
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteReminder, setNoteReminder] = useState('');
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const nowDate = new Date(now);
  const today = dateKey(nowDate);
  const [meeting, setMeeting] = useState<MeetingDraft>({ title: '', date: today, startTime: '09:00', endTime: '09:30', repeat: 'none', note: '' });

  const activeShift = shifts.find((shift) => !shift.endedAt);
  const incidents = profile.incidents ?? [];
  const taskStates = profile.workTaskStates ?? {};
  const notes = profile.notes ?? [];
  const changes = profile.changes ?? [];

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

  const workTasks = useMemo(() => tasks.filter((task) => task.areaId === 'work'), [tasks]);
  const workMeetingSeries = useMemo(() => events.filter((event) => event.areaId === 'work' || event.category === 'work').sort((a, b) => `${a.startDate}${a.startTime ?? ''}`.localeCompare(`${b.startDate}${b.startTime ?? ''}`)), [events]);
  const todayMeetings = useMemo(() => getOccurrencesForDay(getEventOccurrences(workMeetingSeries, today, today), today), [today, workMeetingSeries]);
  const openIncidents = incidents.filter((item) => item.status !== 'closed' && item.status !== 'resolved');
  const openChanges = changes.filter((item) => item.status !== 'completed' && item.status !== 'cancelled');
  const dueNotes = notes.filter((note) => note.reminderDate && note.reminderDate <= today);

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayShifts = shifts.filter((shift) => shift.startedAt >= todayStart.getTime());
  const earnedToday = todayShifts.reduce((total, shift) => total + shiftEarnings(shift, profile, now), 0);
  const liveEarnings = activeShift ? shiftEarnings(activeShift, profile, now) : 0;
  const livePerSecond = activeShift ? Math.max(0, shiftEarnings(activeShift, profile, now + 1000) - liveEarnings) : Math.max(0, effectiveHourlyRate(profile) / 3600);
  const liveElapsed = activeShift ? workedHours(activeShift, now) : 0;

  const saveProfile = (patch: Partial<ExtendedWorkProfile>) => updateProfile({ ...profile, ...patch } as WorkProfile);

  const queue = useMemo<QueueItem[]>(() => {
    const items: QueueItem[] = [];
    const nowTime = new Date(now).toTimeString().slice(0, 5);
    workTasks.forEach((task) => items.push({ id: `task:${task.id}`, kind: 'task', title: task.title, meta: task.dueDate ? shortDate(task.dueDate) : 'Task', status: task.completed ? 'done' : (taskStates[task.id] ?? 'todo'), sort: task.dueDate ?? '9999' }));
    todayMeetings.forEach((event) => {
      const status: QueueStatus = event.endTime && event.endTime < nowTime ? 'done' : 'todo';
      items.push({ id: `meeting:${event.id}`, kind: 'meeting', title: event.title, meta: event.allDay ? 'All day · Meeting' : `${timeLabel(event.startTime)} · Meeting`, status, sort: event.startTime ?? '00:00' });
    });
    incidents.forEach((item) => items.push({ id: `incident:${item.id}`, kind: 'incident', title: `${item.reference ? `${item.reference} · ` : ''}${item.title}`, meta: `${item.priority}${item.system ? ` · ${item.system}` : ''} · Incident`, status: item.status === 'resolved' || item.status === 'closed' ? 'done' : item.status === 'in_progress' || item.status === 'waiting' ? 'progress' : 'todo', sort: String(item.createdAt) }));
    changes.forEach((change) => items.push({ id: `change:${change.id}`, kind: 'change', title: `${change.reference ? `${change.reference} · ` : ''}${change.title}`, meta: `${change.plannedDate ? `${shortDate(change.plannedDate)} · ` : ''}Change`, status: change.status === 'completed' || change.status === 'cancelled' ? 'done' : change.status === 'in_progress' || change.status === 'testing' ? 'progress' : 'todo', sort: change.plannedDate ?? '9999' }));
    dueNotes.forEach((note) => items.push({ id: `reminder:${note.id}`, kind: 'reminder', title: note.text, meta: `Note reminder · ${shortDate(note.reminderDate)}`, status: 'todo', sort: note.reminderDate ?? today }));
    return items.sort((a, b) => a.sort.localeCompare(b.sort));
  }, [changes, dueNotes, incidents, now, taskStates, today, todayMeetings, workTasks]);

  const visible = queue.filter((item) => item.status === tab);
  const counts = { todo: queue.filter((item) => item.status === 'todo').length, progress: queue.filter((item) => item.status === 'progress').length, done: queue.filter((item) => item.status === 'done').length };

  const handleClockIn = () => {
    startWorkShift();
  };

  const addWorkTask = (event: FormEvent) => { event.preventDefault(); const title = taskTitle.trim(); if (!title) return; addTask({ title, priority: 'medium', repeat: 'none', areaId: 'work', dueDate: today }); setTaskTitle(''); };
  const advanceTask = (taskId: string) => { const current = taskStates[taskId] ?? 'todo'; if (current === 'todo') saveProfile({ workTaskStates: { ...taskStates, [taskId]: 'progress' } }); else if (current === 'progress') toggleTask(taskId); };
  const saveIncident = (event: FormEvent) => { event.preventDefault(); if (!incident.title.trim()) return; const timestamp = Date.now(); saveProfile({ incidents: [{ id: createId('incident'), reference: incident.reference.trim(), title: incident.title.trim(), priority: incident.priority, system: incident.system.trim() || undefined, status: 'new', createdAt: timestamp, updatedAt: timestamp }, ...incidents] }); setIncident({ reference: '', title: '', priority: 'P3', system: '' }); setIncidentOpen(false); };
  const advanceIncident = (item: WorkIncident) => { const status: IncidentStatus = item.status === 'new' ? 'in_progress' : item.status === 'in_progress' || item.status === 'waiting' ? 'resolved' : item.status; saveProfile({ incidents: incidents.map((entry) => entry.id === item.id ? { ...entry, status, updatedAt: Date.now() } : entry) }); };
  const saveNote = (event: FormEvent) => { event.preventDefault(); if (!noteText.trim()) return; const note: WorkNote = { id: createId('work-note'), text: noteText.trim(), kind: 'note', createdAt: Date.now(), reminderDate: noteReminder || undefined }; saveProfile({ notes: [note, ...notes] }); setNoteText(''); setNoteReminder(''); setNoteOpen(false); };
  const saveMeeting = (event: FormEvent) => { event.preventDefault(); if (!meeting.title.trim()) return; addEvent({ title: meeting.title.trim(), note: meeting.note.trim() || undefined, category: 'work', areaId: 'work', startDate: meeting.date, endDate: meeting.date, allDay: false, startTime: meeting.startTime, endTime: meeting.endTime, repeat: meeting.repeat }); setMeeting({ title: '', date: today, startTime: '09:00', endTime: '09:30', repeat: 'none', note: '' }); setMeetingOpen(false); };

  const icon = (kind: QueueItem['kind']) => kind === 'meeting' ? <CalendarDays size={15} /> : kind === 'incident' ? <CircleAlert size={15} /> : kind === 'change' ? <Wrench size={15} /> : kind === 'reminder' ? <Bell size={15} /> : <Clock3 size={15} />;

  return <main className="shell work-hub-page">
    <header className="work-hub-header"><button className="work-hub-back" onClick={() => navigate('/')} type="button" aria-label="Back home"><ArrowLeft size={18} /></button><div><p className="work-hub-kicker">Life area</p><h1>Work</h1><p>{profile.jobTitle || profile.employer ? [profile.jobTitle, profile.employer].filter(Boolean).join(' · ') : 'Your workday at a glance.'}</p></div></header>

    <section className="work-live-card card" aria-label="Live work and pay tracker">
      <div className="work-live-top"><span className="work-live-icon"><BriefcaseBusiness size={21} /></span><div className="work-live-copy"><small>{activeShift ? 'Working now' : 'Ready when you are'}</small><strong className={privacyBlur && activeShift ? 'is-private' : ''}>{activeShift ? money(liveEarnings, profile.currency) : nowDate.toLocaleDateString(undefined, { weekday: 'long' })}</strong></div><button className="work-live-eye" onClick={() => setWorkPrivacyBlur(!privacyBlur)} type="button" aria-label={privacyBlur ? 'Show earnings' : 'Hide earnings'}>{privacyBlur ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>
      <div className="work-live-meta">{activeShift ? <><span>{durationLabel(liveElapsed)}</span><span className={privacyBlur ? 'is-private' : ''}>{money(livePerSecond, profile.currency, 4)} / sec</span><span className={privacyBlur ? 'is-private' : ''}>{money(earnedToday, profile.currency)} today</span></> : <><span>No break timer</span><span className={privacyBlur ? 'is-private' : ''}>{money(livePerSecond, profile.currency, 4)} / sec</span></>}</div>
      <div className="work-live-actions"><button disabled={Boolean(activeShift)} onClick={handleClockIn} type="button"><LogIn size={18} />Clock in</button><button disabled={!activeShift} onClick={endWorkShift} type="button"><LogOut size={18} />Clock out</button></div>
    </section>

    <section className="work-overview" aria-label="Work summary"><article><small>Meetings today</small><strong>{todayMeetings.length}</strong><span>{todayMeetings[0]?.startTime ? `Next ${timeLabel(todayMeetings[0].startTime)}` : 'Calendar clear'}</span></article><article><small>Incidents</small><strong>{openIncidents.length}</strong><span>{openIncidents[0]?.reference || 'Nothing open'}</span></article><article><small>Changes</small><strong>{openChanges.length}</strong><span>{openChanges[0]?.reference || 'Nothing open'}</span></article><article><small>Due notes</small><strong>{dueNotes.length}</strong><span>{dueNotes[0]?.reminderDate ? shortDate(dueNotes[0].reminderDate) : 'Nothing waiting'}</span></article></section>

    <section className="work-section work-meetings"><div className="work-section-head"><div><h2>Meetings</h2><p>Daily and weekly work rhythms.</p></div><button onClick={() => setMeetingOpen((value) => !value)} type="button"><Plus size={14} />Meeting</button></div>{meetingOpen && <form className="work-inline-form card" onSubmit={saveMeeting}><input required placeholder="Meeting name" value={meeting.title} onChange={(event) => setMeeting({ ...meeting, title: event.target.value })} /><div className="work-form-grid"><input aria-label="Meeting date" type="date" value={meeting.date} onChange={(event) => setMeeting({ ...meeting, date: event.target.value })} /><select aria-label="Meeting repeat" value={meeting.repeat} onChange={(event) => setMeeting({ ...meeting, repeat: event.target.value as EventRepeat })}><option value="none">One time</option><option value="daily">Every day</option><option value="weekly">Every week</option></select></div><div className="work-form-grid"><input aria-label="Meeting start time" type="time" value={meeting.startTime} onChange={(event) => setMeeting({ ...meeting, startTime: event.target.value })} /><input aria-label="Meeting end time" type="time" value={meeting.endTime} onChange={(event) => setMeeting({ ...meeting, endTime: event.target.value })} /></div><input placeholder="Optional note or link" value={meeting.note} onChange={(event) => setMeeting({ ...meeting, note: event.target.value })} /><button type="submit">Save meeting</button></form>}<div className="work-list-card">{workMeetingSeries.length === 0 ? <div className="work-empty">No work meetings set up yet.</div> : workMeetingSeries.slice(0, 5).map((event) => <button className="work-record" key={event.id} onClick={() => openEventEditor(event.id)} type="button"><CalendarDays size={16} /><div><strong>{event.title}</strong><small>{timeLabel(event.startTime)}{event.repeat !== 'none' ? ` · ${event.repeat === 'daily' ? 'Every day' : 'Every week'}` : ` · ${shortDate(event.startDate)}`}</small></div>{event.repeat !== 'none' ? <Repeat2 size={14} /> : <ChevronRight size={14} />}</button>)}</div></section>

    <section className="work-board card"><div className="work-board-top"><strong>My work</strong><span>{counts.todo + counts.progress} active</span></div><div className="work-tabs" role="tablist"><button className={tab === 'todo' ? 'active' : ''} onClick={() => setTab('todo')} type="button">To do · {counts.todo}</button><button className={tab === 'progress' ? 'active' : ''} onClick={() => setTab('progress')} type="button">In progress · {counts.progress}</button><button className={tab === 'done' ? 'active' : ''} onClick={() => setTab('done')} type="button">Done · {counts.done}</button></div><div className="work-queue-list">{visible.length === 0 ? <div className="work-empty">Nothing here right now.</div> : visible.map((item) => <button className="work-queue-row" key={item.id} onClick={() => { if (item.kind === 'task') advanceTask(item.id.slice(5)); if (item.kind === 'meeting') openEventEditor(item.id.slice(8)); if (item.kind === 'incident') { const found = incidents.find((entry) => entry.id === item.id.slice(9)); if (found) advanceIncident(found); } if (item.kind === 'change') navigate('/work/details'); }} type="button"><span>{icon(item.kind)}</span><div><strong>{item.title}</strong><small>{item.meta}</small></div><ChevronRight size={14} /></button>)}</div>{tab === 'todo' && <form className="work-task-add" onSubmit={addWorkTask}><input aria-label="New work task" placeholder="Add a task" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} /><button type="submit" aria-label="Add task"><Plus size={16} /></button></form>}</section>

    <section className="work-section"><div className="work-section-head"><div><h2>Incidents</h2></div><button onClick={() => setIncidentOpen((value) => !value)} type="button"><Plus size={14} />Incident</button></div>{incidentOpen && <form className="work-inline-form card" onSubmit={saveIncident}><div className="work-form-grid"><input placeholder="INC number" value={incident.reference} onChange={(event) => setIncident({ ...incident, reference: event.target.value })} /><select value={incident.priority} onChange={(event) => setIncident({ ...incident, priority: event.target.value as WorkIncident['priority'] })}><option>P1</option><option>P2</option><option>P3</option><option>P4</option></select></div><input required placeholder="What happened?" value={incident.title} onChange={(event) => setIncident({ ...incident, title: event.target.value })} /><input placeholder="System / SID" value={incident.system} onChange={(event) => setIncident({ ...incident, system: event.target.value })} /><button type="submit">Add incident</button></form>}<div className="work-list-card">{openIncidents.length === 0 ? <div className="work-empty">No open incidents.</div> : openIncidents.map((item) => <button className="work-record" key={item.id} onClick={() => advanceIncident(item)} type="button"><CircleAlert size={16} /><div><strong>{item.reference ? `${item.reference} · ` : ''}{item.title}</strong><small>{item.priority}{item.system ? ` · ${item.system}` : ''} · {item.status.replace('_', ' ')}</small></div><ChevronRight size={14} /></button>)}</div></section>

    <section className="work-section"><div className="work-section-head"><div><h2>Changes</h2></div><button onClick={() => navigate('/work/details')} type="button"><Plus size={14} />Change</button></div><div className="work-list-card">{openChanges.length === 0 ? <div className="work-empty">No open changes.</div> : openChanges.slice(0, 5).map((change) => <button className="work-record" key={change.id} onClick={() => navigate('/work/details')} type="button"><Wrench size={16} /><div><strong>{change.reference ? `${change.reference} · ` : ''}{change.title}</strong><small>{[change.system, change.plannedDate ? shortDate(change.plannedDate) : undefined, change.status.replace('_', ' ')].filter(Boolean).join(' · ')}</small></div><ChevronRight size={14} /></button>)}</div></section>

    <section className="work-section"><div className="work-section-head"><div><h2>Notes</h2></div><button onClick={() => setNoteOpen((value) => !value)} type="button"><Plus size={14} />Note</button></div>{noteOpen && <form className="work-inline-form card" onSubmit={saveNote}><textarea required placeholder="Jot something down…" value={noteText} onChange={(event) => setNoteText(event.target.value)} /><label className="work-reminder-field"><Bell size={14} /><span>Remind me</span><input type="date" value={noteReminder} onChange={(event) => setNoteReminder(event.target.value)} /></label><button type="submit">Save note</button></form>}<div className="work-list-card">{notes.length === 0 ? <div className="work-empty">No notes yet.</div> : notes.slice(0, 6).map((note) => <div className="work-record" key={note.id}><StickyNote size={16} /><div><strong className="work-note-text">{note.text}</strong><small>{note.reminderDate ? `Remind · ${shortDate(note.reminderDate)}` : 'Note'}</small></div>{note.reminderDate ? <Bell size={14} /> : null}</div>)}</div></section>

    <button className="work-details-link" onClick={() => navigate('/work/details')} type="button"><BriefcaseBusiness size={18} /><div><strong>Time, pay & workplace</strong><span>History, PTO, schedule, pay and settings</span></div><ChevronRight size={15} /></button>
  </main>;
}
