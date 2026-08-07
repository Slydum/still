import type { WorkProfile } from '../domain/work';

export type AccountAppearanceTone = 'lavender' | 'warm' | 'sage';

export type AccountSettings = {
  id: 'account';
  name: string;
  appearanceTone: AccountAppearanceTone;
  reduceMotion: boolean;
  taskReminders: boolean;
  eventReminders: boolean;
  dailyCheckInReminder: boolean;
  reminderTime: string;
  eventReminderMinutes: number;
  workProfile: WorkProfile;
  workPrivacyBlur: boolean;
  updatedAt: number;
};

export type AccountSettingsSource = Omit<AccountSettings, 'id' | 'updatedAt'>;

export function accountSettingsFromState(source: AccountSettingsSource, updatedAt = Date.now()): AccountSettings {
  return {
    id: 'account',
    ...source,
    name: source.name.trim(),
    updatedAt,
  };
}

export function accountSettingsStatePatch(settings: AccountSettings): AccountSettingsSource {
  return {
    name: settings.name,
    appearanceTone: settings.appearanceTone,
    reduceMotion: settings.reduceMotion,
    taskReminders: settings.taskReminders,
    eventReminders: settings.eventReminders,
    dailyCheckInReminder: settings.dailyCheckInReminder,
    reminderTime: settings.reminderTime,
    eventReminderMinutes: settings.eventReminderMinutes,
    workProfile: settings.workProfile,
    workPrivacyBlur: settings.workPrivacyBlur,
  };
}

export function displayNameFromUserMetadata(metadata: Record<string, unknown> | undefined) {
  const value = metadata?.display_name;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
