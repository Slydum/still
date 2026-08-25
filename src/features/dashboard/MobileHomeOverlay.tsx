import { addDays, format, startOfWeek } from 'date-fns';
import {
  Bell,
  BriefcaseBusiness,
  Check,
  Clock3,
  Heart,
  HeartPulse,
  Sparkles,
  WalletCards,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { saveCheckIn } from '../../data/stillDb';
import { buildLifeGardenSummaries } from '../../domain/lifeGarden';
import type { LifeAreaId } from '../../domain/lifeAreas';
import { useAppStore, type StillTask } from '../../stores/useAppStore';
import {
  checkInEnergyOptions,
  checkInMoodOptions,
  getCheckInAnswer,
} from '../check-ins/checkInScale';
import './mobile-home-overlay.css';

const lifeAreaMeta: Array<{
  key: LifeAreaId;
  label: string;
  route: string;
  Icon: typeof BriefcaseBusiness;
}> = [
  { key: 'work', label: 'Work', route: '/life/work', Icon: BriefcaseBusiness },
  { key: 'love', label: 'Love', route: '/life/love', Icon: Heart },
  { key: 'health', label: 'Health', route: '/life/health', Icon: HeartPulse },
  { key: 'money', label: 'Money', route: '/life/money', Icon: WalletCards },
];

function taskArea(task: StillTask) {
  switch (task.areaId) {
    case 'work': return { label: 'Work', Icon: BriefcaseBusiness };
    case 'love': return { label: 'Love', Icon: Heart };
    case 'health': return { label: 'Health', Icon: HeartPulse };
    case 'money': return { label: 'Money', Icon: WalletCards };
    default: return { label: 'Personal', Icon: Sparkles };
  }
}

function taskDueLabel(task: StillTask, todayKey: string) {
  if (!task.dueDate) return 'Anytime';
  if (task.dueDate === todayKey) return 'Today';
  const tomorrowKey = format(addDays(new Date(`${todayKey}T12:00:00`), 1), 'yyyy-MM-dd');
  if (task.dueDate === tomorrowKey) return 'Tomorrow';
  if (task.dueDate < todayKey && !task.completed) return 'Overdue';
  return format(new Date(`${task.dueDate}T12:00:00`), 'MMM d');
}

export function MobileHomeOverlay() {
  const location = useLocation();
  const navigate = useNavigate();
  const tasks = useAppStore((state) => state.tasks);
  const events = useAppStore((state) => state.events);
  const journalEntries = useAppStore((state) => state.journalEntries);
  const expenses = useAppStore((state) => state.expenses);
  const workShifts = useAppStore((state) => state.workShifts);
  const storedMood = useAppStore((state) => state.mood);
  const storedEnergy = useAppStore((state) => state.energy);
  const checkInDate = useAppStore((state) => state.checkInDate);
  const notifications = useAppStore((state) => state.notifications);
  const replaceTodayCheckIn = useAppStore((state) => state.replaceTodayCheckIn);
  const toggleTask = useAppStore((state) => state.toggleTask);
  const openTaskEditor = useAppStore((state) => state.openTaskEditor);

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

  const weekDays = useMemo(() => {
    const monday = startOfWeek(now, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  }, [todayKey]);

  const orderedTasks = useMemo(() => [...tasks].sort((left, right) => {
    if (left.completed !== right.completed) return left.completed ? 1 : -1;
    const leftDue = left.dueDate ?? '9999-12-31';
    const rightDue = right.dueDate ?? '9999-12-31';
    if (leftDue !== rightDue) return leftDue.localeCompare(rightDue);
    return left.createdAt - right.createdAt;
  }), [tasks]);

  const visibleTasks = orderedTasks.slice(0, 4);
  const lifeSummaries = useMemo(() => buildLifeGardenSummaries({
    tasks,
    events,
    journalEntries,
    expenses,
    workShifts,
  }), [events, expenses, journalEntries, tasks, workShifts]);

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
    <main className="still-mobile-home" aria-label="Still home">
      <header className="still-mobile-header">
        <h1>Still</h1>
        <button
          className="still-mobile-header-action"
          onClick={() => navigate('/notifications')}
          type="button"
          aria-label="Open notifications"
        >
          <Bell size={20} />
          {hasUnreadNotifications && <span className="still-mobile-notification-dot" />}
        </button>
      </header>

      <div className="still-mobile-week" aria-label={`Week of ${format(weekDays[0], 'MMMM d')}`}>
        {weekDays.map((day) => {
          const isToday = format(day, 'yyyy-MM-dd') === todayKey;
          return (
            <div className={`still-mobile-day ${isToday ? 'is-today' : ''}`} key={day.toISOString()}>
              <span>{format(day, 'EEE')}</span>
              <strong>{format(day, 'd')}</strong>
              <i aria-hidden="true" />
            </div>
          );
        })}
      </div>

      <section className={`still-checkin-hero ${checkInOpen ? 'is-open' : ''}`}>
        {!checkInOpen ? (
          <>
            <div className="still-checkin-copy">
              <h2>{checkedInToday ? 'You checked in today.' : 'Take a moment to check in with yourself.'}</h2>
              <p>{checkedInToday && checkInAnswer ? checkInAnswer : 'A few breaths can change your whole day.'}</p>
            </div>
            <button className="still-checkin-cta" onClick={openCheckIn} type="button">
              <span>{checkedInToday ? 'Update check-in' : 'Start a check-in'}</span>
            </button>
          </>
        ) : (
          <div className="still-checkin-picker">
            <div className="still-checkin-picker-head">
              <div>
                <span>Check-in</span>
                <h2>How are you right now?</h2>
              </div>
              <button onClick={() => setCheckInOpen(false)} type="button">Cancel</button>
            </div>

            <div className="still-checkin-scale">
              <strong>Mood</strong>
              <div className="still-checkin-options">
                {checkInMoodOptions.map((item) => (
                  <button
                    className={draftMood === item.value ? 'is-selected' : ''}
                    key={item.key}
                    onClick={() => selectMood(item.value)}
                    type="button"
                    aria-label={`Mood: ${item.label}`}
                    aria-pressed={draftMood === item.value}
                  >
                    <img src={item.asset} alt="" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="still-checkin-scale">
              <strong>Energy</strong>
              <div className="still-checkin-options">
                {checkInEnergyOptions.map((item) => (
                  <button
                    className={draftEnergy === item.value ? 'is-selected' : ''}
                    key={item.key}
                    onClick={() => selectEnergy(item.value)}
                    type="button"
                    aria-label={`Energy: ${item.label}`}
                    aria-pressed={draftEnergy === item.value}
                  >
                    <img src={item.asset} alt="" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="still-mobile-section still-mobile-tasks">
        <div className="still-mobile-section-head">
          <h2>Tasks</h2>
          <button onClick={() => navigate('/tasks')} type="button">See all</button>
        </div>

        <div className="still-task-list">
          {visibleTasks.length === 0 ? (
            <button className="still-task-empty" onClick={() => openTaskEditor()} type="button">
              <span>Nothing waiting for you.</span>
              <strong>Add a task</strong>
            </button>
          ) : visibleTasks.map((task) => {
            const { label, Icon } = taskArea(task);
            return (
              <div className={`still-task-row ${task.completed ? 'is-complete' : ''}`} key={task.id}>
                <button
                  className="still-task-check"
                  onClick={() => toggleTask(task.id)}
                  type="button"
                  aria-label={`${task.completed ? 'Mark incomplete' : 'Complete'} ${task.title}`}
                  aria-pressed={task.completed}
                >
                  {task.completed && <Check size={14} />}
                </button>
                <button className="still-task-main" onClick={() => openTaskEditor(task.id)} type="button">
                  <span className={`still-task-icon area-${task.areaId ?? 'personal'}`}><Icon size={17} /></span>
                  <span className="still-task-copy">
                    <strong>{task.title}</strong>
                    <small>{label}</small>
                  </span>
                  <span className="still-task-due"><Clock3 size={12} />{taskDueLabel(task, todayKey)}</span>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="still-mobile-section still-mobile-life">
        <div className="still-mobile-section-head">
          <h2>Your life</h2>
        </div>

        <div className="still-life-grid">
          {lifeAreaMeta.map(({ key, label, route, Icon }) => {
            const summary = lifeSummaries[key];
            const openAreaTasks = tasks.filter((task) => task.areaId === key && !task.completed).length;
            const status = key === 'health'
              ? checkedInToday ? 'Checked in today' : 'Check-in due'
              : openAreaTasks > 0
                ? `${openAreaTasks} ${openAreaTasks === 1 ? 'task' : 'tasks'} open`
                : summary.recordCount > 0
                  ? summary.detail
                  : 'Nothing logged yet';

            return (
              <button className={`still-life-card area-${key}`} onClick={() => navigate(route)} type="button" key={key}>
                <span className="still-life-icon"><Icon size={18} /></span>
                <strong>{label}</strong>
                <small>{status}</small>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
