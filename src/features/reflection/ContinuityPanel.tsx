import { addDays, format, parseISO, subDays } from 'date-fns';
import { CalendarDays, CheckSquare, Clock3, HeartPulse, Link2, NotebookPen, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import type { CheckInRecord } from '../../data/stillDb';
import { isAttachmentEntry } from '../../domain/attachments';
import { goalConnections, goalFromEntry, isGoalEntry, type GoalRecord } from '../../domain/goals';
import type { LifeEntityRef } from '../../domain/lifeAreas';
import { isReminderEntry } from '../../domain/reminders';
import { getWeekWindow } from '../../domain/weeklyReflection';
import { useAppStore } from '../../stores/useAppStore';
import { getLocalDateKey } from '../../theme/stillContext';
import { getEventOccurrences } from '../calendar/eventUtils';
import './continuity-panel.css';

type WindowMetric = { label: string; current: number; previous: number; icon: React.ReactNode };

function dayKey(timestamp: number) {
  const date = new Date(timestamp);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function inWindow(date: string | undefined, start: string, end: string) {
  return Boolean(date && date >= start && date <= end);
}

function comparison(current: number, previous: number) {
  const delta = current - previous;
  if (delta === 0) return 'same as prior 30 days';
  return `${delta > 0 ? '+' : ''}${delta} vs prior 30 days`;
}

export function ContinuityPanel({ anchorDate, checkIns }: { anchorDate: string; checkIns: CheckInRecord[] }) {
  const tasks = useAppStore((state) => state.tasks);
  const events = useAppStore((state) => state.events);
  const journalEntries = useAppStore((state) => state.journalEntries);
  const expenses = useAppStore((state) => state.expenses);
  const workShifts = useAppStore((state) => state.workShifts);
  const entityLinks = useAppStore((state) => state.entityLinks);

  const windows = useMemo(() => {
    const week = getWeekWindow(anchorDate);
    const today = getLocalDateKey();
    const end = week.endDate > today ? today : week.endDate;
    const endDate = parseISO(end);
    const start = format(subDays(endDate, 29), 'yyyy-MM-dd');
    const previousEnd = format(subDays(parseISO(start), 1), 'yyyy-MM-dd');
    const previousStart = format(subDays(parseISO(previousEnd), 29), 'yyyy-MM-dd');
    return { start, end, previousStart, previousEnd, week };
  }, [anchorDate]);

  const eventOccurrences = useMemo(() => getEventOccurrences(events, windows.previousStart, windows.end), [events, windows.end, windows.previousStart]);
  const reflections = useMemo(() => journalEntries.filter((entry) =>
    !isGoalEntry(entry) && !isReminderEntry(entry) && !isAttachmentEntry(entry)), [journalEntries]);

  const metrics = useMemo<WindowMetric[]>(() => {
    const completedDates = tasks.filter((task) => task.completedAt).map((task) => dayKey(task.completedAt!));
    const eventDates = eventOccurrences.map((event) => event.occurrenceStartDate);
    const reflectionDates = reflections.map((entry) => entry.entryDate);
    const checkInDates = checkIns.map((record) => record.date);
    const activityDates = (start: string, end: string) => new Set([
      ...completedDates.filter((date) => inWindow(date, start, end)),
      ...eventDates.filter((date) => inWindow(date, start, end)),
      ...reflectionDates.filter((date) => inWindow(date, start, end)),
      ...checkInDates.filter((date) => inWindow(date, start, end)),
      ...expenses.map((expense) => expense.expenseDate).filter((date) => inWindow(date, start, end)),
      ...workShifts.map((shift) => dayKey(shift.startedAt)).filter((date) => inWindow(date, start, end)),
    ]).size;
    const count = (dates: string[], start: string, end: string) => dates.filter((date) => inWindow(date, start, end)).length;

    return [
      { label: 'tasks completed', current: count(completedDates, windows.start, windows.end), previous: count(completedDates, windows.previousStart, windows.previousEnd), icon: <CheckSquare size={18} /> },
      { label: 'calendar events', current: count(eventDates, windows.start, windows.end), previous: count(eventDates, windows.previousStart, windows.previousEnd), icon: <CalendarDays size={18} /> },
      { label: 'reflections', current: count(reflectionDates, windows.start, windows.end), previous: count(reflectionDates, windows.previousStart, windows.previousEnd), icon: <NotebookPen size={18} /> },
      { label: 'check-ins', current: count(checkInDates, windows.start, windows.end), previous: count(checkInDates, windows.previousStart, windows.previousEnd), icon: <HeartPulse size={18} /> },
      { label: 'active days', current: activityDates(windows.start, windows.end), previous: activityDates(windows.previousStart, windows.previousEnd), icon: <Clock3 size={18} /> },
    ];
  }, [checkIns, eventOccurrences, expenses, reflections, tasks, windows.end, windows.previousEnd, windows.previousStart, windows.start, workShifts]);

  const goalActivity = useMemo(() => {
    const goals = journalEntries.map(goalFromEntry).filter((goal): goal is GoalRecord => Boolean(goal && !goal.completed));
    const recordDate = (ref: LifeEntityRef) => {
      if (ref.kind === 'task') {
        const task = tasks.find((item) => item.id === ref.id);
        return task?.completedAt ? dayKey(task.completedAt) : undefined;
      }
      if (ref.kind === 'event') return events.find((item) => item.id === ref.id)?.startDate;
      if (ref.kind === 'journal') return reflections.find((item) => item.id === ref.id)?.entryDate;
      if (ref.kind === 'transaction') return expenses.find((item) => item.id === ref.id)?.expenseDate;
      if (ref.kind === 'shift') {
        const shift = workShifts.find((item) => item.id === ref.id);
        return shift ? dayKey(shift.startedAt) : undefined;
      }
      return undefined;
    };

    return goals.map((goal) => {
      const connections = goalConnections(goal.id, entityLinks);
      const weekCount = connections.filter((connection) => inWindow(recordDate(connection.ref), windows.week.startDate, windows.week.endDate)).length;
      return { goal, total: connections.length, weekCount };
    }).filter((item) => item.weekCount > 0 || item.total > 0).sort((a, b) => b.weekCount - a.weekCount || b.total - a.total).slice(0, 5);
  }, [entityLinks, events, expenses, journalEntries, reflections, tasks, windows.week.endDate, windows.week.startDate, workShifts]);

  return (
    <>
      <section className="card continuity-window" aria-labelledby="continuity-window-title">
        <div className="weekly-section-heading"><div><p className="section-kicker">Longer view</p><h2 id="continuity-window-title">30-day context</h2></div><span>{format(parseISO(windows.start), 'MMM d')}–{format(parseISO(windows.end), 'MMM d')}</span></div>
        <p className="continuity-intro">A rolling comparison with the 30 days before it. These are counts from your records, not a score for whether you are doing life correctly.</p>
        <div className="continuity-metrics">
          {metrics.map((metric) => <article key={metric.label}><span>{metric.icon}</span><strong>{metric.current}</strong><small>{metric.label}</small><b>{comparison(metric.current, metric.previous)}</b></article>)}
        </div>
      </section>

      {goalActivity.length > 0 && <section className="card continuity-goals" aria-labelledby="continuity-goals-title">
        <div className="weekly-section-heading"><div><p className="section-kicker">Goals</p><h2 id="continuity-goals-title">What connected to the bigger picture</h2></div><Link2 size={18} /></div>
        <div className="continuity-goal-list">{goalActivity.map(({ goal, weekCount, total }) => <div key={goal.id}><span><Sparkles size={16} /></span><div><strong>{goal.title}</strong><small>{weekCount ? `${weekCount} connected ${weekCount === 1 ? 'record' : 'records'} this week` : 'No dated contribution this week'}</small></div><b>{total} total</b></div>)}</div>
        <p className="weekly-footnote">A connection appears here only when a linked record has a date Still can verify.</p>
      </section>}
    </>
  );
}
