const DEMO_SESSION_KEY = 'still-demo-mode-v1';
const DEMO_STORAGE_PREFIX = 'still-demo:';

export const DEMO_DATABASE_NAME = 'still-demo-local';
export const PRIMARY_DATABASE_NAME = 'still-local';

export function demoStorageKey(name: string, demoMode: boolean) {
  return demoMode ? `${DEMO_STORAGE_PREFIX}${name}` : name;
}

export function isDemoMode() {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(DEMO_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function enableDemoMode() {
  window.sessionStorage.setItem(DEMO_SESSION_KEY, '1');
}

export function disableDemoMode() {
  window.sessionStorage.removeItem(DEMO_SESSION_KEY);
}

export function appDatabaseName() {
  return isDemoMode() ? DEMO_DATABASE_NAME : PRIMARY_DATABASE_NAME;
}

export function appStateStorage() {
  return {
    getItem(name: string) {
      return window.localStorage.getItem(demoStorageKey(name, isDemoMode()));
    },
    setItem(name: string, value: string) {
      window.localStorage.setItem(demoStorageKey(name, isDemoMode()), value);
    },
    removeItem(name: string) {
      window.localStorage.removeItem(demoStorageKey(name, isDemoMode()));
    },
  };
}
