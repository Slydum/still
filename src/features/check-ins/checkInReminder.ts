const CHECK_IN_SNOOZE_KEY = 'still-checkin-snooze-v1';
export const CHECK_IN_SNOOZE_MINUTES = 30;

type CheckInSnooze = {
  date: string;
  dueAt: number;
};

const reminderCopy = [
  {
    title: 'How are you, really?',
    body: 'Take a quiet moment to notice what you need.',
  },
  {
    title: 'A quiet moment for yourself.',
    body: 'Your check-in is here whenever you’re ready.',
  },
  {
    title: 'You don’t need the perfect words.',
    body: 'Choose what feels closest and let Still meet you there.',
  },
];

function readSnooze(): CheckInSnooze | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(CHECK_IN_SNOOZE_KEY) ?? 'null') as CheckInSnooze | null;
    if (!value || typeof value.date !== 'string' || typeof value.dueAt !== 'number') return undefined;
    return value;
  } catch {
    return undefined;
  }
}

export function getCheckInSnooze(date: string) {
  const snooze = readSnooze();
  if (!snooze) return undefined;

  if (snooze.date !== date) {
    clearCheckInSnooze();
    return undefined;
  }

  return snooze.dueAt;
}

export function snoozeCheckIn(date: string, now = Date.now()) {
  const dueAt = now + CHECK_IN_SNOOZE_MINUTES * 60_000;
  localStorage.setItem(CHECK_IN_SNOOZE_KEY, JSON.stringify({ date, dueAt } satisfies CheckInSnooze));
  return dueAt;
}

export function clearCheckInSnooze() {
  localStorage.removeItem(CHECK_IN_SNOOZE_KEY);
}

export function getCheckInReminderCopy(date: string) {
  const daySeed = Number(date.replaceAll('-', '')) || 0;
  return reminderCopy[daySeed % reminderCopy.length];
}
