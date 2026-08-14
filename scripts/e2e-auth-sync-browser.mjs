import { spawn, spawnSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const appOrigin = 'http://127.0.0.1:4173';
const primaryPassword = 'StillRelease9!';
const recoveredPassword = 'StillRelease9Recovered!';
const secondPassword = 'StillRelease9Second!';
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const primaryEmail = `still-release-${runId}@example.com`;
const secondEmail = `still-release-second-${runId}@example.com`;
const taskTitle = `Release sync task ${runId}`;

function parseEnvOutput(output) {
  const result = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[match[1]] = value;
  }
  return result;
}

function localSupabaseEnvironment() {
  const status = spawnSync('npx', ['-y', 'supabase@2.109.1', 'status', '-o', 'env'], { encoding: 'utf8' });
  if (status.status !== 0) throw new Error(`Could not read local Supabase status: ${status.stderr || status.stdout}`);
  const values = parseEnvOutput(status.stdout);
  const apiUrl = values.API_URL;
  const publicKey = values.ANON_KEY || values.PUBLISHABLE_KEY;
  const adminKey = values.SERVICE_ROLE_KEY || values.SECRET_KEY;
  if (!apiUrl || !publicKey || !adminKey) {
    throw new Error(`Local Supabase status is missing required API/auth values. Found: ${Object.keys(values).sort().join(', ')}`);
  }
  return { apiUrl, publicKey, adminKey };
}

function findChrome() {
  for (const candidate of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    const result = spawnSync(candidate, ['--version'], { stdio: 'ignore' });
    if (result.status === 0) return candidate;
  }
  throw new Error('A Chromium/Chrome binary is required for release acceptance tests.');
}

async function waitFor(url, attempts = 100) {
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

async function evaluate(browser, expression) {
  const result = await browser.cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Browser evaluation failed.');
  return result.result.value;
}

async function poll(browser, expression, label, attempts = 160) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      if (await evaluate(browser, expression)) return;
    } catch {
      // Navigation can briefly replace the page execution context.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function startBrowser(port, profileDir, url) {
  await rm(profileDir, { recursive: true, force: true });
  const process = spawn(findChrome(), [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    'about:blank',
  ], { stdio: 'ignore' });
  await waitFor(`http://127.0.0.1:${port}/json/version`);
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  if (!response.ok) throw new Error(`Could not create browser page target on ${port}: ${response.status}`);
  const page = await response.json();
  const cdp = createCdp(page.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  return { process, cdp };
}

async function navigate(browser, path) {
  await browser.cdp.send('Page.navigate', { url: `${appOrigin}${path}` });
}

async function clickSelector(browser, selector) {
  const clicked = await evaluate(browser, `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return false;
    element.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Could not click ${selector}`);
}

async function clickText(browser, selector, text) {
  const clicked = await evaluate(browser, `(() => {
    const element = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .find((candidate) => candidate.textContent?.replace(/\\s+/g, ' ').includes(${JSON.stringify(text)}));
    if (!element) return false;
    element.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Could not click ${text}`);
}

async function waitAndClickText(browser, selector, text) {
  await poll(
    browser,
    `[...document.querySelectorAll(${JSON.stringify(selector)})].some((candidate) => candidate.textContent?.replace(/\\s+/g, ' ').includes(${JSON.stringify(text)}))`,
    `${text} control`,
  );
  await clickText(browser, selector, text);
}

async function clickAria(browser, label) {
  const clicked = await evaluate(browser, `(() => {
    const element = [...document.querySelectorAll('button')]
      .find((candidate) => candidate.getAttribute('aria-label') === ${JSON.stringify(label)});
    if (!element) return false;
    element.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`Could not click aria-label ${label}`);
}

async function setValue(browser, selector, value, index = 0) {
  const changed = await evaluate(browser, `(() => {
    const element = document.querySelectorAll(${JSON.stringify(selector)})[${index}];
    if (!element) return false;
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (!setter) return false;
    setter.call(element, ${JSON.stringify(value)});
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  if (!changed) throw new Error(`Could not set ${selector}[${index}]`);
}

async function signUp(browser, email, password) {
  await poll(browser, "Boolean(document.querySelector('.auth-switch button'))", 'signup switch');
  await clickText(browser, '.auth-switch button', 'Create account');
  await poll(browser, "Boolean(document.querySelector('input[autocomplete=name]'))", 'signup form');
  await setValue(browser, 'input[autocomplete=name]', 'Release Tester');
  await setValue(browser, 'input[autocomplete=email]', email);
  await setValue(browser, 'input[autocomplete=new-password]', password, 0);
  await setValue(browser, 'input[autocomplete=new-password]', password, 1);
  await poll(browser, "!document.querySelector('.auth-submit')?.disabled", 'enabled signup submit');
  await clickSelector(browser, '.auth-submit');
  await poll(browser, "Boolean(document.querySelector('.app'))", 'signed-up application');
  await poll(browser, "document.querySelector('.sync-confidence-indicator')?.textContent?.includes('Saved & synced')", 'initial synced confidence');
}

async function signIn(browser, email, password) {
  await poll(browser, "Boolean(document.querySelector('input[autocomplete=email]')) && Boolean(document.querySelector('input[autocomplete=current-password]'))", 'login form');
  await setValue(browser, 'input[autocomplete=email]', email);
  await setValue(browser, 'input[autocomplete=current-password]', password);
  await poll(browser, "!document.querySelector('.auth-submit')?.disabled", 'enabled login submit');
  await clickSelector(browser, '.auth-submit');
}

async function syncNow(browser) {
  await navigate(browser, '/more');
  await waitAndClickText(browser, 'button', 'Sync now');
  await poll(browser, "[...document.querySelectorAll('.settings-message')].some((item) => item.textContent?.includes('Synced at'))", 'successful cloud sync');
  await poll(browser, "document.querySelector('.sync-confidence-indicator')?.textContent?.includes('Saved & synced')", 'synced confidence');
}

async function createTask(browser) {
  await navigate(browser, '/');
  await poll(browser, "Boolean(document.querySelector('[aria-label=\"Quick add\"]'))", 'quick add button');
  await clickSelector(browser, '[aria-label="Quick add"]');
  await poll(browser, "[...document.querySelectorAll('.quick-action-primary')].some((item) => item.textContent?.includes('Task'))", 'Task quick action');
  await clickText(browser, '.quick-action-primary', 'Task');
  await poll(browser, "Boolean(document.querySelector('input[placeholder=\"What needs your attention?\"]'))", 'task editor');
  await setValue(browser, 'input[placeholder="What needs your attention?"]', taskTitle);
  await clickText(browser, '.task-primary-button', 'Add task');
  await poll(browser, `document.body.innerText.includes(${JSON.stringify(taskTitle)})`, 'new task on dashboard');
  await poll(browser, "document.querySelector('.sync-confidence-indicator')?.textContent?.includes('Saved here · waiting')", 'waiting-to-sync confidence');
}

async function readTaskSyncState(browser) {
  return evaluate(browser, `(async () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('still-local');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('tasks')) { db.close(); resolve(null); return; }
        const tx = db.transaction('tasks', 'readonly');
        const all = tx.objectStore('tasks').getAll();
        all.onerror = () => reject(all.error);
        all.onsuccess = () => {
          const row = all.result.find((item) => item.title === ${JSON.stringify(taskTitle)});
          db.close();
          resolve(row ? { dirty: row.dirty, serverRevision: row.serverRevision, deletedAt: row.deletedAt } : null);
        };
      };
    });
  })()`);
}

async function seedGranularSettings(browser) {
  return evaluate(browser, `new Promise((resolve, reject) => {
    const request = indexedDB.open('still-local');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('accountSettings', 'readwrite');
      const store = tx.objectStore('accountSettings');
      const all = store.getAll();
      all.onerror = () => reject(all.error);
      all.onsuccess = () => {
        const rows = Object.fromEntries(all.result.map((row) => [row.id, row]));
        if (!rows.work || !rows.money || !rows.health) {
          db.close();
          reject(new Error('Granular settings placeholders were not initialized.'));
          return;
        }
        const now = Date.now();
        store.put({
          ...rows.work,
          workProfile: { ...rows.work.workProfile, hourlyRate: 321 },
          workPrivacyBlur: false,
          updatedAt: now,
          syncCounter: (rows.work.syncCounter ?? 0) + 1,
          mutationId: 'phase2-work-' + now,
          dirty: true,
        });
        store.put({
          ...rows.money,
          moneyAccounts: [{ id: 'phase2-money', name: 'Cross-device wallet', kind: 'cash', balance: 6543, currency: 'PHP', createdAt: now, updatedAt: now }],
          moneyPrivacyHidden: false,
          updatedAt: now,
          syncCounter: (rows.money.syncCounter ?? 0) + 1,
          mutationId: 'phase2-money-' + now,
          dirty: true,
        });
        store.put({
          ...rows.health,
          healthRoutines: [{ id: 'phase2-health', title: 'Cross-device routine', cadence: 'daily', createdAt: now, updatedAt: now }],
          healthSignalPreferences: { sleep: true, hydration: false, movement: true },
          updatedAt: now,
          syncCounter: (rows.health.syncCounter ?? 0) + 1,
          mutationId: 'phase2-health-' + now,
          dirty: true,
        });
      };
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => reject(tx.error);
    };
  })`);
}

async function readGranularSettings(browser) {
  return evaluate(browser, `new Promise((resolve, reject) => {
    const request = indexedDB.open('still-local');
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
          account: rows.account && { name: rows.account.name, serverRevision: rows.account.serverRevision },
          work: rows.work && { hourlyRate: rows.work.workProfile?.hourlyRate, privacy: rows.work.workPrivacyBlur, dirty: rows.work.dirty, serverRevision: rows.work.serverRevision },
          money: rows.money && { name: rows.money.moneyAccounts?.[0]?.name, balance: rows.money.moneyAccounts?.[0]?.balance, privacy: rows.money.moneyPrivacyHidden, dirty: rows.money.dirty, serverRevision: rows.money.serverRevision },
          health: rows.health && { title: rows.health.healthRoutines?.[0]?.title, hydration: rows.health.healthSignalPreferences?.hydration, dirty: rows.health.dirty, serverRevision: rows.health.serverRevision },
        });
      };
    };
  })`);
}

async function clearedLocalDataState(browser) {
  return evaluate(browser, `(async () => {
    const localKeys = ['still-app-state-v1', 'still-location-weather-enabled-v2', 'still-sent-reminders-v1', 'still-checkin-snooze-v1'];
    const storedKeys = Object.fromEntries(localKeys.map((key) => [key, localStorage.getItem(key)]));
    const databases = await indexedDB.databases();
    if (!databases.some((database) => database.name === 'still-local')) {
      return { storedKeys, totalRows: 0, rowsByStore: {}, databasePresent: false };
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open('still-local');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const names = [...db.objectStoreNames];
        if (!names.length) {
          db.close();
          resolve({ storedKeys, totalRows: 0, rowsByStore: {}, databasePresent: true });
          return;
        }
        const tx = db.transaction(names, 'readonly');
        const rowsByStore = {};
        let remaining = names.length;
        let totalRows = 0;
        for (const name of names) {
          const count = tx.objectStore(name).count();
          count.onerror = () => reject(count.error);
          count.onsuccess = () => {
            rowsByStore[name] = count.result;
            totalRows += count.result;
            remaining -= 1;
            if (remaining === 0) {
              db.close();
              resolve({ storedKeys, totalRows, rowsByStore, databasePresent: true });
            }
          };
        }
      };
    });
  })()`);
}

function isNeutralPersistedState(rawState) {
  if (rawState === null) return true;
  try {
    const state = JSON.parse(rawState)?.state ?? {};
    const keys = Object.keys(state);
    const deviceOnlyKeys = new Set(['notificationsEnabled', 'autoWeather', 'weather', 'occasion']);
    const isDeviceOnly = keys.every((key) => deviceOnlyKeys.has(key))
      && state.notificationsEnabled === false
      && state.autoWeather === true
      && state.weather === undefined
      && state.occasion === undefined;
    if (isDeviceOnly) return true;

    // Keep accepting the v1 neutral shape while the migration bridge can still
    // encounter it. Any populated durable value continues to fail this check.
    const emptyCollections = ['tasks', 'events', 'journalEntries', 'expenses', 'notifications', 'entityLinks', 'workShifts']
      .every((key) => Array.isArray(state[key]) && state[key].length === 0);
    const workProfile = state.workProfile ?? {};
    const defaultWorkProfile = workProfile.payType === 'hourly'
      && workProfile.currency === 'PHP'
      && workProfile.hourlyRate === 0
      && workProfile.annualSalary === 0
      && workProfile.weeklyHours === 40
      && workProfile.unpaidBreakMinutes === 60
      && Array.isArray(workProfile.scheduleOverrides)
      && workProfile.scheduleOverrides.length === 0;
    return emptyCollections
      && state.name === ''
      && state.mood === undefined
      && state.energy === undefined
      && state.checkInDate === undefined
      && state.weather === undefined
      && state.occasion === undefined
      && state.workPrivacyBlur === true
      && state.appearanceTone === 'lavender'
      && state.reduceMotion === false
      && state.notificationsEnabled === false
      && state.taskReminders === true
      && state.eventReminders === true
      && state.dailyCheckInReminder === false
      && state.reminderTime === '09:00'
      && state.eventReminderMinutes === 30
      && state.autoWeather === true
      && defaultWorkProfile;
  } catch {
    return false;
  }
}

const { apiUrl, publicKey, adminKey } = localSupabaseEnvironment();
const buildEnvironment = {
  ...process.env,
  VITE_SUPABASE_URL: apiUrl,
  VITE_SUPABASE_PUBLISHABLE_KEY: publicKey,
};
delete buildEnvironment.STILL_DEPLOY_TARGET;
const build = spawnSync('npm', ['run', 'build'], { env: buildEnvironment, stdio: 'inherit' });
if (build.status !== 0) throw new Error('Could not build the local-auth release candidate.');

const admin = createClient(apiUrl, adminKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const secondUser = await admin.auth.admin.createUser({
  email: secondEmail,
  password: secondPassword,
  email_confirm: true,
});
if (secondUser.error) throw secondUser.error;

const preview = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173'], { stdio: 'inherit' });
const browsers = [];

try {
  await waitFor(appOrigin);
  const deviceA = await startBrowser(9241, '/tmp/still-release-device-a', `${appOrigin}/auth`);
  const deviceB = await startBrowser(9242, '/tmp/still-release-device-b', `${appOrigin}/auth`);
  browsers.push(deviceA, deviceB);

  await signUp(deviceA, primaryEmail, primaryPassword);
  await createTask(deviceA);
  await seedGranularSettings(deviceA);
  await syncNow(deviceA);
  const pushedTask = await readTaskSyncState(deviceA);
  if (!pushedTask || pushedTask.dirty !== false || !(pushedTask.serverRevision > 0)) {
    throw new Error(`Task did not receive a cloud acknowledgement: ${JSON.stringify(pushedTask)}`);
  }
  const pushedSettings = await readGranularSettings(deviceA);
  if (pushedSettings.work?.dirty !== false || !(pushedSettings.work?.serverRevision > 0)
    || pushedSettings.money?.dirty !== false || !(pushedSettings.money?.serverRevision > 0)
    || pushedSettings.health?.dirty !== false || !(pushedSettings.health?.serverRevision > 0)) {
    throw new Error(`Granular settings did not receive cloud acknowledgements: ${JSON.stringify(pushedSettings)}`);
  }

  await signIn(deviceB, primaryEmail, primaryPassword);
  await poll(deviceB, `Boolean(document.querySelector('.app')) && document.body.innerText.includes(${JSON.stringify(taskTitle)})`, 'task pulled onto second browser');
  const pulledSettings = await readGranularSettings(deviceB);
  if (pulledSettings.account?.name !== 'Release Tester'
    || pulledSettings.work?.hourlyRate !== 321 || pulledSettings.work?.privacy !== false
    || pulledSettings.money?.name !== 'Cross-device wallet' || pulledSettings.money?.balance !== 6543 || pulledSettings.money?.privacy !== false
    || pulledSettings.health?.title !== 'Cross-device routine' || pulledSettings.health?.hydration !== false) {
    throw new Error(`Granular settings did not survive cross-device sync: ${JSON.stringify(pulledSettings)}`);
  }

  await evaluate(deviceB, 'window.confirm = () => true; true');
  await clickAria(deviceB, `Delete ${taskTitle}`);
  await poll(deviceB, `!document.body.innerText.includes(${JSON.stringify(taskTitle)})`, 'task deletion on second browser');
  await syncNow(deviceB);

  await syncNow(deviceA);
  await navigate(deviceA, '/');
  await poll(deviceA, `Boolean(document.querySelector('.app')) && !document.body.innerText.includes(${JSON.stringify(taskTitle)})`, 'task deletion pulled onto first browser');

  await navigate(deviceA, '/more');
  await waitAndClickText(deviceA, 'button', 'Log out — keep local copy');
  await poll(deviceA, "Boolean(document.querySelector('input[autocomplete=current-password]'))", 'login after ordinary logout');
  await signIn(deviceA, secondEmail, secondPassword);
  await poll(deviceA, "document.body.innerText.includes('This browser already has local Still data for another account.')", 'account binding protection');
  await waitAndClickText(deviceA, 'button', 'Return to login');
  await poll(deviceA, "Boolean(document.querySelector('input[autocomplete=current-password]'))", 'login after account conflict');

  await signIn(deviceA, primaryEmail, primaryPassword);
  await poll(deviceA, "Boolean(document.querySelector('.app'))", 'original account after conflict');
  await navigate(deviceA, '/more');
  await poll(deviceA, "[...document.querySelectorAll('button')].some((button) => button.textContent?.includes('Log out — clear local data'))", 'clear-local logout control');
  await evaluate(deviceA, "window.prompt = () => 'CLEAR'; true");
  await clickText(deviceA, 'button', 'Log out — clear local data');
  await poll(deviceA, "Boolean(document.querySelector('input[autocomplete=current-password]'))", 'login after clear-local logout');
  const clearedState = await clearedLocalDataState(deviceA);
  const lingeringDeviceKey = Object.entries(clearedState.storedKeys)
    .some(([key, value]) => key !== 'still-app-state-v1' && value !== null);
  const neutralAppState = isNeutralPersistedState(clearedState.storedKeys['still-app-state-v1']);
  if (lingeringDeviceKey || !neutralAppState || clearedState.totalRows !== 0) {
    throw new Error(`Clear-local logout left Still-managed data behind: ${JSON.stringify(clearedState)}`);
  }

  await signIn(deviceA, secondEmail, secondPassword);
  await poll(deviceA, "Boolean(document.querySelector('.app')) && !document.body.innerText.includes('another account')", 'second account after local clear');

  const recovery = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: primaryEmail,
    options: { redirectTo: `${appOrigin}/auth/recovery` },
  });
  if (recovery.error) throw recovery.error;
  const actionLink = recovery.data.properties?.action_link;
  if (!actionLink) throw new Error('Supabase did not return a recovery action link.');

  const recoveryBrowser = await startBrowser(9243, '/tmp/still-release-recovery', actionLink);
  browsers.push(recoveryBrowser);
  await poll(recoveryBrowser, "document.body.innerText.includes('Choose a new password')", 'password recovery form');
  await setValue(recoveryBrowser, 'input[autocomplete=new-password]', recoveredPassword, 0);
  await setValue(recoveryBrowser, 'input[autocomplete=new-password]', recoveredPassword, 1);
  await clickSelector(recoveryBrowser, '.auth-submit');
  await poll(recoveryBrowser, "Boolean(document.querySelector('.app'))", 'application after password recovery');

  await navigate(recoveryBrowser, '/more');
  await waitAndClickText(recoveryBrowser, 'button', 'Log out — keep local copy');
  await poll(recoveryBrowser, "Boolean(document.querySelector('input[autocomplete=current-password]'))", 'login after recovered logout');
  await signIn(recoveryBrowser, primaryEmail, recoveredPassword);
  await poll(recoveryBrowser, "Boolean(document.querySelector('.app'))", 'login with recovered password');

  console.log('Disposable auth, recovery, account lifecycle, granular settings, and cross-browser sync checks passed.');
} finally {
  for (const browser of browsers) {
    browser.cdp.close();
    browser.process.kill('SIGTERM');
  }
  preview.kill('SIGTERM');
}
