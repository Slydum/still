import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEVICE_PERSISTED_STATE_KEYS,
  devicePersistedState,
} from '../../src/stores/devicePersistence.js';

describe('device persistence boundary', () => {
  it('keeps only device-scoped state in localStorage', () => {
    const persisted = devicePersistedState({
      notificationsEnabled: true,
      autoWeather: false,
      weather: 'partly-sunny',
      occasion: undefined,
    });

    assert.deepEqual(Object.keys(persisted).sort(), [...DEVICE_PERSISTED_STATE_KEYS].sort());
    assert.equal(persisted.notificationsEnabled, true);
    assert.equal(persisted.autoWeather, false);
  });

  it('does not include permanent records or synced profile data', () => {
    const durableKeys = [
      'tasks',
      'events',
      'journalEntries',
      'expenses',
      'notifications',
      'entityLinks',
      'workProfile',
      'workShifts',
      'workPrivacyBlur',
      'name',
      'mood',
      'energy',
      'checkInDate',
      'appearanceTone',
      'reduceMotion',
      'taskReminders',
      'eventReminders',
      'dailyCheckInReminder',
      'reminderTime',
      'eventReminderMinutes',
      'moneyAccounts',
      'moneyBills',
      'moneySavingsGoals',
      'healthRoutines',
      'healthSignalPreferences',
    ];

    for (const key of durableKeys) {
      assert.equal(DEVICE_PERSISTED_STATE_KEYS.includes(key as never), false);
    }
  });
});
