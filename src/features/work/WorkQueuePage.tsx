import { ArrowLeft, Bell, CalendarDays, ChevronRight, CircleAlert, Clock3, Plus, StickyNote, Wrench } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WorkNote, WorkProfile } from '../../domain/work';
import { useAppStore } from '../../stores/useAppStore';

type QueueStatus = 'todo' | 'progress' | 'done';
type IncidentStatus = 'new' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
type WorkIncident = { id: string; reference: string; title: string; priority: 'P1' | 'P2' | 'P3' | 'P4'; system?: string; status: IncidentStatus; note?: string; createdAt: number; updatedAt: number };
type ExtendedWorkProfile = WorkProfile & { incidents?: WorkIncident[]; workTaskStates?: Record<string, QueueStatus> };
type QueueItem = { id: string; kind: 'task' | 'meeting' | 'incident' | 'change' | 'reminder'; title: string; meta: string; status: QueueStatus; sort: string };

function key(date = new Date()) { return date.toISOString().slice(0, 10); }
function id(prefix: string) { return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function shortDate(value?: string) { return value ? new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''; }

export function WorkQueuePage() {
  const navigate = useNavigate();
  const profile = useAppStore((state) => state.workProfile) as ExtendedWorkProfile;
  const tasks = useAppStore((state) => state.tasks);
  const events = useAppStore((state) => state.events);
  const updateProfile = useAppStore((state) => state.updateWorkProfile);
  const addTask = useAppStore((state) => state.addTask);
  const toggleTask = useAppStore((state) => state.toggleTask);
  const openEventEditor = useAppStore((state) => state.openEventEditor);
  const [tab, setTab] = useState<QueueStatus>('todo');
  const [taskTitle, setTaskTitle] = useState('');
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [incident, setIncident] = useState({ reference: '', title: '', priority: 'P3' as WorkIncident['priority'], system: '' });
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteReminder, setNoteReminder] = useState('');
  const today = key();
  const incidents = profile.incidents ?? [];
  const taskStates = profile.workTaskStates ?? {};
  const notes = profile.notes ?? [];
  const changes = profile.changes ?? [];

  const saveProfile = (patch: Partial<ExtendedWorkProfile>) => updateProfile({ ...profile, ...patch } as WorkProfile);
  const workTasks = tasks.filter((task) => task.areaId === 'work');
  const todayMeetings = events.filter((event) => (event.areaId === 'work' || event.category === 'work') && event.startDate === today);

  const queue = useMemo<QueueItem[]>(() => {
    const items: QueueItem[] = [];
    workTasks.forEach((task) => items.push({ id: `task:${task.id}`, kind: 'task', title: task.title, meta: task.dueDate ? shortDate(task.dueDate) : 'Task', status: task.completed ? 'done' : (taskStates[task.id] ?? 'todo'), sort: task.dueDate ?? '9999' }));
    todayMeetings.forEach((event) => {
      const nowTime = new Date().toTimeString().slice(0, 5);
      const status: QueueStatus = event.startTime && event.startTime < nowTime ? 'done' : 'todo';
      items.push({ id: `meeting:${event.id}`, kind: 'meeting', title: event.title, meta: event.allDay ? 'All day · Meeting' : `${event.startTime ?? ''} · Meeting`, status, sort: event.startTime ?? '00:00' });
    });
    incidents.forEach((item) => items.push({ id: `incident:${item.id}`, kind: 'incident', title: `${item.reference ? `${item.reference} · ` : ''}${item.title}`, meta: `${item.priority}${item.system ? ` · ${item.system}` : ''} · Incident`, status: item.status === 'resolved' || item.status === 'closed' ? 'done' : item.status === 'in_progress' || item.status === 'waiting' ? 'progress' : 'todo', sort: String(item.createdAt) }));
    changes.forEach((change) => items.push({ id: `change:${change.id}`, kind: 'change', title: `${change.reference ? `${change.reference} · ` : ''}${change.title}`, meta: `${change.plannedDate ? `${shortDate(change.plannedDate)} · ` : ''}Change`, status: change.status === 'completed' || change.status === 'cancelled' ? 'done' : change.status === 'in_progress' || change.status === 'testing' ? 'progress' : 'todo', sort: change.plannedDate ?? '9999' }));
    notes.filter((note) => note.reminderDate && note.reminderDate <= today).forEach((note) => items.push({ id: `reminder:${note.id}`, kind: 'reminder', title: note.text, meta: `Reminder · ${shortDate(note.reminderDate)}`, status: 'todo', sort: note.reminderDate ?? today }));
    return items.sort((a, b) => a.sort.localeCompare(b.sort));
  }, [workTasks, todayMeetings, incidents, changes, notes, taskStates, today]);

  const visible = queue.filter((item) => item.status === tab);
  const counts = { todo: queue.filter((item) => item.status === 'todo').length, progress: queue.filter((item) => item.status === 'progress').length, done: queue.filter((item) => item.status === 'done').length };

  const addWorkTask = (event: FormEvent) => { event.preventDefault(); const title = taskTitle.trim(); if (!title) return; addTask({ title, priority: 'medium', repeat: 'none', areaId: 'work', dueDate: today }); setTaskTitle(''); };
  const advanceTask = (taskId: string) => { const current = taskStates[taskId] ?? 'todo'; if (current === 'todo') saveProfile({ workTaskStates: { ...taskStates, [taskId]: 'progress' } }); else if (current === 'progress') toggleTask(taskId); };
  const saveIncident = (event: FormEvent) => { event.preventDefault(); if (!incident.title.trim()) return; const now = Date.now(); saveProfile({ incidents: [{ id: id('incident'), reference: incident.reference.trim(), title: incident.title.trim(), priority: incident.priority, system: incident.system.trim() || undefined, status: 'new', createdAt: now, updatedAt: now }, ...incidents] }); setIncident({ reference: '', title: '', priority: 'P3', system: '' }); setIncidentOpen(false); };
  const advanceIncident = (item: WorkIncident) => { const status: IncidentStatus = item.status === 'new' ? 'in_progress' : item.status === 'in_progress' || item.status === 'waiting' ? 'resolved' : item.status; saveProfile({ incidents: incidents.map((entry) => entry.id === item.id ? { ...entry, status, updatedAt: Date.now() } : entry) }); };
  const saveNote = (event: FormEvent) => { event.preventDefault(); if (!noteText.trim()) return; const note: WorkNote = { id: id('work-note'), text: noteText.trim(), kind: 'note', createdAt: Date.now(), reminderDate: noteReminder || undefined }; saveProfile({ notes: [note, ...notes] }); setNoteText(''); setNoteReminder(''); setNoteOpen(false); };

  const icon = (kind: QueueItem['kind']) => kind === 'meeting' ? <CalendarDays size={16} /> : kind === 'incident' ? <CircleAlert size={16} /> : kind === 'change' ? <Wrench size={16} /> : kind === 'reminder' ? <Bell size={16} /> : <Clock3 size={16} />;

  return <main className="shell work-queue-page">
    <style>{`
      .work-queue-page{max-width:760px;padding-bottom:120px}.wq-head{display:flex;align-items:center;gap:14px;margin:12px 0 22px}.wq-head button,.wq-icon-btn{width:40px;height:40px;border:0;border-radius:50%;background:var(--surface,#fff);display:grid;place-items:center}.wq-head div{flex:1}.wq-head h1{margin:2px 0;font-size:2rem}.wq-head p{margin:0;color:var(--text-muted,#746f69);font-size:.9rem}.wq-today{padding:18px 20px;margin-bottom:20px}.wq-today-top{display:flex;justify-content:space-between;align-items:center}.wq-today strong{font-size:1.15rem}.wq-today span{font-size:.8rem;color:var(--text-muted,#746f69)}.wq-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;background:rgba(120,110,100,.08);padding:4px;border-radius:14px;margin:16px 0 12px}.wq-tabs button{border:0;background:transparent;padding:10px 4px;border-radius:11px;font-weight:700;color:inherit}.wq-tabs button.active{background:var(--surface,#fff);box-shadow:0 1px 4px rgba(0,0,0,.08)}.wq-list{display:grid;gap:8px}.wq-row{width:100%;display:flex;align-items:center;gap:11px;text-align:left;border:0;padding:12px 4px;background:transparent;color:inherit}.wq-row+.wq-row{border-top:1px solid rgba(120,110,100,.12)}.wq-row>span:first-child{width:30px;height:30px;border-radius:9px;background:rgba(120,110,100,.08);display:grid;place-items:center}.wq-row div{flex:1;min-width:0}.wq-row strong,.wq-row small{display:block}.wq-row strong{font-size:.94rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wq-row small{margin-top:3px;color:var(--text-muted,#746f69)}.wq-add{display:flex;gap:8px;margin-top:10px}.wq-add input{flex:1;min-width:0;border:1px solid rgba(120,110,100,.16);background:transparent;border-radius:12px;padding:11px 12px}.wq-add button,.wq-section-head button,.wq-form button{border:0;border-radius:12px;padding:10px 13px;font-weight:700}.wq-section{margin-top:28px}.wq-section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}.wq-section-head h2{font-size:1.15rem;margin:0}.wq-card-list{display:grid;gap:9px}.wq-record{padding:14px 16px;display:flex;gap:12px;align-items:center}.wq-record>div{flex:1}.wq-record strong,.wq-record small{display:block}.wq-record small{color:var(--text-muted,#746f69);margin-top:4px}.wq-empty{padding:18px;color:var(--text-muted,#746f69);text-align:center}.wq-form{display:grid;gap:9px;padding:14px;margin-bottom:10px}.wq-form input,.wq-form select,.wq-form textarea{width:100%;box-sizing:border-box;border:1px solid rgba(120,110,100,.16);background:transparent;border-radius:12px;padding:11px;color:inherit}.wq-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.wq-note-text{white-space:pre-wrap}.wq-footer-link{margin-top:28px;width:100%;padding:15px 16px;display:flex;align-items:center;justify-content:space-between;border:0;text-align:left}.wq-footer-link span{display:block;color:var(--text-muted,#746f69);font-size:.8rem;margin-top:3px}
    `}</style>
    <header className="wq-head"><button onClick={() => navigate('/')} type="button" aria-label="Back home"><ArrowLeft size={19}/></button><div><p>Life area</p><h1>Work</h1><p>{profile.jobTitle || profile.employer ? [profile.jobTitle, profile.employer].filter(Boolean).join(' · ') : 'Your workday'}</p></div></header>

    <section className="card wq-today"><div className="wq-today-top"><strong>My Work</strong><span>{todayMeetings.length} meeting{todayMeetings.length === 1 ? '' : 's'} today</span></div><div className="wq-tabs" role="tablist"><button className={tab==='todo'?'active':''} onClick={()=>setTab('todo')} type="button">To Do · {counts.todo}</button><button className={tab==='progress'?'active':''} onClick={()=>setTab('progress')} type="button">In Progress · {counts.progress}</button><button className={tab==='done'?'active':''} onClick={()=>setTab('done')} type="button">Done · {counts.done}</button></div><div className="wq-list">{visible.length===0?<div className="wq-empty">Nothing here.</div>:visible.map(item=><button className="wq-row" key={item.id} onClick={()=>{if(item.kind==='task')advanceTask(item.id.slice(5)); if(item.kind==='meeting')openEventEditor(item.id.slice(8)); if(item.kind==='incident'){const found=incidents.find(x=>x.id===item.id.slice(9));if(found)advanceIncident(found)} if(item.kind==='change')navigate('/work/details');}} type="button"><span>{icon(item.kind)}</span><div><strong>{item.title}</strong><small>{item.meta}</small></div><ChevronRight size={15}/></button>)}</div>{tab==='todo'&&<form className="wq-add" onSubmit={addWorkTask}><input aria-label="New work task" placeholder="Add a task" value={taskTitle} onChange={e=>setTaskTitle(e.target.value)}/><button type="submit" aria-label="Add task"><Plus size={16}/></button></form>}</section>

    <section className="wq-section"><div className="wq-section-head"><h2>Incidents</h2><button onClick={()=>setIncidentOpen(v=>!v)} type="button"><Plus size={15}/> Incident</button></div>{incidentOpen&&<form className="card wq-form" onSubmit={saveIncident}><div className="wq-form-grid"><input placeholder="INC number" value={incident.reference} onChange={e=>setIncident(v=>({...v,reference:e.target.value}))}/><select value={incident.priority} onChange={e=>setIncident(v=>({...v,priority:e.target.value as WorkIncident['priority']}))}><option>P1</option><option>P2</option><option>P3</option><option>P4</option></select></div><input required placeholder="What happened?" value={incident.title} onChange={e=>setIncident(v=>({...v,title:e.target.value}))}/><input placeholder="System / SID" value={incident.system} onChange={e=>setIncident(v=>({...v,system:e.target.value}))}/><button type="submit">Add incident</button></form>}<div className="wq-card-list">{incidents.filter(x=>x.status!=='closed'&&x.status!=='resolved').length===0?<div className="card wq-empty">No open incidents.</div>:incidents.filter(x=>x.status!=='closed'&&x.status!=='resolved').map(item=><button className="card wq-record" key={item.id} onClick={()=>advanceIncident(item)} type="button"><CircleAlert size={17}/><div><strong>{item.reference ? `${item.reference} · ` : ''}{item.title}</strong><small>{item.priority}{item.system?` · ${item.system}`:''} · {item.status.replace('_',' ')}</small></div><ChevronRight size={15}/></button>)}</div></section>

    <section className="wq-section"><div className="wq-section-head"><h2>Changes</h2><button onClick={()=>navigate('/work/details')} type="button"><Plus size={15}/> Change</button></div><div className="wq-card-list">{changes.filter(x=>x.status!=='completed'&&x.status!=='cancelled').length===0?<div className="card wq-empty">No open changes.</div>:changes.filter(x=>x.status!=='completed'&&x.status!=='cancelled').slice(0,5).map(change=><button className="card wq-record" key={change.id} onClick={()=>navigate('/work/details')} type="button"><Wrench size={17}/><div><strong>{change.reference?`${change.reference} · `:''}{change.title}</strong><small>{[change.system,change.environment,change.plannedDate?shortDate(change.plannedDate):undefined,change.status.replace('_',' ')].filter(Boolean).join(' · ')}</small></div><ChevronRight size={15}/></button>)}</div></section>

    <section className="wq-section"><div className="wq-section-head"><h2>Notes</h2><button onClick={()=>setNoteOpen(v=>!v)} type="button"><Plus size={15}/> Note</button></div>{noteOpen&&<form className="card wq-form" onSubmit={saveNote}><textarea rows={3} required placeholder="Write anything…" value={noteText} onChange={e=>setNoteText(e.target.value)}/><label><small>Remind me (optional)</small><input type="date" value={noteReminder} onChange={e=>setNoteReminder(e.target.value)}/></label><button type="submit">Save note</button></form>}<div className="wq-card-list">{notes.length===0?<div className="card wq-empty">No notes yet.</div>:notes.slice(0,5).map(note=><article className="card wq-record" key={note.id}><StickyNote size={17}/><div><strong className="wq-note-text">{note.text}</strong><small>{note.reminderDate?<><Bell size={11}/> Reminder {shortDate(note.reminderDate)}</>:'Note'}</small></div></article>)}</div></section>

    <button className="card wq-footer-link" onClick={()=>navigate('/work/details')} type="button"><div><strong>Time, pay & workplace</strong><span>Shifts, PTO, schedule, pay and settings</span></div><ChevronRight size={17}/></button>
  </main>;
}
