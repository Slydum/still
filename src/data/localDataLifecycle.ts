import { stillDb } from './localDb';

export const STILL_LOCAL_STORAGE_KEYS = [
  'still-app-state-v1',
  'still-location-weather-enabled-v2',
  'still-sent-reminders-v1',
  'still-checkin-snooze-v1',
] as const;

export async function clearLocalStillData() {
  // Clear lightweight device state first. If browser storage access fails, keep
  // IndexedDB intact so the signed-in account still has its durable local copy.
  for (const key of STILL_LOCAL_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }

  // Dexie.delete() leaves this instance closed by default. That prevents a
  // late repository write from silently recreating the database during logout.
  await stillDb.delete();
}
