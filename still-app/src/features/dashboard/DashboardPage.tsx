import { format } from 'date-fns';
import { Bell } from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';

const priorities = ['Finish one important work task', 'Walk the dogs', 'Drink enough water'];
const moods = ['😔','😕','🙂','😊','🥰'];
const energyIcons = ['🪫','🌙','🌿','☀️','⚡'];

export function DashboardPage() {
  const mood = useAppStore((s) => s.mood);
  const energy = useAppStore((s) => s.energy);
  const setMood = useAppStore((s) => s.setMood);
  const setEnergy = useAppStore((s) => s.setEnergy);
  const [done, setDone] = useState<number[]>([]);

  const toggle = (index:number) => setDone((items) => items.includes(index) ? items.filter(i => i !== index) : [...items,index]);

  return <main className="shell">
    <header className="topbar"><div className="brand">Still.</div><div className="avatar"><Bell size={20}/></div></header>
    <section className="hero">
      <p className="subtle">{format(new Date(), 'EEEE, MMMM d')}</p>
      <h1>Good morning. ☀️</h1>
      <p className="subtle">Here is the gentle shape of your day.</p>
      <p className="quote">“You do not have to finish everything today.”</p>
    </section>

    <section className="section">
      <div className="section-head"><h2 className="section-title">How are you?</h2><button className="link-btn">View history</button></div>
      <div className="checkin">
        <div className="card checkin-card"><strong>Mood</strong><div className="emoji-row">{moods.map((x,i)=><button key={x} className={`emoji-btn ${mood===i+1?'active':''}`} onClick={()=>setMood(i+1)}>{x}</button>)}</div></div>
        <div className="card checkin-card"><strong>Energy</strong><div className="emoji-row">{energyIcons.map((x,i)=><button key={x} className={`emoji-btn ${energy===i+1?'active':''}`} onClick={()=>setEnergy(i+1)}>{x}</button>)}</div></div>
      </div>
    </section>

    <section className="section">
      <div className="section-head"><h2 className="section-title">Today’s priorities</h2><button className="link-btn">Edit</button></div>
      <div className="card">{priorities.map((task,i)=><div className="task" key={task}><button className={`checkbox ${done.includes(i)?'done':''}`} onClick={()=>toggle(i)} aria-label={`Complete ${task}`}/><div><strong>{task}</strong><div className="subtle">A small step still counts.</div></div></div>)}</div>
    </section>

    <section className="section">
      <div className="section-head"><h2 className="section-title">Your life</h2><button className="link-btn">Arrange</button></div>
      <div className="grid">
        <div className="card area-card work"><div className="area-icon">💼</div><strong>Work</strong><span className="subtle">Shift at 9:00 PM</span></div>
        <div className="card area-card money"><div className="area-icon">🌱</div><strong>Money</strong><span className="subtle">Payday in 5 days</span></div>
        <div className="card area-card health"><div className="area-icon">🌸</div><strong>Health</strong><span className="subtle">Log today’s sleep</span></div>
        <div className="card area-card love"><div className="area-icon">💌</div><strong>Love</strong><span className="subtle">Plan a little moment</span></div>
      </div>
    </section>
  </main>;
}
