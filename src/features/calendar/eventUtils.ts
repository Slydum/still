import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  format,
  parseISO,
} from 'date-fns';
import type { EventRepeat, StillEvent } from '../../stores/useAppStore';

export type EventOccurrence = StillEvent & {
  occurrenceId: string;
  occurrenceStartDate: string;
  occurrenceEndDate: string;
};

function dateKey(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

function occurrenceStart(base: Date, repeat: EventRepeat, index: number) {
  if (repeat === 'daily') return addDays(base, index);
  if (repeat === 'weekly') return addWeeks(base, index);
  if (repeat === 'monthly') return addMonths(base, index);
  return base;
}

export function getEventOccurrences(
  events: StillEvent[],
  rangeStart: string,
  rangeEnd: string,
) {
  const occurrences: EventOccurrence[] = [];

  events.forEach((event) => {
    const baseStart = parseISO(event.startDate);
    const duration = Math.max(
      0,
      differenceInCalendarDays(parseISO(event.endDate), baseStart),
    );
    const maxOccurrences = event.repeat === 'none' ? 1 : 1000;

    for (let index = 0; index < maxOccurrences; index += 1) {
      const start = occurrenceStart(baseStart, event.repeat, index);
      const startKey = dateKey(start);
      if (startKey > rangeEnd) break;

      const endKey = dateKey(addDays(start, duration));
      if (endKey >= rangeStart) {
        occurrences.push({
          ...event,
          occurrenceId: `${event.id}:${startKey}`,
          occurrenceStartDate: startKey,
          occurrenceEndDate: endKey,
        });
      }

      if (event.repeat === 'none') break;
    }
  });

  return occurrences.sort((left, right) => {
    const dateDifference = left.occurrenceStartDate.localeCompare(right.occurrenceStartDate);
    if (dateDifference !== 0) return dateDifference;

    if (left.allDay !== right.allDay) return left.allDay ? -1 : 1;
    return (left.startTime ?? '').localeCompare(right.startTime ?? '');
  });
}

export function getOccurrencesForDay(
  occurrences: EventOccurrence[],
  day: string,
) {
  return occurrences.filter((event) => (
    event.occurrenceStartDate <= day && event.occurrenceEndDate >= day
  ));
}

export function eventTimeLabel(event: Pick<StillEvent, 'allDay' | 'startTime' | 'endTime'>) {
  if (event.allDay) return 'All day';

  const timeLabel = (time?: string) => time
    ? format(new Date(`2000-01-01T${time}:00`), 'h:mm a')
    : '';

  const start = timeLabel(event.startTime);
  const end = timeLabel(event.endTime);
  return end ? `${start}–${end}` : start;
}
