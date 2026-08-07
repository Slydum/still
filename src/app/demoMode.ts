const DEMO_SESSION_KEY = 'still-demo-mode-v1';
const APP_STATE_KEY = 'still-app-state-v1';
const DEMO_STATE_KEY = 'still-demo-app-state-v1';
const PRIMARY_BACKUP_KEY = 'still-demo-primary-backup-v1';
const PRIMARY_EMPTY_SENTINEL = '__STILL_EMPTY_PRIMARY__';

export const DEMO_DATABASE_NAME = 'still-demo-local';
export const PRIMARY_DATABASE_NAME = 'still-local';

export function databaseNameForMode(demoMode: boolean) {
  return demoMode ? DEMO_DATABASE_NAME : PRIMARY_DATABASE_NAME;
}

export function isDemoMode() {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(DEMO_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function beginDemoSession() {
  const storage = window.localStorage;
  if (storage.getItem(PRIMARY_BACKUP_KEY) === null) {
    const primary = storage.getItem(APP_STATE_KEY);
    storage.setItem(PRIMARY_BACKUP_KEY, primary ?? PRIMARY_EMPTY_SENTINEL);
  }

  const demo = storage.getItem(DEMO_STATE_KEY);
  if (demo === null) storage.removeItem(APP_STATE_KEY);
  else storage.setItem(APP_STATE_KEY, demo);
  window.sessionStorage.setItem(DEMO_SESSION_KEY, '1');
}

export function endDemoSession() {
  const storage = window.localStorage;
  const demo = storage.getItem(APP_STATE_KEY);
  if (demo === null) storage.removeItem(DEMO_STATE_KEY);
  else storage.setItem(DEMO_STATE_KEY, demo);

  const primary = storage.getItem(PRIMARY_BACKUP_KEY);
  if (primary === null || primary === PRIMARY_EMPTY_SENTINEL) storage.removeItem(APP_STATE_KEY);
  else storage.setItem(APP_STATE_KEY, primary);
  storage.removeItem(PRIMARY_BACKUP_KEY);
  window.sessionStorage.removeItem(DEMO_SESSION_KEY);
}

export function clearDemoAppState() {
  const storage = window.localStorage;
  storage.removeItem(APP_STATE_KEY);
  storage.removeItem(DEMO_STATE_KEY);
}

export function appDatabaseName() {
  return databaseNameForMode(isDemoMode());
}

export const demoModeStorageKeys = {
  session: DEMO_SESSION_KEY,
  appState: APP_STATE_KEY,
  demoState: DEMO_STATE_KEY,
  primaryBackup: PRIMARY_BACKUP_KEY,
};
