import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_WORK_PROFILE } from '../../src/domain/work.js';
import {
  accountSettingsFromState,
  accountSettingsStatePatch,
  displayNameFromUserMetadata,
  granularSettingsFromState,
  splitLegacyAccountSettings,
  shouldSeedSignupDisplayName,
} from '../../src/data/accountSettings.js';

const baseSource = {
  name: '  Alex  ',
  appearanceTone: 'sage' as const,
  reduceMotion: true,
  taskReminders: false,
  eventReminders: true,
  dailyCheckInReminder: true,
  reminderTime: '08:30',
  eventReminderMinutes: 60,
  workProfile: DEFAULT_WORK_PROFILE,
  workPrivacyBlur: false,
  moneyAccounts: [{
    id: 'account-1',
    name: 'Everyday',
    kind: 'bank' as const,
    balance: 1200,
    currency: 'PHP',
    createdAt: 1,
    updatedAt: 1,
  }],
  moneyBills: [],
  moneySavingsGoals: [],
  moneyPrivacyHidden: false,
  healthRoutines: [{
    id: 'routine-1',
    title: 'Take medication',
    cadence: 'daily' as const,
    note: 'With breakfast',
    lastCompletedDate: '2026-08-09',
    createdAt: 1,
    updatedAt: 2,
  }],
  healthSignalPreferences: {
    sleep: true,
    hydration: true,
    movement: false,
  },
};

describe('account settings sync model', () => {
  it('stores account, Work, Money, and Health as independent records', () => {
    const settings = granularSettingsFromState(baseSource, 123);

    assert.equal(settings.accountSettings.id, 'account');
    assert.equal(settings.accountSettings.name, 'Alex');
    assert.equal(settings.accountSettings.updatedAt, 123);
    assert.equal('workProfile' in settings.accountSettings, false);
    assert.equal('moneyAccounts' in settings.accountSettings, false);
    assert.equal('healthRoutines' in settings.accountSettings, false);

    assert.equal(settings.workSettings.id, 'work');
    assert.equal(settings.workSettings.workProfile.currency, DEFAULT_WORK_PROFILE.currency);
    assert.equal(settings.workSettings.workPrivacyBlur, false);

    assert.equal(settings.moneySettings.id, 'money');
    assert.equal(settings.moneySettings.moneyAccounts[0]?.name, 'Everyday');
    assert.equal(settings.moneySettings.moneyPrivacyHidden, false);

    assert.equal(settings.healthSettings.id, 'health');
    assert.equal(settings.healthSettings.healthRoutines[0]?.title, 'Take medication');
    assert.equal(settings.healthSettings.healthSignalPreferences.hydration, true);
  });

  it('rebuilds the application settings state from granular records', () => {
    const settings = granularSettingsFromState(baseSource, 456);
    const patch = accountSettingsStatePatch(
      settings.accountSettings,
      settings.workSettings,
      settings.moneySettings,
      settings.healthSettings,
    );

    assert.equal(patch.name, 'Alex');
    assert.equal(patch.appearanceTone, 'sage');
    assert.equal(patch.reduceMotion, true);
    assert.equal(patch.reminderTime, '08:30');
    assert.equal(patch.workProfile.currency, DEFAULT_WORK_PROFILE.currency);
    assert.equal(patch.moneyAccounts?.[0]?.balance, 1200);
    assert.equal(patch.moneyPrivacyHidden, false);
    assert.equal(patch.healthRoutines?.[0]?.lastCompletedDate, '2026-08-09');
    assert.equal(patch.healthSignalPreferences?.hydration, true);
    assert.equal('notificationsEnabled' in patch, false);
    assert.equal('autoWeather' in patch, false);
    assert.equal('weather' in patch, false);
  });

  it('splits an existing v1 bundled settings row without losing domain data', () => {
    const legacy = accountSettingsFromState(baseSource, 789);
    const split = splitLegacyAccountSettings(legacy);

    assert.equal(split.accountSettings.updatedAt, 789);
    assert.equal(split.accountSettings.name, 'Alex');
    assert.equal(split.workSettings.workPrivacyBlur, false);
    assert.equal(split.moneySettings.moneyAccounts[0]?.balance, 1200);
    assert.equal(split.healthSettings.healthRoutines[0]?.note, 'With breakfast');

    const rebuilt = accountSettingsStatePatch(
      split.accountSettings,
      split.workSettings,
      split.moneySettings,
      split.healthSettings,
    );
    assert.equal(rebuilt.moneyAccounts?.[0]?.name, 'Everyday');
    assert.equal(rebuilt.healthSignalPreferences?.movement, false);
  });

  it('keeps the legacy bundled helper readable during the migration window', () => {
    const legacy = accountSettingsFromState(baseSource, 900);
    const patch = accountSettingsStatePatch(legacy);

    assert.equal(legacy.workProfile.currency, DEFAULT_WORK_PROFILE.currency);
    assert.equal(legacy.moneyAccounts?.[0]?.name, 'Everyday');
    assert.equal(legacy.healthRoutines?.[0]?.title, 'Take medication');
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
