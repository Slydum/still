import { stillDb } from './localDb';

export const STILL_LOCAL_STORAGE_KEYS = [
  'still-app-state-v1',
  'still-location-weather-enabled-v2',
  'still-sent-reminders-v1',
  'still-checkin-snooze-v1',
] as const;

export async function clearLocalStillData() {
  await stillDb.delete();

  for (const key of STILL_LOCAL_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }
}
