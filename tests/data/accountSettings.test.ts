import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_WORK_PROFILE } from '../../src/domain/work.js';
import {
  accountSettingsFromState,
  accountSettingsStatePatch,
  displayNameFromUserMetadata,
  shouldSeedSignupDisplayName,
} from '../../src/data/accountSettings.js';

describe('account settings sync model', () => {
  it('round-trips only account-wide preferences', () => {
    const settings = accountSettingsFromState({
      name: '  Alex  ',
      appearanceTone: 'sage',
      reduceMotion: true,
      taskReminders: false,
      eventReminders: true,
      dailyCheckInReminder: true,
      reminderTime: '08:30',
      eventReminderMinutes: 60,
      workProfile: DEFAULT_WORK_PROFILE,
      workPrivacyBlur: false,
    }, 123);

    assert.equal(settings.id, 'account');
    assert.equal(settings.name, 'Alex');
    assert.equal(settings.updatedAt, 123);

    const patch = accountSettingsStatePatch(settings);
    assert.equal(patch.name, 'Alex');
    assert.equal(patch.appearanceTone, 'sage');
    assert.equal(patch.reduceMotion, true);
    assert.equal(patch.reminderTime, '08:30');
    assert.equal(patch.workProfile.currency, DEFAULT_WORK_PROFILE.currency);
    assert.deepEqual(patch.moneyAccounts, []);
    assert.deepEqual(patch.moneyBills, []);
    assert.deepEqual(patch.moneySavingsGoals, []);
    assert.equal(patch.moneyPrivacyHidden, true);
    assert.equal('notificationsEnabled' in patch, false);
    assert.equal('autoWeather' in patch, false);
    assert.equal('weather' in patch, false);
  });

  it('keeps Money profile data in the synced settings record', () => {
    const settings = accountSettingsFromState({
      name: 'Alex',
      appearanceTone: 'lavender',
      reduceMotion: false,
      taskReminders: true,
      eventReminders: true,
      dailyCheckInReminder: false,
      reminderTime: '09:00',
      eventReminderMinutes: 30,
      workProfile: DEFAULT_WORK_PROFILE,
      workPrivacyBlur: true,
      moneyAccounts: [{
        id: 'account-1',
        name: 'Everyday',
        kind: 'bank',
        balance: 1200,
        currency: 'PHP',
        createdAt: 1,
        updatedAt: 1,
      }],
      moneyBills: [],
      moneySavingsGoals: [],
      moneyPrivacyHidden: false,
    }, 456);

    const patch = accountSettingsStatePatch(settings);
    assert.equal(patch.moneyAccounts?.[0]?.name, 'Everyday');
    assert.equal(patch.moneyAccounts?.[0]?.balance, 1200);
    assert.equal(patch.moneyPrivacyHidden, false);
  });

  it('uses signup display metadata only when it contains a real name', () => {
    assert.equal(displayNameFromUserMetadata({ display_name: '  Mina  ' }), 'Mina');
    assert.equal(displayNameFromUserMetadata({ display_name: '   ' }), undefined);
    assert.equal(displayNameFromUserMetadata({ display_name: 42 }), undefined);
    assert.equal(displayNameFromUserMetadata(undefined), undefined);
  });

  it('seeds only an unacknowledged blank or legacy default profile', () => {
    assert.equal(shouldSeedSignupDisplayName('', undefined), true);
    assert.equal(shouldSeedSignupDisplayName('Tien', undefined), true);
    assert.equal(shouldSeedSignupDisplayName('Alex', undefined), false);
    assert.equal(shouldSeedSignupDisplayName('Tien', 5), false);
    assert.equal(shouldSeedSignupDisplayName('', 5), false);
  });
});
