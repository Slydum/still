import { addDays, format, startOfWeek } from 'date-fns';
import {
  Bell,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  Heart,
  HeartPulse,
  Home,
  Search,
  WalletCards,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { saveCheckIn } from '../../data/stillDb';
import { useAppStore } from '../../stores/useAppStore';
import {
  checkInEnergyOptions,
  checkInMoodOptions,
  getCheckInAnswer,
} from '../check-ins/checkInScale';
import { eventTimeLabel, getEventOccurrences, getOccurrencesForDay } from '../calendar/eventUtils';
import './mobile-home-overlay.css';
import './mobile-home-editorial.css';

const lifeAreaMeta = [
  { label: 'Work', route: '/life/work', Icon: BriefcaseBusiness },
  { label: 'Love', route: '/life/love', Icon: Heart },
  { label: 'Health', route: '/life/health', Icon: HeartPulse },
  { label: 'Money', route: '/life/money', Icon: WalletCards },
] as const;

function greetingForHour(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function MobileHomeOverlay() {
  const location = useLocation();
  const navigate = useNavigate();
  const name = useAppStore((state) => state.name);
  const tasks = useAppStore((state) => state.tasks);
  const events = useAppStore((state) => state.events);
  const storedMood = useAppStore((state) => state.mood);
  const storedEnergy = useAppStore((state) => state.energy);
  const checkInDate = useAppStore((state) => state.checkInDate);
  const notifications = useAppStore((state) => state.notifications);
  const replaceTodayCheckIn = useAppStore((state) => state.replaceTodayCheckIn);
  const toggleTask = useAppStore((state) => state.toggleTask);
  const openTaskEditor = useAppStore((state) => state.openTaskEditor);
  const openEventEditor = useAppStore((state) => state.openEventEditor);
  const openJournalEditor = useAppStore((state) => state.openJournalEditor);

  const [checkInOpen, setCheckInOpen] = useState(false);
  const [draftMood, setDraftMood] = useState<number>();
  const [draftEnergy, setDraftEnergy] = useState<number>();

  const now = new Date();
  const todayKey = format(now, 'yyyy-MM-dd');
  const checkedInToday = checkInDate === todayKey && Boolean(storedMood && storedEnergy);
  const mood = checkedInToday ? storedMood : undefined;
  const energy = checkedInToday ? storedEnergy : undefined;
  const checkInAnswer = useMemo(() => getCheckInAnswer(mood, energy), [energy, mood]);
  const hasUnreadNotifications = notifications.some((notification) => !notification.read);

  const todayEvents = useMemo(
    () => getOccurrencesForDay(getEventOccurrences(events, todayKey, todayKey), todayKey).slice(0, 3),
    [events, todayKey],
  );

  const orderedTasks = useMemo(() => [...tasks].sort((left, right) => {
    if (left.completed !== right.completed) return left.completed ? 1 : -1;
    const leftDue = left.dueDate ?? '9999-12-31';
    const rightDue = right.dueDate ?? '9999-12-31';
    if (leftDue !== rightDue) return leftDue.localeCompare(rightDue);
    return left.createdAt - right.createdAt;
  }), [tasks]);

  const todayTasks = orderedTasks
    .filter((task) => !task.completed && (task.dueDate === todayKey || !task.dueDate))
    .slice(0, Math.max(1, 4 - todayEvents.length));

  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(addDays(startOfWeek(now, { weekStartsOn: 1 }), 6), 'yyyy-MM-dd');
  const weekTasks = tasks.filter((task) => task.dueDate && task.dueDate >= weekStart && task.dueDate <= weekEnd);
  const weekDone = weekTasks.filter((task) => task.completed).length;
  const weekProgress = weekTasks.length ? Math.round((weekDone / weekTasks.length) * 100) : 0;

  if (location.pathname !== '/') return null;

  const finishCheckIn = (nextMood: number, nextEnergy: number) => {
    replaceTodayCheckIn(nextMood, nextEnergy);
    setDraftMood(undefined);
    setDraftEnergy(undefined);
    setCheckInOpen(false);
    void saveCheckIn({ date: todayKey, mood: nextMood, energy: nextEnergy, updatedAt: Date.now() }).catch(() => undefined);
  };

  const selectMood = (value: number) => {
    setDraftMood(value);
    if (draftEnergy) finishCheckIn(value, draftEnergy);
  };

  const selectEnergy = (value: number) => {
    setDraftEnergy(value);
    if (draftMood) finishCheckIn(draftMood, value);
  };

  const openCheckIn = () => {
    setDraftMood(mood);
    setDraftEnergy(energy);
    setCheckInOpen(true);
  };

  return (
    <main className="still-mobile-home still-editorial-home" aria-label="Still home">
      <header className="still-editorial-header">
        <div className="still-editorial-brand">Still</div>
        <div className="still-editorial-header-actions">
          <button onClick={() => navigate('/search')} type="button" aria-label="Search Still"><Search size={19} /></button>
          <button className="still-editorial-notifications" onClick={() => navigate('/notifications')} type="button" aria-label="Open notifications">
            <Bell size={19} />
            {hasUnreadNotifications && <span />}
          </button>
        </div>
      </header>

      <section className="still-editorial-greeting">
        <h1>{greetingForHour(now.getHours())}{name ? `, ${name}` : ''}.</h1>
        <p>Let’s take it one step at a time.</p>
      </section>

      <nav className="still-editorial-life-nav" aria-label="Life areas">
        <button className="is-active" type="button" aria-current="page"><Home size={18} /><span>Home</span></button>
        {lifeAreaMeta.map(({ label, route, Icon }) => (
          <button key={route} onClick={() => navigate(route)} type="button"><Icon size={18} /><span>{label}</span></button>
        ))}
      </nav>

      <section className="still-editorial-panel still-editorial-today" aria-labelledby="still-today-title">
        <div className="still-editorial-panel-head">
          <h2 id="still-today-title">Today</h2>
          <button onClick={() => navigate('/calendar')} type="button">View calendar</button>
        </div>

        <div className="still-editorial-today-list">
          {todayEvents.map((event) => (
            <button className="still-editorial-today-row" key={event.occurrenceId} onClick={() => openEventEditor(event.id)} type="button">
              <span className="still-editorial-row-mark"><CalendarDays size={15} /></span>
              <span className="still-editorial-row-copy"><strong>{event.title}</strong><small>{event.allDay ? 'All day' : eventTimeLabel(event)}</small></span>
            </button>
          ))}

          {todayTasks.map((task) => (
            <div className="still-editorial-today-row" key={task.id}>
              <button className={`still-editorial-task-check ${task.completed ? 'is-complete' : ''}`} onClick={() => toggleTask(task.id)} type="button" aria-label={`Complete ${task.title}`} aria-pressed={task.completed}>{task.completed && <Check size={13} />}</button>
              <button className="still-editorial-row-copy" onClick={() => openTaskEditor(task.id)} type="button"><strong>{task.title}</strong><small>{task.dueDate ? 'Due today' : 'Anytime'}</small></button>
            </div>
          ))}

          {todayEvents.length === 0 && todayTasks.length === 0 && (
            <button className="still-editorial-empty-row" onClick={() => openTaskEditor()} type="button">
              <span>Your day is open.</span><strong>Add something when it matters.</strong>
            </button>
          )}
        </div>
      </section>

      <div className="still-editorial-duo">
        <button className="still-editorial-mini-card" onClick={() => openJournalEditor(undefined, todayKey)} type="button">
          <BookOpen size={18} />
          <strong>Journal</strong>
          <span>Capture your thoughts.</span>
          <b>Write</b>
        </button>
        <button className="still-editorial-mini-card" onClick={openCheckIn} type="button">
          <HeartPulse size={18} />
          <strong>Check-in</strong>
          <span>{checkedInToday ? checkInAnswer || 'Today is recorded.' : 'How are you feeling?'}</span>
          <b>{checkedInToday ? 'Update' : 'Start'}</b>
        </button>
      </div>

      {checkInOpen && (
        <section className="still-editorial-checkin" aria-label="Mood and energy check-in">
          <div className="still-editorial-checkin-head"><div><small>Check-in</small><h2>How are you right now?</h2></div><button onClick={() => setCheckInOpen(false)} type="button">Cancel</button></div>
          <div className="still-editorial-checkin-scale">
            <strong>Mood</strong>
            <div>{checkInMoodOptions.map((item) => <button className={draftMood === item.value ? 'is-selected' : ''} key={item.key} onClick={() => selectMood(item.value)} type="button" aria-label={`Mood: ${item.label}`} aria-pressed={draftMood === item.value}><img src={item.asset} alt="" /><span>{item.label}</span></button>)}</div>
          </div>
          <div className="still-editorial-checkin-scale">
            <strong>Energy</strong>
            <div>{checkInEnergyOptions.map((item) => <button className={draftEnergy === item.value ? 'is-selected' : ''} key={item.key} onClick={() => selectEnergy(item.value)} type="button" aria-label={`Energy: ${item.label}`} aria-pressed={draftEnergy === item.value}><img src={item.asset} alt="" /><span>{item.label}</span></button>)}</div>
          </div>
        </section>
      )}

      <section className="still-editorial-week" aria-labelledby="still-week-title">
        <div className="still-editorial-panel-head"><h2 id="still-week-title">This week</h2><span>{weekProgress}%</span></div>
        <p>{weekTasks.length ? `${weekDone} of ${weekTasks.length} dated tasks done` : 'Nothing scheduled into this week yet.'}</p>
        <div className="still-editorial-progress" role="progressbar" aria-label="Weekly task progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={weekProgress}><span style={{ width: `${weekProgress}%` }} /></div>
      </section>
    </main>
  );
}
