import { format } from 'date-fns';
import { Bell, ChevronRight, Heart, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getSecondaryQuote } from '../../content/quoteEngine';
import { saveCheckIn } from '../../data/stillDb';
import { useDailyQuote } from '../../hooks/useDailyQuote';
import { useAppStore } from '../../stores/useAppStore';
import { stillAssets } from '../../theme/stillAssets';
import {
  createStillContext,
  getGreeting,
  type WeatherKey,
} from '../../theme/stillContext';
import { buildStillTheme } from '../../theme/themeEngine';

const priorities = [
  { title: 'Finish one important work task', note: 'A small step still counts.' },
  { title: 'Walk the dogs', note: 'Fresh air for all of you.' },
  { title: 'Drink enough water', note: 'Take gentle care of your body.' },
];

const moods = [
  { asset: stillAssets.mood.sad, label: 'Low' },
  { asset: stillAssets.mood.overwhelmed, label: 'Heavy' },
  { asset: stillAssets.mood.calm, label: 'Okay' },
  { asset: stillAssets.energy.motivated, label: 'Good' },
  { asset: stillAssets.mood.loved, label: 'Lovely' },
];

const energyLevels = [
  { asset: stillAssets.energy.tired, label: 'Empty' },
  { asset: stillAssets.energy.resting, label: 'Low' },
  { asset: stillAssets.mood.calm, label: 'Steady' },
  { asset: stillAssets.energy.motivated, label: 'Bright' },
  { asset: stillAssets.energy.motivated, label: 'Full' },
];

const weatherOptions: Array<{ value: WeatherKey | ''; label: string }> = [
  { value: '', label: 'Weather not set' },
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

  useEffect(() => {
    hydrateForToday();
  }, [context.dateKey, hydrateForToday]);
  const theme = useMemo(() => buildStillTheme(context), [context]);
  const { quote, isLoading } = useDailyQuote(context);
  const closingQuote = useMemo(
    () => getSecondaryQuote(context, quote.id),
    [context, quote.id],
  );

  useEffect(() => {
    if (!mood && !energy) return;
    void saveCheckIn({
      date: context.dateKey,
      mood,
      energy,
      updatedAt: Date.now(),
    }).catch(() => undefined);
  }, [context.dateKey, mood, energy]);

  const toggle = (index: number) => {
    setDone((items) =>
      items.includes(index)
        ? items.filter((item) => item !== index)
        : [...items, index],
    );
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

      <section className={`hero ${theme.paletteClass}`}>
        <div className="hero-copy">
          <p className="eyebrow">{format(now, 'EEEE, MMMM d')}</p>
          <h1>{getGreeting(context.timeOfDay)}</h1>
          <p className="hero-subtitle">Here is the gentle shape of your day.</p>
          <p className={`quote ${isLoading ? 'is-loading' : ''}`}>“{quote.text}”</p>

          <label className="weather-picker">
            <span className="visually-hidden">Choose today’s weather</span>
            <select
              value={weather ?? ''}
              onChange={(event) => setWeather((event.target.value || undefined) as WeatherKey | undefined)}
            >
              {weatherOptions.map((option) => (
                <option key={option.value || 'none'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="hero-art">
          <img className="hero-accent-art" src={theme.accentAsset} alt="" />
          <img className="hero-plant-art" src={theme.plantAsset} alt="" />
          <img className="hero-main-art" src={theme.heroAsset} alt={theme.heroAlt} />
        </div>
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
                  key={`${item.label}-${index}`}
                  className={`emoji-btn ${mood === index + 1 ? 'active' : ''}`}
                  onClick={() => setMood(index + 1)}
                  type="button"
                  aria-label={`Mood: ${item.label}`}
                  aria-pressed={mood === index + 1}
                  title={item.label}
                >
                  <img src={item.asset} alt="" />
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
                  key={`${item.label}-${index}`}
                  className={`emoji-btn ${energy === index + 1 ? 'active' : ''}`}
                  onClick={() => setEnergy(index + 1)}
                  type="button"
                  aria-label={`Energy: ${item.label}`}
                  aria-pressed={energy === index + 1}
                  title={item.label}
                >
                  <img src={item.asset} alt="" />
                </button>
              ))}
            </div>
          </article>
        </div>

        {(mood || energy) && (
          <article className="checkin-response" aria-live="polite">
            <img src={theme.checkInAsset} alt="" />
            <p>{theme.checkInMessage}</p>
          </article>
        )}
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
          <img className="priority-pet" src={theme.priorityAsset} alt="" aria-hidden="true" />
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
            <img className="area-art-image" src={stillAssets.cozy.books} alt="" />
            <span className="area-icon">💼</span>
            <strong>Work</strong>
            <span className="subtle">Shift at 9:00 PM</span>
            <ChevronRight className="area-chevron" size={18} />
          </button>
          <button className="card area-card money" type="button">
            <img className="area-art-image" src={stillAssets.plants.succulent} alt="" />
            <span className="area-icon">🪙</span>
            <strong>Money</strong>
            <span className="subtle">Payday in 5 days</span>
            <ChevronRight className="area-chevron" size={18} />
          </button>
          <button className="card area-card health" type="button">
            <img className="area-art-image" src={stillAssets.cozy.tea} alt="" />
            <span className="area-icon">🌿</span>
            <strong>Health</strong>
            <span className="subtle">Log today’s sleep</span>
            <ChevronRight className="area-chevron" size={18} />
          </button>
          <button className="card area-card love" type="button">
            <img className="area-art-image" src={stillAssets.celebrations.valentinesLetter} alt="" />
            <span className="area-icon"><Heart size={24} fill="currentColor" /></span>
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
          <p className="closing-quote">{closingQuote.text}</p>
        </div>
        <img className="closing-art" src={stillAssets.sky.sparkles} alt="" aria-hidden="true" />
      </section>
    </main>
  );
}
