import { useEffect } from 'react';
import { getEventOccurrences } from '../features/calendar/eventUtils';
import { useAppStore } from '../stores/useAppStore';
import { getLocalDateKey } from '../theme/stillContext';

const SENT_REMINDERS_KEY = 'still-sent-reminders-v1';
const CHECK_INTERVAL_MS = 30_000;
const DELIVERY_WINDOW_MS = 15 * 60_000;

function readSentReminders() {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(SENT_REMINDERS_KEY) ?? '[]'));
  } catch {
    return new Set<string>();
  }
}

function saveSentReminders(sent: Set<string>) {
  const currentDate = getLocalDateKey();
  localStorage.setItem(SENT_REMINDERS_KEY, JSON.stringify(
    [...sent].filter((key) => key.includes(currentDate)),
  ));
}

async function displayReminder(title: string, body: string, tag: string) {
  const options: NotificationOptions = { body, tag, data: { url: '/notifications' } };
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, options);
      return;
    } catch {
      // Fall back to a page notification where service-worker display is unavailable.
    }
  }
  new Notification(title, options);
}

export function useReminderEngine() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/reminder-sw.js');
    }
  }, []);

  useEffect(() => {
    const checkReminders = () => {
      const state = useAppStore.getState();
      if (!state.notificationsEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;

      const now = new Date();
      const today = getLocalDateKey(now);
      const sent = readSentReminders();
      const queue = (id: string, dueAt: Date, title: string, body: string, kind: 'task' | 'event' | 'check-in') => {
        const elapsed = now.getTime() - dueAt.getTime();
        if (sent.has(id) || elapsed < 0 || elapsed > DELIVERY_WINDOW_MS) return;
        sent.add(id);
        state.addNotification({ id, title, body, kind });
        void displayReminder(title, body, id);
      };

      if (state.taskReminders) {
        state.tasks.filter((task) => !task.completed && task.dueDate === today).forEach((task) => {
          queue(`task:${task.id}:${today}`, new Date(`${today}T${state.reminderTime}:00`), 'A gentle task reminder', task.title, 'task');
        });
      }

      if (state.eventReminders) {
        getEventOccurrences(state.events, today, today).filter((event) => !event.allDay && event.startTime).forEach((event) => {
          const startsAt = new Date(`${today}T${event.startTime}:00`);
          const dueAt = new Date(startsAt.getTime() - state.eventReminderMinutes * 60_000);
          queue(`event:${event.occurrenceId}:${state.eventReminderMinutes}`, dueAt, 'An event is coming up', `${event.title} starts at ${event.startTime}`, 'event');
        });
      }

      if (state.dailyCheckInReminder && state.checkInDate !== today) {
        queue(`check-in:${today}`, new Date(`${today}T${state.reminderTime}:00`), 'How are you feeling?', 'Take a quiet moment to check in with yourself.', 'check-in');
      }

      saveSentReminders(sent);
    };

    checkReminders();
    const interval = window.setInterval(checkReminders, CHECK_INTERVAL_MS);
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') checkReminders(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);
}
