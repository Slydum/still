import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isReminderEntry,
  nextReminderOccurrence,
  reminderFromEntry,
  reminderJournalInput,
  reminderOccurrenceAtOrBefore,
  type ReminderRecord,
} from '../../src/domain/reminders.js';
import type { JournalEntry } from '../../src/stores/useAppStore.js';

function reminder(overrides: Partial<ReminderRecord> = {}): ReminderRecord {
  return {
    id: 'reminder-1',
    title: 'Call the clinic',
    remindAt: new Date('2026-08-27T09:00:00').getTime(),
    repeat: 'none',
    active: true,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe('universal reminders', () => {
  it('round-trips a reminder through the journal-backed record format', () => {
    const input = reminderJournalInput({
      title: 'Pay rent',
      note: 'Use the bank app',
      remindAt: new Date('2026-09-01T08:30:00').getTime(),
      repeat: 'monthly',
      active: true,
      target: { kind: 'bill', id: 'rent', title: 'Rent', route: '/money' },
    });
    const entry: JournalEntry = {
      id: 'entry-1',
      ...input,
      createdAt: 10,
      updatedAt: 11,
    };
    const parsed = reminderFromEntry(entry);
    assert.equal(isReminderEntry(entry), true);
    assert.equal(parsed?.title, 'Pay rent');
    assert.equal(parsed?.repeat, 'monthly');
    assert.equal(parsed?.target?.route, '/money');
  });

  it('finds the due occurrence for repeating reminders without inventing one for paused reminders', () => {
    const daily = reminder({ repeat: 'daily' });
    const now = new Date('2026-08-29T09:05:00');
    assert.equal(reminderOccurrenceAtOrBefore(daily, now)?.getDate(), 29);
    assert.equal(nextReminderOccurrence(daily, now)?.getDate(), 30);
    assert.equal(nextReminderOccurrence({ ...daily, active: false }, now), undefined);
  });

  it('does not create another occurrence for a past one-time reminder', () => {
    const oneTime = reminder();
    assert.equal(nextReminderOccurrence(oneTime, new Date('2026-08-28T09:00:00')), undefined);
  });
});
