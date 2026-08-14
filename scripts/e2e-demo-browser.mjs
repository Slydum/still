import { spawn, spawnSync } from 'node:child_process';
import { rm } from 'node:fs/promises';

const appOrigin = 'http://127.0.0.1:4173';
const chromePort = 9222;
const profileDir = '/tmp/still-e2e-chrome';

function findChrome() {
  for (const candidate of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    const result = spawnSync(candidate, ['--version'], { stdio: 'ignore' });
    if (result.status === 0) return candidate;
  }
  throw new Error('A Chromium/Chrome binary is required for browser smoke tests.');
}

async function waitFor(url, attempts = 80) {
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}

function createCdp(socketUrl) {
  const socket = new WebSocket(socketUrl);
  const pending = new Map();
  let nextId = 1;
  const opened = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });

  return {
    async send(method, params = {}) {
      await opened;
      const id = nextId++;
      const response = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
      socket.send(JSON.stringify({ id, method, params }));
      return response;
    },
    close() { socket.close(); },
  };
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Browser evaluation failed.');
  return result.result.value;
}

async function poll(cdp, expression, label, attempts = 80) {
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try {
      if (await evaluate(cdp, expression)) return;
    } catch (error) {
      // Chrome can briefly expose no usable document while Page.navigate swaps
      // execution contexts. Treat that hand-off as a retry, not an app failure.
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError ?? new Error(`Timed out waiting for ${label}`);
}

await rm(profileDir, { recursive: true, force: true });
const preview = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173'], { stdio: 'inherit' });
let chrome;
let cdp;

try {
  await waitFor(appOrigin);
  chrome = spawn(findChrome(), [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    `--remote-debugging-port=${chromePort}`,
    `--user-data-dir=${profileDir}`,
    'about:blank',
  ], { stdio: 'ignore' });

  await waitFor(`http://127.0.0.1:${chromePort}/json/version`);
  const pageResponse = await fetch(`http://127.0.0.1:${chromePort}/json/new?${encodeURIComponent(`${appOrigin}/auth`)}`, { method: 'PUT' });
  if (!pageResponse.ok) throw new Error(`Could not create browser page target: ${pageResponse.status}`);
  const page = await pageResponse.json();
  cdp = createCdp(page.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await poll(cdp, "Boolean(document.querySelector('.auth-demo-entry button'))", 'demo entry button');

  const legacyCreated = await evaluate(cdp, `new Promise((resolve, reject) => {
    const remove = indexedDB.deleteDatabase('still-demo-local');
    remove.onerror = () => reject(remove.error);
    remove.onsuccess = () => {
      const request = indexedDB.open('still-demo-local', 40);
      request.onupgradeneeded = () => {
        const db = request.result;
        const stores = [
          ['dailyQuotes', 'date'], ['checkIns', 'date'], ['tasks', 'id'], ['events', 'id'],
          ['journalEntries', 'id'], ['expenses', 'id'], ['entityLinks', 'id'], ['workShifts', 'id'],
          ['repositoryMeta', 'key']
        ];
        for (const [name, keyPath] of stores) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath });
        request.transaction.objectStore('workShifts').put({
          id: 'legacy-shift', startedAt: 100, endedAt: 500, unpaidBreakMinutes: 0,
          createdAt: 100, updatedAt: 500, userId: 'local-device', schemaVersion: 1,
          syncCounter: 1, mutationId: 'legacy-shift', dirty: true
        });
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { request.result.close(); resolve(true); };
    };
  })`);
  if (!legacyCreated) throw new Error('Could not prepare legacy IndexedDB database.');

  await evaluate(cdp, "document.querySelector('.auth-demo-entry button').click(); true");
  await poll(cdp, "Boolean(document.querySelector('.app')) && !location.pathname.endsWith('/auth')", 'demo application');
  await poll(cdp, "document.querySelector('.sync-confidence-indicator')?.textContent?.includes('Saved in demo')", 'demo local save confidence');

  const databases = await evaluate(cdp, 'indexedDB.databases()');
  const demoDb = databases.find((database) => database.name === 'still-demo-local');
  if (!demoDb || demoDb.version !== 50) throw new Error(`Expected demo IndexedDB at Dexie schema v5/native v50, got ${JSON.stringify(databases)}`);

  const migrated = await evaluate(cdp, `new Promise((resolve, reject) => {
    const request = indexedDB.open('still-demo-local');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const hasSettings = db.objectStoreNames.contains('accountSettings');
      const tx = db.transaction('workShifts', 'readonly');
      const row = tx.objectStore('workShifts').get('legacy-shift');
      row.onerror = () => reject(row.error);
      row.onsuccess = () => { const kept = row.result?.id === 'legacy-shift'; db.close(); resolve({ hasSettings, kept }); };
    };
  })`);
  if (!migrated?.hasSettings || !migrated?.kept) throw new Error(`IndexedDB migration did not preserve data: ${JSON.stringify(migrated)}`);

  const legacySettingsPrepared = await evaluate(cdp, `new Promise((resolve, reject) => {
    const request = indexedDB.open('still-demo-local');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(['accountSettings', 'repositoryMeta'], 'readwrite');
      const settings = tx.objectStore('accountSettings');
      settings.clear();
      tx.objectStore('repositoryMeta').delete('permanent-data-v2');
      settings.put({
        id: 'account',
        name: 'Legacy Migrator', appearanceTone: 'sage', reduceMotion: true,
        taskReminders: false, eventReminders: true, dailyCheckInReminder: true,
        reminderTime: '08:30', eventReminderMinutes: 60,
        workProfile: {
          payType: 'hourly', currency: 'PHP', hourlyRate: 275, annualSalary: 0,
          payFrequency: 'biweekly', weeklyHours: 40, regularDays: [1,2,3,4,5],
          shiftStart: '09:00', shiftEnd: '17:00', weeklySchedule: [
            { day: 1, enabled: true, start: '09:00', end: '17:00' },
            { day: 2, enabled: true, start: '09:00', end: '17:00' },
            { day: 3, enabled: true, start: '09:00', end: '17:00' },
            { day: 4, enabled: true, start: '09:00', end: '17:00' },
            { day: 5, enabled: true, start: '09:00', end: '17:00' },
            { day: 6, enabled: false, start: '09:00', end: '17:00' },
            { day: 0, enabled: false, start: '09:00', end: '17:00' }
          ], scheduleOverrides: [], unpaidBreakMinutes: 60, overtimeAfterHours: 8,
          overtimeMultiplier: 1.5, responsibilities: [], changes: [], notes: [],
          projects: [], timeOff: [], contacts: [], ptoAllowanceHours: 0
        },
        workPrivacyBlur: false,
        moneyAccounts: [{ id: 'legacy-money', name: 'Legacy Wallet', kind: 'cash', balance: 4321, currency: 'PHP', createdAt: 10, updatedAt: 11 }],
        moneyBills: [], moneySavingsGoals: [], moneyPrivacyHidden: false,
        healthRoutines: [{ id: 'legacy-health', title: 'Legacy routine', cadence: 'daily', createdAt: 12, updatedAt: 13 }],
        healthSignalPreferences: { sleep: true, hydration: false, movement: true },
        updatedAt: 1000, userId: 'local-device', schemaVersion: 1,
        syncCounter: 4, mutationId: 'legacy-settings', dirty: true
      });
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => reject(tx.error);
    };
  })`);
  if (!legacySettingsPrepared) throw new Error('Could not prepare legacy bundled settings.');

  await cdp.send('Page.reload');
  await poll(cdp, "Boolean(document.querySelector('.app'))", 'demo application after settings migration');

  const settingsMigration = await evaluate(cdp, `new Promise((resolve, reject) => {
    const request = indexedDB.open('still-demo-local');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('accountSettings', 'readonly');
      const all = tx.objectStore('accountSettings').getAll();
      all.onerror = () => reject(all.error);
      all.onsuccess = () => {
        const rows = Object.fromEntries(all.result.map((row) => [row.id, row]));
        db.close();
        resolve({
          ids: Object.keys(rows).sort(),
          account: rows.account && {
            name: rows.account.name,
            appearanceTone: rows.account.appearanceTone,
            hasWorkProfile: Object.prototype.hasOwnProperty.call(rows.account, 'workProfile'),
            hasMoneyAccounts: Object.prototype.hasOwnProperty.call(rows.account, 'moneyAccounts'),
            hasHealthRoutines: Object.prototype.hasOwnProperty.call(rows.account, 'healthRoutines'),
          },
          work: rows.work && { hourlyRate: rows.work.workProfile?.hourlyRate, privacy: rows.work.workPrivacyBlur },
          money: rows.money && { name: rows.money.moneyAccounts?.[0]?.name, balance: rows.money.moneyAccounts?.[0]?.balance, privacy: rows.money.moneyPrivacyHidden },
          health: rows.health && { title: rows.health.healthRoutines?.[0]?.title, hydration: rows.health.healthSignalPreferences?.hydration },
        });
      };
    };
  })`);

  if (JSON.stringify(settingsMigration.ids) !== JSON.stringify(['account', 'health', 'money', 'work'])) {
    throw new Error(`Expected four granular settings rows, got ${JSON.stringify(settingsMigration)}`);
  }
  if (settingsMigration.account?.name !== 'Legacy Migrator'
    || settingsMigration.account?.appearanceTone !== 'sage'
    || settingsMigration.account?.hasWorkProfile
    || settingsMigration.account?.hasMoneyAccounts
    || settingsMigration.account?.hasHealthRoutines) {
    throw new Error(`Legacy account row was not sanitized correctly: ${JSON.stringify(settingsMigration)}`);
  }
  if (settingsMigration.work?.hourlyRate !== 275 || settingsMigration.work?.privacy !== false) {
    throw new Error(`Legacy Work settings were not preserved: ${JSON.stringify(settingsMigration)}`);
  }
  if (settingsMigration.money?.name !== 'Legacy Wallet' || settingsMigration.money?.balance !== 4321 || settingsMigration.money?.privacy !== false) {
    throw new Error(`Legacy Money settings were not preserved: ${JSON.stringify(settingsMigration)}`);
  }
  if (settingsMigration.health?.title !== 'Legacy routine' || settingsMigration.health?.hydration !== false) {
    throw new Error(`Legacy Health settings were not preserved: ${JSON.stringify(settingsMigration)}`);
  }

  const persistedState = await evaluate(cdp, `(() => {
    const raw = localStorage.getItem('still-app-state-v1');
    if (!raw) return { keys: [] };
    const state = JSON.parse(raw)?.state ?? {};
    return { keys: Object.keys(state).sort() };
  })()`);
  const allowedPersistedKeys = new Set(['autoWeather', 'notificationsEnabled', 'occasion', 'weather']);
  const unexpectedPersistedKeys = persistedState.keys.filter((key) => !allowedPersistedKeys.has(key));
  if (unexpectedPersistedKeys.length) {
    throw new Error(`Durable app data remained in localStorage after migration: ${JSON.stringify(persistedState)}`);
  }

  const primaryCounts = await evaluate(cdp, `new Promise((resolve, reject) => {
    const request = indexedDB.open('still-local');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const names = ['tasks', 'events', 'journalEntries', 'expenses', 'entityLinks', 'workShifts'];
      const existing = names.filter((name) => db.objectStoreNames.contains(name));
      if (!existing.length) { db.close(); resolve({ total: 0 }); return; }
      const tx = db.transaction(existing, 'readonly');
      Promise.all(existing.map((name) => new Promise((done, fail) => {
        const count = tx.objectStore(name).count();
        count.onsuccess = () => done(count.result);
        count.onerror = () => fail(count.error);
      }))).then((counts) => { db.close(); resolve({ total: counts.reduce((sum, value) => sum + value, 0) }); }, reject);
    };
  })`);
  if (primaryCounts.total !== 0) throw new Error(`Demo data leaked into the primary IndexedDB database: ${JSON.stringify(primaryCounts)}`);

  await cdp.send('Page.navigate', { url: `${appOrigin}/more` });
  await poll(cdp, "document.body?.innerText.includes('Demo sandbox') === true", 'demo sandbox controls');
  const body = await evaluate(cdp, 'document.body.innerText');
  if (!body.includes('Reset demo data') || !body.includes('Exit demo')) throw new Error('Demo reset/exit controls are missing.');

  await cdp.send('Page.navigate', { url: appOrigin + '/reflection' });
  await poll(
    cdp,
    "document.querySelector('.weekly-reflection-page h1')?.textContent === 'Weekly overview' && document.querySelector('#weekly-rhythm-title')?.textContent === 'Recorded activity by day'",
    'weekly overview route',
  );

  console.log('Browser demo isolation, IndexedDB migration, granular settings migration, and weekly overview route checks passed.');
} finally {
  cdp?.close();
  chrome?.kill('SIGTERM');
  preview.kill('SIGTERM');
}
