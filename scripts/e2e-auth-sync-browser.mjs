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
  await poll(browser, "[...document.querySelectorAll('button')].some((button) => button.textContent?.includes('Sync now'))", 'Sync now button');
  await clickText(browser, 'button', 'Sync now');
  await poll(browser, "[...document.querySelectorAll('.settings-message')].some((item) => item.textContent?.includes('Synced at'))", 'successful cloud sync');
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

async function localDataWasCleared(browser) {
  return evaluate(browser, `(async () => {
    const databases = await indexedDB.databases();
    const localKeys = ['still-app-state-v1', 'still-location-weather-enabled-v2', 'still-sent-reminders-v1', 'still-checkin-snooze-v1'];
    return !databases.some((database) => database.name === 'still-local')
      && localKeys.every((key) => localStorage.getItem(key) === null);
  })()`);
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
  await syncNow(deviceA);
  const pushedTask = await readTaskSyncState(deviceA);
  if (!pushedTask || pushedTask.dirty !== false || !(pushedTask.serverRevision > 0)) {
    throw new Error(`Task did not receive a cloud acknowledgement: ${JSON.stringify(pushedTask)}`);
  }

  await signIn(deviceB, primaryEmail, primaryPassword);
  await poll(deviceB, `Boolean(document.querySelector('.app')) && document.body.innerText.includes(${JSON.stringify(taskTitle)})`, 'task pulled onto second browser');

  await evaluate(deviceB, 'window.confirm = () => true; true');
  await clickAria(deviceB, `Delete ${taskTitle}`);
  await poll(deviceB, `!document.body.innerText.includes(${JSON.stringify(taskTitle)})`, 'task deletion on second browser');
  await syncNow(deviceB);

  await syncNow(deviceA);
  await navigate(deviceA, '/');
  await poll(deviceA, `Boolean(document.querySelector('.app')) && !document.body.innerText.includes(${JSON.stringify(taskTitle)})`, 'task deletion pulled onto first browser');

  await navigate(deviceA, '/more');
  await clickText(deviceA, 'button', 'Log out — keep local copy');
  await poll(deviceA, "Boolean(document.querySelector('input[autocomplete=current-password]'))", 'login after ordinary logout');
  await signIn(deviceA, secondEmail, secondPassword);
  await poll(deviceA, "document.body.innerText.includes('This browser already has local Still data for another account.')", 'account binding protection');
  await clickText(deviceA, 'button', 'Return to login');
  await poll(deviceA, "Boolean(document.querySelector('input[autocomplete=current-password]'))", 'login after account conflict');

  await signIn(deviceA, primaryEmail, primaryPassword);
  await poll(deviceA, "Boolean(document.querySelector('.app'))", 'original account after conflict');
  await navigate(deviceA, '/more');
  await evaluate(deviceA, "window.prompt = () => 'CLEAR'; true");
  await clickText(deviceA, 'button', 'Log out — clear local data');
  await poll(deviceA, "Boolean(document.querySelector('input[autocomplete=current-password]'))", 'login after clear-local logout');
  if (!(await localDataWasCleared(deviceA))) throw new Error('Clear-local logout left Still-managed primary data behind.');

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
  await clickText(recoveryBrowser, 'button', 'Log out — keep local copy');
  await poll(recoveryBrowser, "Boolean(document.querySelector('input[autocomplete=current-password]'))", 'login after recovered logout');
  await signIn(recoveryBrowser, primaryEmail, recoveredPassword);
  await poll(recoveryBrowser, "Boolean(document.querySelector('.app'))", 'login with recovered password');

  console.log('Disposable auth, recovery, account lifecycle, and cross-browser sync checks passed.');
} finally {
  for (const browser of browsers) {
    browser.cdp.close();
    browser.process.kill('SIGTERM');
  }
  preview.kill('SIGTERM');
}
