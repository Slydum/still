import { ArrowLeft, CalendarDays, ChevronRight, Heart, Plus, Sparkles, StickyNote, UserRound, X } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toAppPath } from '../../app/appLocation';
import { useAppStore, type EventRepeat, type JournalEntry } from '../../stores/useAppStore';
import './love.css';

type Composer = 'person' | 'plan' | 'moment' | 'note' | null;
type PersonMeta = { relationship: string; birthday?: string; note?: string };
const connectionLabels = ['Distant', 'A little off', 'Steady', 'Close', 'Very close'];

function dateKey(date = new Date()) { const y=date.getFullYear(); const m=String(date.getMonth()+1).padStart(2,'0'); const d=String(date.getDate()).padStart(2,'0'); return `${y}-${m}-${d}`; }
function shortDate(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric'}); }
function timeLabel(value?: string) { return value ? new Date(`2000-01-01T${value}:00`).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}) : ''; }
function personLink(id: string) { return { kind: 'person' as const, id }; }
function hasPerson(entry: { links?: { kind: string; id: string }[] }, id: string) { return entry.links?.some((link)=>link.kind==='person'&&link.id===id) ?? false; }
function parseMeta(entry: JournalEntry): PersonMeta { try { return JSON.parse(entry.body) as PersonMeta; } catch { return { relationship: 'Someone important', note: entry.body }; } }
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0,2).map((part)=>part[0]?.toUpperCase()).join('') || '♡'; }
function checkInValue(title?: string) { const match=title?.match(/^Connection check-in · ([1-5])$/); return match ? Number(match[1]) : undefined; }

export function LovePage() {
  const navigate=useNavigate();
  const events=useAppStore((state)=>state.events);
  const journalEntries=useAppStore((state)=>state.journalEntries);
  const addEvent=useAppStore((state)=>state.addEvent);
  const openEventEditor=useAppStore((state)=>state.openEventEditor);
  const addJournalEntry=useAppStore((state)=>state.addJournalEntry);
  const updateJournalEntry=useAppStore((state)=>state.updateJournalEntry);
  const openJournalEditor=useAppStore((state)=>state.openJournalEditor);
  const today=dateKey();
  const [selectedId,setSelectedId]=useState<string>();
  const [composer,setComposer]=useState<Composer>(null);
  const [person,setPerson]=useState({name:'',relationship:'Partner',birthday:'',note:''});
  const [plan,setPlan]=useState({title:'',date:today,time:'19:00',repeat:'none' as EventRepeat});
  const [moment,setMoment]=useState('');
  const [note,setNote]=useState('');

  const people=useMemo(()=>journalEntries.filter((entry)=>entry.areaId==='love'&&entry.tags.includes('love-person')).sort((a,b)=>a.title?.localeCompare(b.title??'')??0),[journalEntries]);
  const selected=people.find((entry)=>entry.id===selectedId);
  const selectedMeta=selected ? parseMeta(selected) : undefined;
  const upcoming=events.filter((event)=>event.areaId==='love'&&event.endDate>=today).sort((a,b)=>`${a.startDate}${a.startTime??''}`.localeCompare(`${b.startDate}${b.startTime??''}`));
  const personEvents=selected ? upcoming.filter((event)=>hasPerson(event,selected.id)) : [];
  const personEntries=selected ? journalEntries.filter((entry)=>entry.areaId==='love'&&hasPerson(entry,selected.id)&&!entry.tags.includes('love-person')).sort((a,b)=>b.entryDate.localeCompare(a.entryDate)||b.updatedAt-a.updatedAt) : [];
  const moments=personEntries.filter((entry)=>entry.tags.includes('love-moment'));
  const notes=personEntries.filter((entry)=>entry.tags.includes('love-note'));
  const checkIns=personEntries.filter((entry)=>entry.tags.includes('love-checkin'));
  const latestConnection=checkInValue(checkIns[0]?.title);
  const linkedUpcoming=upcoming.filter((event)=>people.some((p)=>hasPerson(event,p.id))).slice(0,3);

  const savePerson=(event:FormEvent)=>{ event.preventDefault(); const name=person.name.trim(); if(!name)return; addJournalEntry({title:name,body:JSON.stringify({relationship:person.relationship,birthday:person.birthday||undefined,note:person.note.trim()||undefined}),entryDate:today,tags:['love','love-person'],areaId:'love'}); setPerson({name:'',relationship:'Partner',birthday:'',note:''}); setComposer(null); };
  const savePlan=(event:FormEvent)=>{ event.preventDefault(); if(!selected||!plan.title.trim())return; addEvent({title:plan.title.trim(),category:'love',areaId:'love',startDate:plan.date,endDate:plan.date,allDay:false,startTime:plan.time,endTime:plan.time,repeat:plan.repeat,links:[personLink(selected.id)]}); setPlan({title:'',date:today,time:'19:00',repeat:'none'}); setComposer(null); };
  const saveMoment=(event:FormEvent)=>{ event.preventDefault(); if(!selected||!moment.trim())return; addJournalEntry({title:'A moment',body:moment.trim(),entryDate:today,tags:['love','love-moment'],areaId:'love',links:[personLink(selected.id)]}); setMoment(''); setComposer(null); };
  const saveNote=(event:FormEvent)=>{ event.preventDefault(); if(!selected||!note.trim())return; addJournalEntry({title:'Love note',body:note.trim(),entryDate:today,tags:['love','love-note'],areaId:'love',links:[personLink(selected.id)]}); setNote(''); setComposer(null); };
  const saveConnection=(value:number)=>{ if(!selected)return; const existing=checkIns.find((entry)=>entry.entryDate===today); const input={title:`Connection check-in · ${value}`,body:connectionLabels[value-1],entryDate:today,tags:['love','love-checkin'],areaId:'love' as const,links:[personLink(selected.id)]}; if(existing) updateJournalEntry(existing.id,input); else addJournalEntry(input); };

  if(selected&&selectedMeta){
    return <main className="shell love-page">
      <header className="love-header"><button className="love-back" onClick={()=>{setSelectedId(undefined);setComposer(null);}} type="button" aria-label="Back to relationships"><ArrowLeft size={19}/></button><div><p className="section-kicker">{selectedMeta.relationship}</p><h1>{selected.title}</h1></div><div className="love-avatar large">{initials(selected.title??'')}</div></header>
      <section className="love-person-summary card"><div><small>Relationship</small><strong>{selectedMeta.relationship}</strong>{selectedMeta.birthday&&<span>Birthday · {shortDate(selectedMeta.birthday)}</span>}{selectedMeta.note&&<p>{selectedMeta.note}</p>}</div><div className="love-mini-stats"><span><b>{personEvents.length}</b> plans</span><span><b>{moments.length}</b> moments</span><span><b>{notes.length}</b> notes</span></div></section>
      <section className="love-section"><div className="love-section-head"><div><h2>Connection</h2><p>{latestConnection?connectionLabels[latestConnection-1]:'How does it feel today?'}</p></div></div><div className="love-pulse">{[1,2,3,4,5].map((value)=><button className={latestConnection===value?'is-selected':''} key={value} onClick={()=>saveConnection(value)} type="button" aria-label={connectionLabels[value-1]}><Heart size={18} fill={latestConnection===value?'currentColor':'none'}/></button>)}</div></section>
      <RelationshipSection title="Plans" action="Plan" active={composer==='plan'} onToggle={()=>setComposer(composer==='plan'?null:'plan')}>{composer==='plan'&&<form className="love-inline-form" onSubmit={savePlan}><FormTop title="Make a plan" close={()=>setComposer(null)}/><input value={plan.title} onChange={(e)=>setPlan({...plan,title:e.target.value})} placeholder="Dinner, trip, anniversary…" aria-label="Plan title"/><div className="love-form-grid"><input type="date" value={plan.date} onChange={(e)=>setPlan({...plan,date:e.target.value})}/><input type="time" value={plan.time} onChange={(e)=>setPlan({...plan,time:e.target.value})}/></div><select value={plan.repeat} onChange={(e)=>setPlan({...plan,repeat:e.target.value as EventRepeat})}><option value="none">One time</option><option value="weekly">Every week</option><option value="monthly">Every month</option><option value="daily">Every day</option></select><button className="love-save" type="submit">Save</button></form>}<div className="love-list card">{personEvents.length===0?<div className="love-empty">No plans yet.</div>:personEvents.slice(0,4).map((item)=><button className="love-row" key={item.id} onClick={()=>openEventEditor(item.id)} type="button"><CalendarDays size={17}/><div><strong>{item.title}</strong><small>{shortDate(item.startDate)}{item.startTime?` · ${timeLabel(item.startTime)}`:''}</small></div><ChevronRight size={16}/></button>)}</div></RelationshipSection>
      <RelationshipSection title="Moments" action="Moment" active={composer==='moment'} onToggle={()=>setComposer(composer==='moment'?null:'moment')}>{composer==='moment'&&<form className="love-inline-form" onSubmit={saveMoment}><FormTop title="Keep a moment" close={()=>setComposer(null)}/><textarea value={moment} onChange={(e)=>setMoment(e.target.value)} placeholder="Something worth remembering…"/><button className="love-save" type="submit">Keep</button></form>}<EntryList entries={moments} icon="moment" open={openJournalEditor}/></RelationshipSection>
      <RelationshipSection title="Notes" action="Note" active={composer==='note'} onToggle={()=>setComposer(composer==='note'?null:'note')}>{composer==='note'&&<form className="love-inline-form" onSubmit={saveNote}><FormTop title="Worth remembering" close={()=>setComposer(null)}/><textarea value={note} onChange={(e)=>setNote(e.target.value)} placeholder="Favorite thing, gift idea, a detail…"/><button className="love-save" type="submit">Save</button></form>}<EntryList entries={notes} icon="note" open={openJournalEditor}/></RelationshipSection>
    </main>;
  }

  return <main className="shell love-page">
    <header className="love-header"><button className="love-back" onClick={()=>navigate('/')} type="button" aria-label="Back home"><ArrowLeft size={19}/></button><div><p className="section-kicker">Life area</p><h1>Love</h1></div><img src={toAppPath('/assets/cozy/love-animal-friends.png')} alt="" aria-hidden="true"/></header>
    <section className="love-summary card"><div className="love-summary-main"><span className="love-summary-icon"><Heart size={22}/></span><div><small>Your people</small><strong>{people.length?`${people.length} relationship${people.length===1?'':'s'}`:'Your relationships'}</strong><span>{linkedUpcoming[0]?`Next: ${linkedUpcoming[0].title} · ${shortDate(linkedUpcoming[0].startDate)}`:'Keep the people who matter close.'}</span></div></div></section>
    <section className="love-section"><div className="love-section-head"><div><h2>Relationships</h2></div><button onClick={()=>setComposer(composer==='person'?null:'person')} type="button"><Plus size={16}/> Add</button></div>
      {composer==='person'&&<form className="love-inline-form" onSubmit={savePerson}><FormTop title="Add someone" close={()=>setComposer(null)}/><input value={person.name} onChange={(e)=>setPerson({...person,name:e.target.value})} placeholder="Name" aria-label="Name"/><select value={person.relationship} onChange={(e)=>setPerson({...person,relationship:e.target.value})}><option>Partner</option><option>Family</option><option>Friend</option><option>Mentor</option><option>Someone important</option></select><input className="love-date-input" type="date" value={person.birthday} onChange={(e)=>setPerson({...person,birthday:e.target.value})} aria-label="Birthday"/><textarea value={person.note} onChange={(e)=>setPerson({...person,note:e.target.value})} placeholder="Anything worth knowing…"/><button className="love-save" type="submit">Add relationship</button></form>}
      {people.length===0?<button className="love-empty-collection card" onClick={()=>setComposer('person')} type="button"><UserRound size={26}/><strong>Add your first relationship</strong><span>Partner, family, friends — the people you want to remember well.</span></button>:<div className="love-people-grid">{people.map((entry)=>{const meta=parseMeta(entry); const next=upcoming.find((event)=>hasPerson(event,entry.id)); const recent=journalEntries.filter((item)=>hasPerson(item,entry.id)&&item.tags.includes('love-moment')).sort((a,b)=>b.entryDate.localeCompare(a.entryDate))[0]; return <button className="love-person-card card" key={entry.id} onClick={()=>setSelectedId(entry.id)} type="button"><div className="love-avatar">{initials(entry.title??'')}</div><div><strong>{entry.title}</strong><small>{meta.relationship}</small>{(next||recent)&&<span>{next?`${next.title} · ${shortDate(next.startDate)}`:`Last moment · ${shortDate(recent!.entryDate)}`}</span>}</div><ChevronRight size={17}/></button>;})}</div>}
    </section>
    {linkedUpcoming.length>0&&<section className="love-section"><div className="love-section-head"><div><h2>Coming up</h2></div></div><div className="love-list card">{linkedUpcoming.map((event)=>{const owner=people.find((person)=>hasPerson(event,person.id)); return <button className="love-row" key={event.id} onClick={()=>owner&&setSelectedId(owner.id)} type="button"><CalendarDays size={17}/><div><strong>{event.title}</strong><small>{owner?.title} · {shortDate(event.startDate)}{event.startTime?` · ${timeLabel(event.startTime)}`:''}</small></div><ChevronRight size={16}/></button>;})}</div></section>}
  </main>;
}

function RelationshipSection({title,action,onToggle,children}:{title:string;action:string;active:boolean;onToggle:()=>void;children:React.ReactNode}) { return <section className="love-section"><div className="love-section-head"><div><h2>{title}</h2></div><button onClick={onToggle} type="button"><Plus size={16}/> {action}</button></div>{children}</section>; }
function FormTop({title,close}:{title:string;close:()=>void}) { return <div className="love-form-top"><strong>{title}</strong><button type="button" onClick={close} aria-label="Close"><X size={17}/></button></div>; }
function EntryList({entries,icon,open}:{entries:JournalEntry[];icon:'moment'|'note';open:(id?:string)=>void}) { const Icon=icon==='moment'?Sparkles:StickyNote; return <div className="love-list card">{entries.length===0?<div className="love-empty">Nothing here yet.</div>:entries.slice(0,4).map((entry)=><button className="love-row" key={entry.id} onClick={()=>open(entry.id)} type="button"><Icon size={17}/><div><strong>{entry.body}</strong><small>{shortDate(entry.entryDate)}</small></div><ChevronRight size={16}/></button>)}</div>; }
