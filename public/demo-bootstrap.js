(() => {
  const sessionKey = 'still-demo-mode-v1';
  const appStateKey = 'still-app-state-v1';
  const demoStateKey = 'still-demo-app-state-v1';
  const backupKey = 'still-demo-primary-backup-v1';

  try {
    const demoActive = sessionStorage.getItem(sessionKey) === '1';
    const primaryBackup = localStorage.getItem(backupKey);
    if (demoActive || primaryBackup === null) return;

    const lastDemoState = localStorage.getItem(appStateKey);
    if (lastDemoState === null) localStorage.removeItem(demoStateKey);
    else localStorage.setItem(demoStateKey, lastDemoState);

    localStorage.setItem(appStateKey, primaryBackup);
    localStorage.removeItem(backupKey);
  } catch {
    // Storage access can be unavailable in hardened/private browsing contexts.
  }
})();
