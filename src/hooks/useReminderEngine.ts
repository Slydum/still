import { useEffect } from 'react';
import { toAppPath } from '../app/appLocation';
import { getEventOccurrences } from '../features/calendar/eventUtils';
import {
  clearCheckInSnooze,
  getCheckInReminderCopy,
  getCheckInSnooze,
} from '../features/check-ins/checkInReminder';
import { useAppStore } from '../stores/useAppStore';
import { getLocalDateKey } from '../theme/stillContext';

const SENT_REMINDERS_KEY = 'still-sent-reminders-v1';
const CHECK_INTERVAL_MS = 30_000;
const DELIVERY_WINDOW_MS = 15 * 60_000;
const SNOOZE_DELIVERY_WINDOW_MS = 60 * 60_000;

type ReminderKind = 'task' | 'event' | 'check-in';
type ActionableNotificationOptions = NotificationOptions & {
  actions?: Array<{ action: string; title: string }>;
};

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

async function displayReminder(title: string, body: string, tag: string, kind: ReminderKind) {
  const isCheckIn = kind === 'check-in';
  const options: ActionableNotificationOptions = {
    body,
    tag,
    data: {
      kind,
      url: isCheckIn ? '/?checkin=now' : '/notifications',
    },
  };

  if (isCheckIn) {
    options.actions = [
      { action: 'check-in-now', title: 'Check in now' },
      { action: 'snooze-check-in', title: 'Remind me later' },
    ];
  }

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

async function dismissCheckInNotifications() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const notifications = await registration.getNotifications();
    notifications.forEach((notification) => {
      if (notification.data?.kind === 'check-in' || notification.tag.startsWith('check-in:')) {
        notification.close();
      }
    });
  } catch {
    // Dismissing a stale browser notification is best-effort only.
  }
}

export function useReminderEngine() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register(toAppPath('/reminder-sw.js'));
    }
  }, []);

  useEffect(() => {
    const checkReminders = () => {
      const state = useAppStore.getState();
      if (!state.notificationsEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;

      const now = new Date();
      const today = getLocalDateKey(now);
      const sent = readSentReminders();
      const queue = (
        id: string,
        dueAt: Date,
        title: string,
        body: string,
        kind: ReminderKind,
        deliveryWindowMs = DELIVERY_WINDOW_MS,
      ) => {
        const elapsed = now.getTime() - dueAt.getTime();
        if (sent.has(id) || elapsed < 0 || elapsed > deliveryWindowMs) return;
        sent.add(id);
        state.addNotification({ id, title, body, kind });
        void displayReminder(title, body, id, kind);
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

      if (state.checkInDate === today) {
        clearCheckInSnooze();
        void dismissCheckInNotifications();
      } else if (state.dailyCheckInReminder) {
        const snoozedUntil = getCheckInSnooze(today);
        const dueAt = snoozedUntil
          ? new Date(snoozedUntil)
          : new Date(`${today}T${state.reminderTime}:00`);
        const id = snoozedUntil
          ? `check-in:${today}:snooze:${snoozedUntil}`
          : `check-in:${today}`;
        const copy = getCheckInReminderCopy(today);

        queue(
          id,
          dueAt,
          copy.title,
          copy.body,
          'check-in',
          snoozedUntil ? SNOOZE_DELIVERY_WINDOW_MS : DELIVERY_WINDOW_MS,
        );
      }

      saveSentReminders(sent);
    };

    checkReminders();
    const interval = window.setInterval(checkReminders, CHECK_INTERVAL_MS);
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') checkReminders(); };
    const unsubscribe = useAppStore.subscribe((state, previousState) => {
      const today = getLocalDateKey();
      if (state.checkInDate === today && previousState.checkInDate !== today) {
        clearCheckInSnooze();
        void dismissCheckInNotifications();
      }
    });

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);
}
