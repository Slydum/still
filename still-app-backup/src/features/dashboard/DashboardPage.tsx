import { format } from 'date-fns';
import { Bell, ChevronRight, Heart, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '../../stores/useAppStore';

const priorities = [
  { title: 'Finish one important work task', note: 'A small step still counts.' },
  { title: 'Walk the dogs', note: 'Fresh air for all of you.' },
  { title: 'Drink enough water', note: 'Take gentle care of your body.' },
];

const moods = [
  { icon: '😔', label: 'Low' },
  { icon: '😕', label: 'Heavy' },
  { icon: '🙂', label: 'Okay' },
  { icon: '😊', label: 'Good' },
  { icon: '🥰', label: 'Lovely' },
];

const energyLevels = [
  { icon: '🪫', label: 'Empty' },
  { icon: '🌙', label: 'Low' },
  { icon: '🌿', label: 'Steady' },
  { icon: '☀️', label: 'Bright' },
  { icon: '⚡', label: 'Full' },
];

function greetingForHour(hour: number) {
  if (hour < 12) return 'Good morning.';
  if (hour < 18) return 'Good afternoon.';
  return 'Good evening.';
}

function CozyHeroIllustration() {
  return (
    <svg
      className="hero-illustration"
      viewBox="0 0 280 210"
      role="img"
      aria-label="A sleeping cat beside a potted plant under soft clouds"
    >
      <defs>
        <linearGradient id="pot" x1="0" x2="1">
          <stop offset="0" stopColor="#f7a9bd" />
          <stop offset="1" stopColor="#ffd0dc" />
        </linearGradient>
        <linearGradient id="cat" x1="0" x2="1">
          <stop offset="0" stopColor="#b9a7a8" />
          <stop offset="1" stopColor="#d7c5c5" />
        </linearGradient>
      </defs>

      <g className="cloud cloud-one" opacity="0.9">
        <ellipse cx="210" cy="35" rx="33" ry="14" fill="#fff" />
        <circle cx="192" cy="30" r="14" fill="#fff" />
        <circle cx="216" cy="24" r="18" fill="#fff" />
        <circle cx="235" cy="33" r="12" fill="#fff" />
      </g>
      <g className="cloud cloud-two" opacity="0.72">
        <ellipse cx="69" cy="48" rx="28" ry="11" fill="#fff" />
        <circle cx="54" cy="43" r="11" fill="#fff" />
        <circle cx="72" cy="36" r="14" fill="#fff" />
        <circle cx="88" cy="44" r="10" fill="#fff" />
      </g>

      <g className="sparkle" fill="#efc96d">
        <path d="M246 74l3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8z" />
        <path d="M36 78l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z" />
      </g>

      <g className="plant">
        <path d="M69 139C55 112 56 84 72 62" fill="none" stroke="#86ad87" strokeWidth="5" strokeLinecap="round" />
        <path d="M69 117C45 111 37 94 42 79 61 82 72 94 69 117z" fill="#a9cfac" />
        <path d="M69 101C88 92 94 76 89 63 72 67 64 82 69 101z" fill="#7fb389" />
        <path d="M70 83C55 70 55 54 62 43 77 52 81 67 70 83z" fill="#b9d8aa" />
        <path d="M72 77C90 67 96 51 91 39 74 44 67 61 72 77z" fill="#91c29a" />
        <path d="M49 139h43l-5 43H55z" fill="url(#pot)" />
        <path d="M45 136h51v12H45z" rx="6" fill="#f58ead" />
        <ellipse cx="70" cy="180" rx="25" ry="5" fill="#e9bfd0" opacity="0.55" />
      </g>

      <g className="cat">
        <ellipse cx="177" cy="163" rx="72" ry="12" fill="#d9cbd8" opacity="0.38" />
        <path d="M121 143c0-34 29-58 67-54 37 4 57 28 52 57-5 28-31 35-67 34-33-1-52-10-52-37z" fill="url(#cat)" />
        <path d="M203 106c12-2 25 2 34 11l8-16 8 31c4 19-10 35-31 35-20 0-34-14-32-33 1-12 6-22 13-28z" fill="#b9a6a7" />
        <path d="M207 106l-3-24 17 17M238 111l16-19-2 31" fill="#b9a6a7" stroke="#9f8c8f" strokeWidth="3" strokeLinejoin="round" />
        <path d="M213 137c5 4 10 4 15 0M219 144c3 4 7 4 10 0" fill="none" stroke="#756a78" strokeWidth="3" strokeLinecap="round" />
        <path d="M208 128h3M235 128h3" stroke="#756a78" strokeWidth="5" strokeLinecap="round" />
        <path d="M225 133l3 2-3 2-3-2z" fill="#e996a9" />
        <path d="M192 118c-16-9-33-7-42 4" fill="none" stroke="#a89397" strokeWidth="5" strokeLinecap="round" />
        <path d="M154 133c13 8 22 22 23 39" fill="none" stroke="#a89397" strokeWidth="5" strokeLinecap="round" />
        <path d="M128 145c-17-5-30 1-36 13 12 5 24 2 34-8" fill="none" stroke="#b9a6a7" strokeWidth="12" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function DogSticker() {
  return (
    <svg className="dog-sticker" viewBox="0 0 120 100" aria-hidden="true">
      <ellipse cx="62" cy="86" rx="42" ry="8" fill="#e9dbe7" opacity="0.55" />
      <path d="M34 52c0-22 14-37 31-37s31 15 31 37v17c0 17-14 25-31 25S34 86 34 69z" fill="#d8b995" />
      <path d="M39 30C25 20 18 28 21 47c2 15 10 21 18 15zM90 30c14-10 21-2 18 17-2 15-10 21-18 15z" fill="#b98e6e" />
      <ellipse cx="65" cy="64" rx="20" ry="16" fill="#f7e7d5" />
      <circle cx="51" cy="52" r="3" fill="#574d5d" />
      <circle cx="79" cy="52" r="3" fill="#574d5d" />
      <path d="M61 62l4-3 4 3-4 4z" fill="#574d5d" />
      <path d="M65 66c-2 5-8 6-11 2M65 66c2 5 8 6 11 2" fill="none" stroke="#574d5d" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M99 38c10-5 15-13 14-23" fill="none" stroke="#efc96d" strokeWidth="3" strokeLinecap="round" />
      <path d="M112 8l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#efc96d" />
    </svg>
  );
}

export function DashboardPage() {
  const mood = useAppStore((state) => state.mood);
  const energy = useAppStore((state) => state.energy);
  const setMood = useAppStore((state) => state.setMood);
  const setEnergy = useAppStore((state) => state.setEnergy);
  const [done, setDone] = useState<number[]>([]);

  const now = new Date();
  const greeting = greetingForHour(now.getHours());

  const toggle = (index: number) => {
    setDone((items) => (items.includes(index) ? items.filter((item) => item !== index) : [...items, index]));
  };

  return (
    <main className="shell dashboard-shell">
      <header className="topbar">
        <div className="brand">Still.</div>
        <button className="icon-button" type="button" aria-label="Open notifications">
          <Bell size={20} />
          <span className="notification-dot" />
        </button>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">{format(now, 'EEEE, MMMM d')}</p>
          <h1>{greeting}</h1>
          <p className="hero-subtitle">Here is the gentle shape of your day.</p>
          <p className="quote">“You do not have to finish everything today.”</p>
        </div>
        <CozyHeroIllustration />
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="section-kicker">A little check-in</p>
            <h2 className="section-title">How are you?</h2>
          </div>
          <button className="link-btn" type="button">View history</button>
        </div>

        <div className="checkin">
          <article className="card checkin-card">
            <strong>Mood</strong>
            <p className="micro-copy">Choose what feels closest.</p>
            <div className="emoji-row">
              {moods.map((item, index) => (
                <button
                  key={item.label}
                  className={`emoji-btn ${mood === index + 1 ? 'active' : ''}`}
                  onClick={() => setMood(index + 1)}
                  type="button"
                  aria-label={`Mood: ${item.label}`}
                  aria-pressed={mood === index + 1}
                >
                  <span>{item.icon}</span>
                </button>
              ))}
            </div>
          </article>

          <article className="card checkin-card energy-card">
            <strong>Energy</strong>
            <p className="micro-copy">No judgment, just notice.</p>
            <div className="emoji-row">
              {energyLevels.map((item, index) => (
                <button
                  key={item.label}
                  className={`emoji-btn ${energy === index + 1 ? 'active' : ''}`}
                  onClick={() => setEnergy(index + 1)}
                  type="button"
                  aria-label={`Energy: ${item.label}`}
                  aria-pressed={energy === index + 1}
                >
                  <span>{item.icon}</span>
                </button>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="section-kicker">One thing at a time</p>
            <h2 className="section-title">Today’s priorities</h2>
          </div>
          <button className="link-btn" type="button">Edit</button>
        </div>

        <article className="card priority-card">
          {priorities.map((task, index) => {
            const completed = done.includes(index);
            return (
              <div className={`task ${completed ? 'is-complete' : ''}`} key={task.title}>
                <button
                  className={`checkbox ${completed ? 'done' : ''}`}
                  onClick={() => toggle(index)}
                  type="button"
                  aria-label={`${completed ? 'Mark incomplete' : 'Complete'} ${task.title}`}
                  aria-pressed={completed}
                >
                  {completed ? '✓' : ''}
                </button>
                <div className="task-copy">
                  <strong>{task.title}</strong>
                  <div className="subtle">{task.note}</div>
                </div>
              </div>
            );
          })}
          <DogSticker />
        </article>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <p className="section-kicker">Your little world</p>
            <h2 className="section-title">Life overview</h2>
          </div>
          <button className="link-btn" type="button">Arrange</button>
        </div>

        <div className="life-grid">
          <button className="card area-card work" type="button">
            <span className="area-art">☁️</span>
            <span className="area-icon">💼</span>
            <strong>Work</strong>
            <span className="subtle">Shift at 9:00 PM</span>
            <ChevronRight className="area-chevron" size={18} />
          </button>
          <button className="card area-card money" type="button">
            <span className="area-art">🌱</span>
            <span className="area-icon">🪙</span>
            <strong>Money</strong>
            <span className="subtle">Payday in 5 days</span>
            <ChevronRight className="area-chevron" size={18} />
          </button>
          <button className="card area-card health" type="button">
            <span className="area-art">🌼</span>
            <span className="area-icon">🌿</span>
            <strong>Health</strong>
            <span className="subtle">Log today’s sleep</span>
            <ChevronRight className="area-chevron" size={18} />
          </button>
          <button className="card area-card love" type="button">
            <span className="area-art"><Heart size={25} fill="currentColor" /></span>
            <span className="area-icon">💌</span>
            <strong>Love</strong>
            <span className="subtle">Plan a little moment</span>
            <ChevronRight className="area-chevron" size={18} />
          </button>
        </div>
      </section>

      <section className="section closing-note">
        <div className="closing-icon"><Sparkles size={20} /></div>
        <div>
          <p className="section-kicker">A quiet reminder</p>
          <p className="closing-quote">You are growing into who you are meant to be.</p>
        </div>
        <div className="mini-clouds" aria-hidden="true"><span>☁️</span><span>☁️</span></div>
      </section>
    </main>
  );
}
