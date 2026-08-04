import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Pencil,
  Plus,
  Repeat2,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAppStore, type EventCategory } from '../../stores/useAppStore';
import { getLocalDateKey } from '../../theme/stillContext';
import {
  eventTimeLabel,
  getEventOccurrences,
  getOccurrencesForDay,
} from './eventUtils';

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const categoryLabels: Record<EventCategory, string> = {
  personal: 'Personal',
  work: 'Work',
  health: 'Health',
  love: 'Love',
  money: 'Money',
};

export function CalendarPage() {
  const events = useAppStore((state) => state.events);
  const openEventEditor = useAppStore((state) => state.openEventEditor);
  const deleteEvent = useAppStore((state) => state.deleteEvent);
  const todayKey = getLocalDateKey();
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(todayKey);

  const monthDays = useMemo(() => {
    const first = startOfWeek(startOfMonth(visibleMonth));
    const last = endOfWeek(endOfMonth(visibleMonth));
    return eachDayOfInterval({ start: first, end: last });
  }, [visibleMonth]);

  const rangeStart = format(monthDays[0], 'yyyy-MM-dd');
  const rangeEnd = format(monthDays[monthDays.length - 1], 'yyyy-MM-dd');
  const occurrences = useMemo(
    () => getEventOccurrences(events, rangeStart, rangeEnd),
    [events, rangeEnd, rangeStart],
  );
  const selectedEvents = getOccurrencesForDay(occurrences, selectedDate);

  const chooseMonth = (month: Date) => {
    const start = startOfMonth(month);
    setVisibleMonth(start);
    setSelectedDate(format(start, 'yyyy-MM-dd'));
  };

  const goToToday = () => {
    const today = new Date();
    setVisibleMonth(startOfMonth(today));
    setSelectedDate(todayKey);
  };

  return (
    <main className="shell calendar-page">
      <header className="calendar-page-header">
        <div>
          <p className="section-kicker">Your time</p>
          <h1>Calendar</h1>
          <p className="subtle">A gentle view of what’s ahead.</p>
        </div>
        <button
          className="calendar-primary-button"
          onClick={() => openEventEditor(undefined, selectedDate)}
          type="button"
        >
          <Plus size={18} /> Add event
        </button>
      </header>

      <section className="card calendar-card" aria-label="Event calendar">
        <div className="calendar-toolbar">
          <div>
            <strong>{format(visibleMonth, 'MMMM yyyy')}</strong>
            <span>{events.length} {events.length === 1 ? 'event' : 'events'} saved</span>
          </div>
          <div className="calendar-toolbar-actions">
            <button onClick={() => chooseMonth(subMonths(visibleMonth, 1))} type="button" aria-label="Previous month">
              <ChevronLeft size={20} />
            </button>
            <button className="calendar-today-button" onClick={goToToday} type="button">Today</button>
            <button onClick={() => chooseMonth(addMonths(visibleMonth, 1))} type="button" aria-label="Next month">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="calendar-weekdays" aria-hidden="true">
          {weekdays.map((day) => <span key={day}>{day}</span>)}
        </div>

        <div className="calendar-grid">
          {monthDays.map((day) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const dayEvents = getOccurrencesForDay(occurrences, dayKey);
            const isToday = dayKey === todayKey;
            const isSelected = dayKey === selectedDate;

            return (
              <button
                className={`calendar-day ${isSameMonth(day, visibleMonth) ? '' : 'is-outside'} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}`}
                key={dayKey}
                onClick={() => setSelectedDate(dayKey)}
                type="button"
                aria-label={`${format(day, 'EEEE, MMMM d')}, ${dayEvents.length} ${dayEvents.length === 1 ? 'event' : 'events'}`}
              >
                <span className="calendar-day-number">{format(day, 'd')}</span>
                <span className="calendar-day-events">
                  {dayEvents.slice(0, 3).map((event) => (
                    <span className={`calendar-event-chip event-${event.category}`} key={event.occurrenceId}>
                      {event.title}
                    </span>
                  ))}
                  {dayEvents.length > 3 && <span className="calendar-more-events">+{dayEvents.length - 3} more</span>}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="calendar-agenda" aria-labelledby="selected-day-title">
        <div className="calendar-agenda-heading">
          <div>
            <p className="section-kicker">Selected day</p>
            <h2 id="selected-day-title">{format(parseISO(selectedDate), 'EEEE, MMMM d')}</h2>
          </div>
          <button className="link-btn" onClick={() => openEventEditor(undefined, selectedDate)} type="button">
            <Plus size={16} /> Add here
          </button>
        </div>

        {selectedEvents.length === 0 ? (
          <button className="calendar-empty-day" onClick={() => openEventEditor(undefined, selectedDate)} type="button">
            <CalendarDays size={28} />
            <strong>Nothing planned</strong>
            <span>Leave the day open or add something worth remembering.</span>
          </button>
        ) : (
          <div className="calendar-agenda-list">
            {selectedEvents.map((event) => {
              const isPast = event.occurrenceEndDate < todayKey;

              return (
                <article className={`card calendar-agenda-event event-${event.category} ${isPast ? 'is-past' : ''}`} key={event.occurrenceId}>
                  <span className="calendar-event-marker" />
                  <div className="calendar-agenda-copy">
                    <div className="calendar-agenda-title">
                      <strong>{event.title}</strong>
                      <span>{categoryLabels[event.category]}</span>
                    </div>
                    <div className="calendar-agenda-meta">
                      <span><Clock3 size={14} />{eventTimeLabel(event)}</span>
                      {event.repeat !== 'none' && <span><Repeat2 size={14} />{event.repeat}</span>}
                      {isPast && <span className="calendar-past-label">Past</span>}
                    </div>
                    {event.note && <p>{event.note}</p>}
                  </div>
                  <div className="calendar-event-actions">
                    <button onClick={() => openEventEditor(event.id)} type="button" aria-label={`Edit ${event.title}`}>
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete “${event.title}”?`)) deleteEvent(event.id);
                      }}
                      type="button"
                      aria-label={`Delete ${event.title}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
