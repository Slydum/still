import { addDays, format } from 'date-fns';
import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Heart,
  HeartPulse,
  Pencil,
  Plus,
  Repeat2,
  Sparkles,
  Trash2,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSecondaryQuote } from '../../content/quoteEngine';
import { saveCheckIn } from '../../data/stillDb';
import { useDailyQuote } from '../../hooks/useDailyQuote';
import { useAppStore, type EventCategory } from '../../stores/useAppStore';
import { eventTimeLabel, getEventOccurrences } from '../calendar/eventUtils';
import {
  cloudCompanionArt,
  getCloudCompanionKey,
  loadCloudCompanionArt,
} from '../../theme/companionArt';
import { getHeroSceneKey, loadHeroSceneArt } from '../../theme/sceneArt';
import { stillAssets } from '../../theme/stillAssets';
import { createStillContext, getGreeting, getLocalDateKey, type WeatherKey } from '../../theme/stillContext';
import { buildStillTheme } from '../../theme/themeEngine';
import '../../theme/hero-v3.css';

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

const heroConditionSymbols: Record<WeatherKey, string> = {
  'partly-sunny': '🌤️',
  cloudy: '☁️',
  overcast: '☁️',
  rain: '🌧️',
  thunderstorm: '⛈️',
  windy: '🍃',
  fog: '🌫️',
  rainbow: '🌈',
  snow: '❄️',
  tornado: '🌪️',
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

const taskPriorityRank = { high: 0, medium: 1, low: 2 } as const;

const eventCategoryIcons: Record<EventCategory, LucideIcon> = {
  personal: Sparkles,
  work: BriefcaseBusiness,
  health: HeartPulse,
  love: Heart,
  money: WalletCards,
};

function taskDueLabel(dueDate: string, today: string) {
  if (dueDate === today) return 'Today';

  const tomorrow = new Date(`${today}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = [
    tomorrow.getFullYear(),
    String(tomorrow.getMonth() + 1).padStart(2, '0'),
    String(tomorrow.getDate()).padStart(2, '0'),
  ].join('-');

  if (dueDate === tomorrowKey) return 'Tomorrow';
  return format(new Date(`${dueDate}T12:00:00`), 'MMM d');
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
  const tasks = useAppStore((state) => state.tasks);
  const openTaskEditor = useAppStore((state) => state.openTaskEditor);
  const toggleTask = useAppStore((state) => state.toggleTask);
  const deleteTask = useAppStore((state) => state.deleteTask);
  const events = useAppStore((state) => state.events);
  const openEventEditor = useAppStore((state) => state.openEventEditor);
  const [weatherStatus, setWeatherStatus] =
    useState<WeatherStatus>('idle');
  const [temperature, setTemperature] =
    useState<number | null>(null);
  const requestedLocationWeather = useRef(false);

  const now = useCurrentTime();
  const todayKey = getLocalDateKey(now);
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
  const heroCompanionKey = getCloudCompanionKey(context);
  const heroSceneKey = getHeroSceneKey(context);
  const [heroCompanionArt, setHeroCompanionArt] = useState(cloudCompanionArt);
  const [heroSceneArt, setHeroSceneArt] = useState<string>();
  const heroConditionSymbol = context.weather
    ? heroConditionSymbols[context.weather]
    : context.timeOfDay === 'night'
      ? '🌙'
      : '☀️';

  useEffect(() => {
    let active = true;

    void loadCloudCompanionArt(heroCompanionKey).then((art) => {
      if (active) setHeroCompanionArt(art);
    });

    return () => {
      active = false;
    };
  }, [heroCompanionKey]);

  useEffect(() => {
    let active = true;

    void loadHeroSceneArt(heroSceneKey).then((art) => {
      if (active) setHeroSceneArt(art);
    });

    return () => {
      active = false;
    };
  }, [heroSceneKey]);

  useEffect(() => { hydrateForToday(); }, [context.dateKey, hydrateForToday]);
  const theme = useMemo(() => buildStillTheme(context), [context]);
  const { quote, isLoading } = useDailyQuote(context);
  const closingQuote = useMemo(() => getSecondaryQuote(context, quote.id), [context, quote.id]);

  const orderedTasks = useMemo(() => [...tasks].sort((left, right) => {
    if (left.completed !== right.completed) return left.completed ? 1 : -1;

    const leftDue = left.dueDate ?? '9999-12-31';
    const rightDue = right.dueDate ?? '9999-12-31';
    if (leftDue !== rightDue) return leftDue.localeCompare(rightDue);

    const priorityDifference = taskPriorityRank[left.priority] - taskPriorityRank[right.priority];
    if (priorityDifference !== 0) return priorityDifference;
    return left.createdAt - right.createdAt;
  }), [tasks]);

  const remainingTaskCount = tasks.filter((task) => !task.completed).length;

  const upcomingEvents = useMemo(() => getEventOccurrences(
    events,
    todayKey,
    format(addDays(now, 45), 'yyyy-MM-dd'),
  ).slice(0, 4), [events, now, todayKey]);

  useEffect(() => {
    if (!mood && !energy) return;
    void saveCheckIn({ date: context.dateKey, mood, energy, updatedAt: Date.now() }).catch(() => undefined);
  }, [context.dateKey, mood, energy]);

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

      <section className={`hero hero-v3 hero-scene-${heroSceneKey} ${theme.paletteClass}`}>
        {heroSceneArt && <img className="hero-v3-scene" src={heroSceneArt} alt="" aria-hidden="true" />}
        <div className="hero-v3-scrim" aria-hidden="true" />
        <div className="hero-v3-copy">
          <h1>
            <span className="hero-v3-title-line">
              {getGreeting(context.timeOfDay).replace('.', '')},
            </span>
            <span className="hero-v3-title-line">
              {name}. <span className="hero-v3-sun" aria-hidden="true">{heroConditionSymbol}</span>
            </span>
          </h1>
          <p className={`hero-v3-quote ${isLoading ? 'is-loading' : ''}`}>{quote.text}</p>
        </div>
        <img
          className={`hero-v3-art companion-${heroCompanionKey}`}
          src={heroCompanionArt}
          alt="A fluffy cloud companion matching the moment"
        />
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
          <div className="focus-task-heading">
            <div>
              <p className="section-kicker">Today’s focus</p>
              <p className="micro-copy">
                {remainingTaskCount === 0
                  ? 'Nothing waiting for you.'
                  : `${remainingTaskCount} ${remainingTaskCount === 1 ? 'task' : 'tasks'} left`}
              </p>
            </div>
            <button className="task-add-button" onClick={() => openTaskEditor()} type="button">
              <Plus size={17} /> Add task
            </button>
          </div>
          <div className="focus-list">
            {orderedTasks.length === 0 ? (
              <button className="task-empty-state" onClick={() => openTaskEditor()} type="button">
                <span>🌱</span>
                <strong>Add your first task</strong>
                <small>Start with one small, meaningful step.</small>
              </button>
            ) : orderedTasks.map((task) => {
              const overdue = Boolean(task.dueDate && task.dueDate < todayKey && !task.completed);

              return (
                <div className={`task task-record ${task.completed ? 'is-complete' : ''}`} key={task.id}>
                  <button
                    className={`checkbox ${task.completed ? 'done' : ''}`}
                    onClick={() => toggleTask(task.id)}
                    type="button"
                    aria-label={`${task.completed ? 'Mark incomplete' : 'Complete'} ${task.title}`}
                    aria-pressed={task.completed}
                  >
                    {task.completed ? '✓' : ''}
                  </button>
                  <div className="task-copy">
                    <strong>{task.title}</strong>
                    {task.note && <span className="task-note">{task.note}</span>}
                    <div className="task-meta">
                      <span className={`task-priority task-priority-${task.priority}`}>{task.priority}</span>
                      {task.dueDate && (
                        <span className={overdue ? 'task-overdue' : ''}>
                          <CalendarDays size={13} />
                          {overdue ? 'Overdue · ' : ''}{taskDueLabel(task.dueDate, todayKey)}
                        </span>
                      )}
                      {task.repeat !== 'none' && (
                        <span><Repeat2 size={13} />{task.repeat}</span>
                      )}
                    </div>
                  </div>
                  <div className="task-record-actions">
                    <button onClick={() => openTaskEditor(task.id)} type="button" aria-label={`Edit ${task.title}`}>
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete “${task.title}”?`)) deleteTask(task.id);
                      }}
                      type="button"
                      aria-label={`Delete ${task.title}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {orderedTasks.length === 0 && <img className="priority-pet focus-pet" src={theme.priorityAsset} alt="" aria-hidden="true" />}
        </article>

        <article className="card upcoming-card surface-upcoming">
          <div className="upcoming-heading">
            <p className="section-kicker">Coming up</p>
            <button className="upcoming-add-button" onClick={() => openEventEditor()} type="button">
              <Plus size={15} /> Event
            </button>
          </div>
          <div className="timeline">
            {upcomingEvents.length === 0 ? (
              <button className="upcoming-empty" onClick={() => openEventEditor()} type="button">
                <CalendarDays size={24} />
                <span><strong>Your calendar is open</strong><small>Add an event when you’re ready.</small></span>
              </button>
            ) : upcomingEvents.map((event) => {
              const EventIcon = eventCategoryIcons[event.category];
              const dateLabel = taskDueLabel(event.occurrenceStartDate, todayKey);

              return (
                <button className="timeline-item timeline-event" key={event.occurrenceId} onClick={() => openEventEditor(event.id)} type="button">
                  <span className="timeline-dot" />
                  <span className={`timeline-icon ${event.category}`}><EventIcon size={18} /></span>
                  <span className="timeline-event-copy">
                    <small>{dateLabel} · {eventTimeLabel(event)}</small>
                    <strong>{event.title}</strong>
                  </span>
                </button>
              );
            })}
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
