import type { JournalEntry, JournalInput } from '../stores/useAppStore';
import { getLocalDateKey } from '../theme/stillContext';

export const REMINDER_TAG = 'still-reminder';

export type ReminderRepeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export type ReminderTarget = {
  kind: string;
  id: string;
  title: string;
  route: string;
};

export type ReminderDraft = {
  title: string;
  note?: string;
  remindAt: number;
  repeat: ReminderRepeat;
  active: boolean;
  target?: ReminderTarget;
};

export type ReminderRecord = ReminderDraft & {
  id: string;
  createdAt: number;
  updatedAt: number;
};

type ReminderPayload = {
  v: 1;
  note?: string;
  remindAt: number;
  repeat: ReminderRepeat;
  active: boolean;
  target?: ReminderTarget;
};

export function isReminderEntry(entry: Pick<JournalEntry, 'tags'>) {
  return entry.tags.includes(REMINDER_TAG);
}

export function reminderFromEntry(entry: JournalEntry): ReminderRecord | undefined {
  if (!isReminderEntry(entry)) return undefined;
  try {
    const payload = JSON.parse(entry.body) as Partial<ReminderPayload>;
    if (payload.v !== 1 || typeof payload.remindAt !== 'number') return undefined;
    const repeat: ReminderRepeat = ['none', 'daily', 'weekly', 'monthly', 'yearly'].includes(String(payload.repeat))
      ? payload.repeat as ReminderRepeat
      : 'none';
    return {
      id: entry.id,
      title: entry.title?.trim() || 'Reminder',
      note: typeof payload.note === 'string' ? payload.note : undefined,
      remindAt: payload.remindAt,
      repeat,
      active: payload.active !== false,
      target: payload.target && typeof payload.target.id === 'string' && typeof payload.target.route === 'string'
        ? payload.target as ReminderTarget
        : undefined,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  } catch {
    return undefined;
  }
}

export function reminderJournalInput(draft: ReminderDraft): JournalInput {
  const payload: ReminderPayload = {
    v: 1,
    note: draft.note?.trim() || undefined,
    remindAt: draft.remindAt,
    repeat: draft.repeat,
    active: draft.active,
    target: draft.target,
  };
  return {
    title: draft.title.trim(),
    body: JSON.stringify(payload),
    entryDate: getLocalDateKey(new Date(draft.remindAt)),
    tags: [REMINDER_TAG],
  };
}

function addOccurrence(origin: Date, repeat: Exclude<ReminderRepeat, 'none'>, count = 1) {
  const next = new Date(origin);
  if (repeat === 'daily') next.setDate(next.getDate() + count);
  if (repeat === 'weekly') next.setDate(next.getDate() + 7 * count);
  if (repeat === 'monthly') next.setMonth(next.getMonth() + count);
  if (repeat === 'yearly') next.setFullYear(next.getFullYear() + count);
  return next;
}

export function reminderOccurrenceAtOrBefore(reminder: ReminderRecord, now = new Date()) {
  const origin = new Date(reminder.remindAt);
  if (!reminder.active || origin.getTime() > now.getTime()) return undefined;
  if (reminder.repeat === 'none') return origin;

  if (reminder.repeat === 'daily' || reminder.repeat === 'weekly') {
    const interval = reminder.repeat === 'daily' ? 86_400_000 : 7 * 86_400_000;
    const count = Math.max(0, Math.floor((now.getTime() - origin.getTime()) / interval));
    return addOccurrence(origin, reminder.repeat, count);
  }

  let occurrence = origin;
  for (let index = 0; index < 240; index += 1) {
    const next = addOccurrence(occurrence, reminder.repeat, 1);
    if (next.getTime() > now.getTime()) return occurrence;
    occurrence = next;
  }
  return occurrence;
}

export function nextReminderOccurrence(reminder: ReminderRecord, now = new Date()) {
  if (!reminder.active) return undefined;
  const origin = new Date(reminder.remindAt);
  if (origin.getTime() >= now.getTime()) return origin;
  if (reminder.repeat === 'none') return undefined;

  const previous = reminderOccurrenceAtOrBefore(reminder, now) ?? origin;
  return addOccurrence(previous, reminder.repeat, 1);
}

export function reminderRepeatLabel(repeat: ReminderRepeat) {
  if (repeat === 'none') return 'Once';
  return `${repeat[0].toUpperCase()}${repeat.slice(1)}`;
}
