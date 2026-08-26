import { addDays, format } from 'date-fns';
import { AlertCircle, Bell, CalendarDays, ChevronRight, Search, Sparkles, SquareCheckBig, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { nextReminderOccurrence, reminderFromEntry } from '../../domain/reminders';
import { useCurrentDate } from '../../hooks/useCurrentDate';
import { useAppStore } from '../../stores/useAppStore';
import { getLocalDateKey } from '../../theme/stillContext';
import { getEventOccurrences } from '../calendar/eventUtils';
import './home-attention-dock.css';

type AttentionItem = {
  id: string;
  kind: 'overdue' | 'task' | 'event' | 'check-in' | 'reminder';
  title: string;
  detail: string;
  priority: number;
  open: () => void;
};

function taskDateLabel(dueDate: string, today: string) {
  if (dueDate === today) return 'Due today';
  const tomorrow = format(addDays(new Date(`${today}T12:00:00`), 1), 'yyyy-MM-dd');
  if (dueDate === tomorrow) return 'Due tomorrow';
  return `Due ${format(new Date(`${dueDate}T12:00:00`), 'MMM d')}`;
}

export function HomeAttentionDock() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const now = useCurrentDate();
  const tasks = useAppStore((state) => state.tasks);
  const events = useAppStore((state) => state.events);
  const journalEntries = useAppStore((state) => state.journalEntries);
  const mood = useAppStore((state) => state.mood);
  const energy = useAppStore((state) => state.energy);
  const checkInDate = useAppStore((state) => state.checkInDate);
  const openTaskEditor = useAppStore((state) => state.openTaskEditor);
  const openEventEditor = useAppStore((state) => state.openEventEditor);
  const openQuickAdd = useAppStore((state) => state.openQuickAdd);

  const today = getLocalDateKey(now);
  const tomorrow = format(addDays(new Date(`${today}T12:00:00`), 1), 'yyyy-MM-dd');

  const items = useMemo<AttentionItem[]>(() => {
    const next: AttentionItem[] = [];

    for (const task of tasks) {
      if (task.completed || !task.dueDate || task.dueDate > tomorrow) continue;
      const overdue = task.dueDate < today;
      next.push({
        id: `task:${task.id}`,
        kind: overdue ? 'overdue' : 'task',
        title: task.title,
        detail: overdue ? `Overdue · ${format(new Date(`${task.dueDate}T12:00:00`), 'MMM d')}` : taskDateLabel(task.dueDate, today),
        priority: overdue ? 0 : task.dueDate === today ? 1 : 4,
        open: () => {
          setExpanded(false);
          openTaskEditor(task.id);
        },
      });
    }

    const occurrences = getEventOccurrences(events, today, tomorrow);
    for (const occurrence of occurrences) {
      const isToday = occurrence.occurrenceStartDate === today;
      next.push({
        id: `event:${occurrence.occurrenceId}`,
        kind: 'event',
        title: occurrence.title,
        detail: isToday ? 'On your calendar today' : 'On your calendar tomorrow',
        priority: isToday ? 2 : 5,
        open: () => {
          setExpanded(false);
          openEventEditor(occurrence.id);
        },
      });
    }

    journalEntries.map(reminderFromEntry).forEach((reminder) => {
      if (!reminder?.active) return;
      const occurrence = nextReminderOccurrence(reminder, now);
      if (!occurrence) return;
      const date = getLocalDateKey(occurrence);
      if (date !== today && date !== tomorrow) return;
      next.push({
        id: `reminder:${reminder.id}:${occurrence.getTime()}`,
        kind: 'reminder',
        title: reminder.title,
        detail: `${date === today ? 'Reminder today' : 'Reminder tomorrow'} · ${occurrence.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`,
        priority: date === today ? 2.5 : 5.5,
        open: () => {
          setExpanded(false);
          navigate('/reminders');
        },
      });
    });

    if (checkInDate !== today || !mood || !energy) {
      next.push({
        id: 'check-in:today',
        kind: 'check-in',
        title: 'Check in with yourself',
        detail: 'Mood + energy are still open today',
        priority: 3,
        open: () => {
          setExpanded(false);
          openQuickAdd('check-in');
        },
      });
    }

    return next
      .sort((left, right) => left.priority - right.priority || left.title.localeCompare(right.title))
      .slice(0, 6);
  }, [checkInDate, energy, events, journalEntries, mood, navigate, now, openEventEditor, openQuickAdd, openTaskEditor, tasks, today, tomorrow]);

  if (pathname !== '/') return null;

  const first = items[0];

  return (
    <aside className={`home-attention-dock ${expanded ? 'is-expanded' : ''}`} aria-label="Still daily shortcuts">
      {expanded && (
        <div className="home-attention-panel">
          <div className="home-attention-panel-head">
            <div><small>Right now</small><strong>{items.length ? 'Needs attention' : 'Nothing urgent'}</strong></div>
            <button type="button" onClick={() => setExpanded(false)} aria-label="Close needs attention"><X size={18} /></button>
          </div>
          <div className="home-attention-list">
            {items.length === 0 ? (
              <div className="home-attention-clear"><Sparkles size={20} /><span><strong>You’re caught up.</strong><small>Still will surface something here when it needs you.</small></span></div>
            ) : items.map((item) => {
              const Icon = item.kind === 'event' ? CalendarDays : item.kind === 'reminder' ? Bell : item.kind === 'check-in' ? Sparkles : item.kind === 'overdue' ? AlertCircle : SquareCheckBig;
              return (
                <button key={item.id} className={`home-attention-row is-${item.kind}`} onClick={item.open} type="button">
                  <span className="home-attention-icon"><Icon size={17} /></span>
                  <span className="home-attention-copy"><strong>{item.title}</strong><small>{item.detail}</small></span>
                  <ChevronRight size={16} />
                </button>
              );
            })}
          </div>
          <button className="home-attention-search" onClick={() => navigate('/search')} type="button"><Search size={17} /> Search everything in Still</button>
        </div>
      )}

      <div className="home-attention-bar">
        <button className="home-attention-summary" onClick={() => setExpanded((value) => !value)} type="button" aria-expanded={expanded}>
          <span className={`home-attention-count ${items.length ? 'has-items' : ''}`}>{items.length}</span>
          <span className="home-attention-summary-copy">
            <strong>{items.length ? 'Needs attention' : 'All clear'}</strong>
            <small>{first ? `${first.title} · ${first.detail}` : 'Nothing is asking for you right now.'}</small>
          </span>
        </button>
        <button className="home-attention-search-button" onClick={() => navigate('/search')} type="button" aria-label="Search Still"><Search size={19} /></button>
      </div>
    </aside>
  );
}
