import { format } from 'date-fns';
import { Bell, BriefcaseBusiness, CalendarDays, Heart, Sparkles, WalletCards } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getSecondaryQuote } from '../../content/quoteEngine';
import { saveCheckIn } from '../../data/stillDb';
import { useDailyQuote } from '../../hooks/useDailyQuote';
import { useAppStore } from '../../stores/useAppStore';
import { stillAssets } from '../../theme/stillAssets';
import { createStillContext, getGreeting, type WeatherKey } from '../../theme/stillContext';
import { buildStillTheme } from '../../theme/themeEngine';

const priorities = [
  { title: 'Finish the presentation', note: 'A small step still counts.' },
  { title: 'Walk the dogs', note: 'Fresh air for all of you.' },
  { title: 'Drink enough water', note: 'Take gentle care of your body.' },
];

const moods = [
  { asset: stillAssets.checkIn.mood.sad, label: 'Sad' },
  { asset: stillAssets.checkIn.mood.calm, label: 'Calm' },
  { asset: stillAssets.checkIn.mood.content, label: 'Content' },
  { asset: stillAssets.checkIn.mood.happy, label: 'Happy' },
  { asset: stillAssets.checkIn.mood.excited, label: 'Excited' },
];

const energyLevels = [
  { asset: stillAssets.checkIn.energy.exhausted, label: 'Exhausted' },
  { asset: stillAssets.checkIn.energy.low, label: 'Low' },
  { asset: stillAssets.checkIn.energy.balanced, label: 'Balanced' },
  { asset: stillAssets.checkIn.energy.high, label: 'High' },
  { asset: stillAssets.checkIn.energy.energized, label: 'Energized' },
];

const weatherOptions: Array<{ value: WeatherKey | ''; label: string }> = [
  { value: '', label: 'Set weather' },
  { value: 'partly-sunny', label: 'Partly sunny' },
  { value: 'cloudy', label: 'Cloudy' },
  { value: 'overcast', label: 'Overcast' },
  { value: 'rain', label: 'Rainy' },
  { value: 'thunderstorm', label: 'Stormy' },
  { value: 'windy', label: 'Windy' },
  { value: 'fog', label: 'Foggy' },
  { value: 'rainbow', label: 'Rainbow' },
  { value: 'snow', label: 'Snowy' },
];

const lifeAreas = [
  { key: 'work', label: 'Work', status: 'Focused', progress: 5, icon: stillAssets.tabs.work },
  { key: 'love', label: 'Love', status: 'Needs attention', progress: 3, icon: stillAssets.tabs.love },
  { key: 'health', label: 'Health', status: 'Doing well', progress: 6, icon: stillAssets.tabs.health },
  { key: 'money', label: 'Money', status: 'On budget', progress: 5, icon: stillAssets.tabs.finance },
] as const;

function useCurrentTime() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);
  return now;
}

export function DashboardPage() {
  const mood = useAppStore((state) => state.mood);
  const energy = useAppStore((state) => state.energy);
  const weather = useAppStore((state) => state.weather);
  const occasion = useAppStore((state) => state.occasion);
  const setMood = useAppStore((state) => state.setMood);
  const setEnergy = useAppStore((state) => state.setEnergy);
  const setWeather = useAppStore((state) => state.setWeather);
  const hydrateForToday = useAppStore((state) => state.hydrateForToday);
  const [done, setDone] = useState<number[]>([]);
  const now = useCurrentTime();

  const context = useMemo(
    () => createStillContext({ date: now, mood, energy, weather, occasion }),
    [now, mood, energy, weather, occasion],
  );

  useEffect(() => { hydrateForToday(); }, [context.dateKey, hydrateForToday]);
  const theme = useMemo(() => buildStillTheme(context), [context]);
  const { quote, isLoading } = useDailyQuote(context);
  const closingQuote = useMemo(() => getSecondaryQuote(context, quote.id), [context, quote.id]);

  useEffect(() => {
    if (!mood && !energy) return;
    void saveCheckIn({ date: context.dateKey, mood, energy, updatedAt: Date.now() }).catch(() => undefined);
  }, [context.dateKey, mood, energy]);

  const toggle = (index: number) => {
    setDone((items) => items.includes(index) ? items.filter((item) => item !== index) : [...items, index]);
  };

  return (
    <main className="shell dashboard-shell dashboard-v2">
      <header className="topbar topbar-v2">
        <div>
          <div className="brand">Still.</div>
          <p className="topbar-date">{format(now, 'EEEE, MMMM d')}</p>
        </div>
        <button className="icon-button" type="button" aria-label="Open notifications">
          <Bell size={20} />
          <span className="notification-dot" />
        </button>
      </header>

      <section className={`hero hero-v2 ${theme.paletteClass}`}>
        <div className="hero-copy">
          <h1>{getGreeting(context.timeOfDay)}</h1>
          <p className={`quote ${isLoading ? 'is-loading' : ''}`}>“{quote.text}”</p>
          <label className="weather-picker weather-picker-v2">
            <span className="visually-hidden">Choose today’s weather</span>
            <select value={weather ?? ''} onChange={(event) => setWeather((event.target.value || undefined) as WeatherKey | undefined)}>
              {weatherOptions.map((option) => <option key={option.value || 'none'} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
        <div className={`hero-art hero-art-v2 hero-kind-${theme.heroKind}`}>
          <div className="hero-scene-wash" />
          <img className="hero-main-art hero-main-art-v2" src={theme.heroAsset} alt={theme.heroAlt} />
        </div>
      </section>

      <section className="section section-v2">
        <div className="section-head compact-head">
          <div><p className="section-kicker">How are you?</p></div>
          <button className="link-btn" type="button">View history</button>
        </div>

        <article className="card checkin-combined-card">
          <div className="checkin-column">
            <strong>Mood</strong>
            <div className="emoji-row">
              {moods.map((item, index) => (
                <button key={item.label} className={`emoji-btn ${mood === index + 1 ? 'active' : ''}`} onClick={() => setMood(index + 1)} type="button" aria-label={`Mood: ${item.label}`} aria-pressed={mood === index + 1} title={item.label}>
                  <img src={item.asset} alt="" />
                </button>
              ))}
            </div>
          </div>
          <div className="checkin-divider" />
          <div className="checkin-column">
            <strong>Energy</strong>
            <div className="emoji-row">
              {energyLevels.map((item, index) => (
                <button key={item.label} className={`emoji-btn ${energy === index + 1 ? 'active' : ''}`} onClick={() => setEnergy(index + 1)} type="button" aria-label={`Energy: ${item.label}`} aria-pressed={energy === index + 1} title={item.label}>
                  <img src={item.asset} alt="" />
                </button>
              ))}
            </div>
          </div>
          {(mood || energy) && (
            <div className="checkin-response-inline" aria-live="polite">
              <img src={theme.checkInAsset} alt="" />
              <p>{theme.checkInMessage}</p>
            </div>
          )}
        </article>
      </section>

      <section className="section dashboard-two-column">
        <article className="card focus-card">
          <p className="section-kicker">Today’s focus</p>
          <div className="focus-list">
            {priorities.map((task, index) => {
              const completed = done.includes(index);
              return (
                <div className={`task ${completed ? 'is-complete' : ''}`} key={task.title}>
                  <button className={`checkbox ${completed ? 'done' : ''}`} onClick={() => toggle(index)} type="button" aria-label={`${completed ? 'Mark incomplete' : 'Complete'} ${task.title}`} aria-pressed={completed}>{completed ? '✓' : ''}</button>
                  <div className="task-copy"><strong>{task.title}</strong></div>
                </div>
              );
            })}
          </div>
          <img className="priority-pet focus-pet" src={theme.priorityAsset} alt="" aria-hidden="true" />
        </article>

        <article className="card upcoming-card">
          <p className="section-kicker">Coming up</p>
          <div className="timeline">
            <div className="timeline-item"><span className="timeline-dot" /><span className="timeline-icon work"><BriefcaseBusiness size={18} /></span><div><small>9:00 PM</small><strong>Work shift</strong></div></div>
            <div className="timeline-item"><span className="timeline-dot" /><span className="timeline-icon money"><WalletCards size={18} /></span><div><small>Friday</small><strong>Payday</strong></div></div>
            <div className="timeline-item"><span className="timeline-dot" /><span className="timeline-icon love"><Heart size={18} /></span><div><small>Saturday</small><strong>Date night</strong></div></div>
          </div>
        </article>
      </section>

      <section className="section life-garden-section">
        <div className="section-head">
          <div><p className="section-kicker">Life garden</p><p className="micro-copy garden-subtitle">Nurture what matters.</p></div>
          <button className="link-btn" type="button">View all</button>
        </div>
        <div className="life-garden-grid">
          {lifeAreas.map((area) => (
            <button className={`card garden-card ${area.key}`} type="button" key={area.key}>
              <div className="garden-card-head"><img src={area.icon} alt="" /><strong>{area.label}</strong></div>
              <div className="garden-progress" aria-label={`${area.label}: ${area.progress} of 7`}>
                {Array.from({ length: 7 }, (_, index) => <span key={index} className={index < area.progress ? 'filled' : ''} />)}
              </div>
              <span className="garden-status">{area.status}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="section closing-note closing-note-v2">
        <div className="closing-icon"><Sparkles size={20} /></div>
        <div><p className="section-kicker">Today’s reminder</p><p className="closing-quote">{closingQuote.text}</p></div>
        <img className="closing-art" src={stillAssets.cozy.tea} alt="" aria-hidden="true" />
      </section>
    </main>
  );
}
