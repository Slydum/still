import type {
  HealthRoutine,
  HealthSignalPreferences,
} from '../domain/health';
import { DEFAULT_HEALTH_SIGNAL_PREFERENCES } from '../domain/health';
import type {
  MoneyAccount,
  MoneyBill,
  MoneySavingsGoal,
} from '../domain/money';
import { DEFAULT_WORK_PROFILE, type WorkProfile } from '../domain/work';

export type AccountAppearanceTone = 'lavender' | 'warm' | 'sage';

export type GeneralAccountSettings = {
  id: 'account';
  name: string;
  appearanceTone: AccountAppearanceTone;
  reduceMotion: boolean;
  taskReminders: boolean;
  eventReminders: boolean;
  dailyCheckInReminder: boolean;
  reminderTime: string;
  eventReminderMinutes: number;
  updatedAt: number;
};

export type WorkSettings = {
  id: 'work';
  workProfile: WorkProfile;
  workPrivacyBlur: boolean;
  updatedAt: number;
};

export type MoneySettings = {
  id: 'money';
  moneyAccounts: MoneyAccount[];
  moneyBills: MoneyBill[];
  moneySavingsGoals: MoneySavingsGoal[];
  moneyPrivacyHidden: boolean;
  updatedAt: number;
};

export type HealthSettings = {
  id: 'health';
  healthRoutines: HealthRoutine[];
  healthSignalPreferences: HealthSignalPreferences;
  updatedAt: number;
};

export type PermanentSettingsRecord =
  | GeneralAccountSettings
  | WorkSettings
  | MoneySettings
  | HealthSettings;

export type GranularSettingsBundle = {
  accountSettings: GeneralAccountSettings;
  workSettings: WorkSettings;
  moneySettings: MoneySettings;
  healthSettings: HealthSettings;
};

/**
 * Legacy v1 settings shape. New persistence code must use GranularSettingsBundle,
 * but this type and its helpers remain so existing local/cloud rows can migrate
 * without losing Work, Money, or Health data.
 */
export type AccountSettings = GeneralAccountSettings & {
  workProfile: WorkProfile;
  workPrivacyBlur: boolean;
  moneyAccounts?: MoneyAccount[];
  moneyBills?: MoneyBill[];
  moneySavingsGoals?: MoneySavingsGoal[];
  moneyPrivacyHidden?: boolean;
  healthRoutines?: HealthRoutine[];
  healthSignalPreferences?: HealthSignalPreferences;
};

export type AccountSettingsSource = Omit<AccountSettings, 'id' | 'updatedAt'>;
export type AccountSettingsStatePatch = AccountSettingsSource;

const GENERAL_KEYS = [
  'name',
  'appearanceTone',
  'reduceMotion',
  'taskReminders',
  'eventReminders',
  'dailyCheckInReminder',
  'reminderTime',
  'eventReminderMinutes',
] as const;

export function generalAccountSettingsFromState(
  source: Pick<AccountSettingsSource, typeof GENERAL_KEYS[number]>,
  updatedAt = Date.now(),
): GeneralAccountSettings {
  return {
    id: 'account',
    name: source.name.trim(),
    appearanceTone: source.appearanceTone,
    reduceMotion: source.reduceMotion,
    taskReminders: source.taskReminders,
    eventReminders: source.eventReminders,
    dailyCheckInReminder: source.dailyCheckInReminder,
    reminderTime: source.reminderTime,
    eventReminderMinutes: source.eventReminderMinutes,
    updatedAt,
  };
}

export function workSettingsFromState(
  source: Pick<AccountSettingsSource, 'workProfile' | 'workPrivacyBlur'>,
  updatedAt = Date.now(),
): WorkSettings {
  return {
    id: 'work',
    workProfile: source.workProfile,
    workPrivacyBlur: source.workPrivacyBlur,
    updatedAt,
  };
}

export function moneySettingsFromState(
  source: Pick<
    AccountSettingsSource,
    'moneyAccounts' | 'moneyBills' | 'moneySavingsGoals' | 'moneyPrivacyHidden'
  >,
  updatedAt = Date.now(),
): MoneySettings {
  return {
    id: 'money',
    moneyAccounts: source.moneyAccounts ?? [],
    moneyBills: source.moneyBills ?? [],
    moneySavingsGoals: source.moneySavingsGoals ?? [],
    moneyPrivacyHidden: source.moneyPrivacyHidden ?? true,
    updatedAt,
  };
}

export function healthSettingsFromState(
  source: Pick<AccountSettingsSource, 'healthRoutines' | 'healthSignalPreferences'>,
  updatedAt = Date.now(),
): HealthSettings {
  return {
    id: 'health',
    healthRoutines: source.healthRoutines ?? [],
    healthSignalPreferences: source.healthSignalPreferences ?? DEFAULT_HEALTH_SIGNAL_PREFERENCES,
    updatedAt,
  };
}

export function granularSettingsFromState(
  source: AccountSettingsSource,
  updatedAt = Date.now(),
): GranularSettingsBundle {
  return {
    accountSettings: generalAccountSettingsFromState(source, updatedAt),
    workSettings: workSettingsFromState(source, updatedAt),
    moneySettings: moneySettingsFromState(source, updatedAt),
    healthSettings: healthSettingsFromState(source, updatedAt),
  };
}

export function defaultGranularSettings(updatedAt = Date.now()): GranularSettingsBundle {
  return granularSettingsFromState({
    name: '',
    appearanceTone: 'lavender',
    reduceMotion: false,
    taskReminders: true,
    eventReminders: true,
    dailyCheckInReminder: false,
    reminderTime: '09:00',
    eventReminderMinutes: 30,
    workProfile: DEFAULT_WORK_PROFILE,
    workPrivacyBlur: true,
    moneyAccounts: [],
    moneyBills: [],
    moneySavingsGoals: [],
    moneyPrivacyHidden: true,
    healthRoutines: [],
    healthSignalPreferences: DEFAULT_HEALTH_SIGNAL_PREFERENCES,
  }, updatedAt);
}

export function accountSettingsFromState(
  source: AccountSettingsSource,
  updatedAt = Date.now(),
): AccountSettings {
  const granular = granularSettingsFromState(source, updatedAt);
  return {
    ...granular.accountSettings,
    workProfile: granular.workSettings.workProfile,
    workPrivacyBlur: granular.workSettings.workPrivacyBlur,
    moneyAccounts: granular.moneySettings.moneyAccounts,
    moneyBills: granular.moneySettings.moneyBills,
    moneySavingsGoals: granular.moneySettings.moneySavingsGoals,
    moneyPrivacyHidden: granular.moneySettings.moneyPrivacyHidden,
    healthRoutines: granular.healthSettings.healthRoutines,
    healthSignalPreferences: granular.healthSettings.healthSignalPreferences,
  };
}

export function splitLegacyAccountSettings(settings: AccountSettings): GranularSettingsBundle {
  const {
    id: _id,
    updatedAt,
    ...source
  } = settings;
  return granularSettingsFromState(source, updatedAt);
}

export function isLegacyBundledAccountSettings(
  settings: Record<string, unknown>,
): settings is AccountSettings & Record<string, unknown> {
  return 'workProfile' in settings
    || 'workPrivacyBlur' in settings
    || 'moneyAccounts' in settings
    || 'moneyBills' in settings
    || 'moneySavingsGoals' in settings
    || 'moneyPrivacyHidden' in settings
    || 'healthRoutines' in settings
    || 'healthSignalPreferences' in settings;
}

export function accountSettingsStatePatch(settings: AccountSettings): AccountSettingsStatePatch;
export function accountSettingsStatePatch(
  accountSettings: GeneralAccountSettings,
  workSettings: WorkSettings,
  moneySettings: MoneySettings,
  healthSettings: HealthSettings,
): AccountSettingsStatePatch;
export function accountSettingsStatePatch(
  accountOrLegacy: GeneralAccountSettings | AccountSettings,
  workSettings?: WorkSettings,
  moneySettings?: MoneySettings,
  healthSettings?: HealthSettings,
): AccountSettingsStatePatch {
  if (workSettings && moneySettings && healthSettings) {
    return {
      name: accountOrLegacy.name,
      appearanceTone: accountOrLegacy.appearanceTone,
      reduceMotion: accountOrLegacy.reduceMotion,
      taskReminders: accountOrLegacy.taskReminders,
      eventReminders: accountOrLegacy.eventReminders,
      dailyCheckInReminder: accountOrLegacy.dailyCheckInReminder,
      reminderTime: accountOrLegacy.reminderTime,
      eventReminderMinutes: accountOrLegacy.eventReminderMinutes,
      workProfile: workSettings.workProfile,
      workPrivacyBlur: workSettings.workPrivacyBlur,
      moneyAccounts: moneySettings.moneyAccounts,
      moneyBills: moneySettings.moneyBills,
      moneySavingsGoals: moneySettings.moneySavingsGoals,
      moneyPrivacyHidden: moneySettings.moneyPrivacyHidden,
      healthRoutines: healthSettings.healthRoutines,
      healthSignalPreferences: healthSettings.healthSignalPreferences,
    };
  }

  const legacy = accountOrLegacy as AccountSettings;
  return {
    name: legacy.name,
    appearanceTone: legacy.appearanceTone,
    reduceMotion: legacy.reduceMotion,
    taskReminders: legacy.taskReminders,
    eventReminders: legacy.eventReminders,
    dailyCheckInReminder: legacy.dailyCheckInReminder,
    reminderTime: legacy.reminderTime,
    eventReminderMinutes: legacy.eventReminderMinutes,
    workProfile: legacy.workProfile,
    workPrivacyBlur: legacy.workPrivacyBlur,
    moneyAccounts: legacy.moneyAccounts ?? [],
    moneyBills: legacy.moneyBills ?? [],
    moneySavingsGoals: legacy.moneySavingsGoals ?? [],
    moneyPrivacyHidden: legacy.moneyPrivacyHidden ?? true,
    healthRoutines: legacy.healthRoutines ?? [],
    healthSignalPreferences: legacy.healthSignalPreferences ?? DEFAULT_HEALTH_SIGNAL_PREFERENCES,
  };
}

export function displayNameFromUserMetadata(metadata: Record<string, unknown> | undefined) {
  const value = metadata?.display_name;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function shouldSeedSignupDisplayName(existingName: string | undefined, serverRevision: number | undefined) {
  if (serverRevision !== undefined) return false;
  const normalized = existingName?.trim();
  return !normalized || normalized === 'Tien';
}
