(() => {
  const sessionKey = 'still-demo-mode-v1';
  const appStateKey = 'still-app-state-v1';
  const demoStateKey = 'still-demo-app-state-v1';
  const backupKey = 'still-demo-primary-backup-v1';

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === '1') {
      if (localStorage.getItem(backupKey) === null) {
        const primary = localStorage.getItem(appStateKey);
        if (primary !== null) localStorage.setItem(backupKey, primary);
      }
      const demo = localStorage.getItem(demoStateKey);
      if (demo === null) localStorage.removeItem(appStateKey);
      else localStorage.setItem(appStateKey, demo);
      sessionStorage.setItem(sessionKey, '1');
      return;
    }

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
