import { format } from 'date-fns';
import { Bell, BriefcaseBusiness, Heart, Sparkles, WalletCards } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSecondaryQuote } from '../../content/quoteEngine';
import { saveCheckIn } from '../../data/stillDb';
import { useDailyQuote } from '../../hooks/useDailyQuote';
import { useAppStore } from '../../stores/useAppStore';
import { cloudCompanionArt } from '../../theme/companionArt';
import { stillAssets } from '../../theme/stillAssets';
import { createStillContext, getGreeting, getLocalDateKey, type WeatherKey } from '../../theme/stillContext';
import { buildStillTheme } from '../../theme/themeEngine';
import '../../theme/hero-v3.css';

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

const weatherVisuals: Partial<Record<WeatherKey, string>> = {
  'partly-sunny': stillAssets.weather.partlySunny,
  cloudy: stillAssets.weather.cloudy,
  overcast: stillAssets.weather.overcast,
  rain: stillAssets.weather.rain,
  thunderstorm: stillAssets.weather.thunderstorm,
  windy: stillAssets.weather.windy,
  fog: stillAssets.weather.fog,
  rainbow: stillAssets.weather.rainbow,
  snow: stillAssets.weather.snow,
};

type WeatherStatus =
  | 'idle'
  | 'requesting'
  | 'ready'
  | 'denied'
  | 'error';

const LOCATION_WEATHER_KEY =
  'still-location-weather-enabled-v2';

function weatherCodeToKey(code: number): WeatherKey {
  if (code <= 1) return 'partly-sunny';
  if (code === 2) return 'cloudy';
  if (code === 3) return 'overcast';

  if (code === 45 || code === 48) {
    return 'fog';
  }

  if (
    [
      51, 53, 55, 56, 57,
      61, 63, 65, 66, 67,
      80, 81, 82,
    ].includes(code)
  ) {
    return 'rain';
  }

  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return 'snow';
  }

  if ([95, 96, 99].includes(code)) {
    return 'thunderstorm';
  }

  return 'cloudy';
}

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
  const storedMood = useAppStore((state) => state.mood);
  const storedEnergy = useAppStore((state) => state.energy);
  const checkInDate = useAppStore((state) => state.checkInDate);
  const weather = useAppStore((state) => state.weather);
  const occasion = useAppStore((state) => state.occasion);
  const name = useAppStore((state) => state.name);
  const setMood = useAppStore((state) => state.setMood);
  const setEnergy = useAppStore((state) => state.setEnergy);
  const setWeather = useAppStore((state) => state.setWeather);
  const hydrateForToday = useAppStore((state) => state.hydrateForToday);
  const [done, setDone] = useState<number[]>([]);
  const [weatherStatus, setWeatherStatus] =
    useState<WeatherStatus>('idle');
  const [temperature, setTemperature] =
    useState<number | null>(null);
  const requestedLocationWeather = useRef(false);

  const now = useCurrentTime();
  const isTodaysCheckIn = checkInDate === getLocalDateKey(now);
  const mood = isTodaysCheckIn ? storedMood : undefined;
  const energy = isTodaysCheckIn ? storedEnergy : undefined;

  const selectedWeather =
    weatherOptions.find((option) => option.value === (weather ?? '')) ??
    weatherOptions[0];

  const selectedWeatherAsset = weather
    ? weatherVisuals[weather] ?? stillAssets.sky.sunCloud
    : stillAssets.sky.sunCloud;

  const refreshWeatherFromLocation = useCallback(
    (rememberPermission: boolean) => {
      if (!navigator.geolocation) {
        setWeatherStatus('error');
        return;
      }

      setWeatherStatus('requesting');

      navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
          try {
            const endpoint = new URL(
              'https://api.open-meteo.com/v1/forecast',
            );

            endpoint.searchParams.set(
              'latitude',
              String(coords.latitude),
            );

            endpoint.searchParams.set(
              'longitude',
              String(coords.longitude),
            );

            endpoint.searchParams.set(
              'current',
              'temperature_2m,weather_code',
            );

            endpoint.searchParams.set('timezone', 'auto');

            const response = await fetch(endpoint);

            if (!response.ok) {
              throw new Error(
                `Weather request failed: ${response.status}`,
              );
            }

            const result = (await response.json()) as {
              current?: {
                temperature_2m?: number;
                weather_code?: number;
              };
            };

            const current = result.current;

            if (
              typeof current?.temperature_2m !== 'number' ||
              typeof current?.weather_code !== 'number'
            ) {
              throw new Error('Current weather was unavailable.');
            }

            setTemperature(current.temperature_2m);
            setWeather(weatherCodeToKey(current.weather_code));
            setWeatherStatus('ready');

            if (rememberPermission) {
              window.localStorage.setItem(
                LOCATION_WEATHER_KEY,
                'true',
              );
            }
          } catch (error) {
            console.error(
              'Still could not load local weather:',
              error,
            );

            setWeatherStatus('error');
          }
        },
        (error) => {
          if (error.code === 1) {
            setWeatherStatus('denied');

            window.localStorage.removeItem(
              LOCATION_WEATHER_KEY,
            );

            return;
          }

          console.error(
            'Still could not access location:',
            error,
          );

          setWeatherStatus('error');
        },
        {
          enableHighAccuracy: false,
          timeout: 12_000,
          maximumAge: 30 * 60 * 1_000,
        },
      );
    },
    [setWeather],
  );

  useEffect(() => {
    // React Strict Mode replays effects in development. Avoid issuing two
    // simultaneous geolocation prompts and weather requests during that replay.
    if (requestedLocationWeather.current) return;
    requestedLocationWeather.current = true;

    const locationWeatherEnabled =
      window.localStorage.getItem(
        LOCATION_WEATHER_KEY,
      ) === 'true';

    // First visit: request permission.
    // Later visits: refresh automatically using the saved permission.
    refreshWeatherFromLocation(!locationWeatherEnabled);
  }, [refreshWeatherFromLocation]);

  const weatherHeadline =
    weatherStatus === 'ready' && temperature !== null
      ? `${selectedWeather.label} · ${Math.round(
          temperature,
        )}°C`
      : weatherStatus === 'requesting'
        ? 'Finding your weather…'
        : weatherStatus === 'denied'
          ? 'Location blocked'
          : weatherStatus === 'error'
            ? 'Tap to try again'
            : 'Use my location';

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

      <section className={`hero hero-v3 ${theme.paletteClass}`}>
        <svg className="hero-v3-leaves" viewBox="0 0 150 150" aria-hidden="true">
          <defs>
            <filter id="hero-leaf-soft">
              <feGaussianBlur stdDeviation="0.9" />
            </filter>
          </defs>
          <g filter="url(#hero-leaf-soft)">
            <path d="M154 -6 C 118 6 96 30 84 62" stroke="#dcb95c" strokeWidth="4" fill="none" strokeLinecap="round" />
            <ellipse cx="126" cy="16" rx="17" ry="8" fill="#e7c469" transform="rotate(-38 126 16)" />
            <ellipse cx="106" cy="34" rx="15" ry="7" fill="#f0d384" transform="rotate(-30 106 34)" />
            <ellipse cx="92" cy="54" rx="13" ry="6.5" fill="#e7c469" transform="rotate(-42 92 54)" />
            <ellipse cx="138" cy="40" rx="14" ry="7" fill="#f0d384" transform="rotate(-70 138 40)" />
            <ellipse cx="120" cy="62" rx="12" ry="6" fill="#e7c469" transform="rotate(-58 120 62)" />
          </g>
        </svg>
        <span className="hero-v3-leaf-drift" style={{ top: '30%', right: '16%' }} aria-hidden="true">🍂</span>
        <div className="hero-v3-copy">
          <h1>
            {getGreeting(context.timeOfDay).replace('.', '')},<br />
            {name}. <span className="hero-v3-sun" aria-hidden="true">☀️</span>
          </h1>
          <p className={`hero-v3-quote ${isLoading ? 'is-loading' : ''}`}>{quote.text}</p>
        </div>
        <img className="hero-v3-plant" src={stillAssets.plants.yellowBlossomsCreamPot} alt="" aria-hidden="true" />
        <img
          className="hero-v3-art"
          src={cloudCompanionArt}
          alt="A fluffy cloud companion enjoying a warm coffee"
        />
        <img className="hero-v3-grass" src={stillAssets.nature.flowers} alt="" aria-hidden="true" />
        <button
          className={`hero-v3-weather weather-status-${weatherStatus}`}
          type="button"
          onClick={() => refreshWeatherFromLocation(true)}
          aria-busy={weatherStatus === 'requesting'}
          aria-label="Use my location for automatic weather"
        >
          <img src={selectedWeatherAsset} alt="" aria-hidden="true" />
          <strong>{weatherHeadline}</strong>
        </button>
      </section>

      <section className="section section-v2">
        <div className="section-head compact-head">
          <div><p className="section-kicker">How are you?</p></div>
          <button className="link-btn" type="button">View history</button>
        </div>

        <article className="card checkin-combined-card surface-checkin">
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
        <article className="card focus-card surface-focus">
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

        <article className="card upcoming-card surface-upcoming">
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
              <div
                  className="garden-progress"
                  role="img"
                  aria-label={`${area.label}: ${area.progress} of 7`}
                >
                  {Array.from({ length: 7 }, (_, index) => (
                    <span
                      key={index}
                      className={
                        index < area.progress ? 'filled' : ''
                      }
                      aria-hidden="true"
                    />
                  ))}
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
