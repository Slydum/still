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
  for (let index = 0; index < attempts; index += 1) {
    if (await evaluate(cdp, expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${label}`);
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
  await poll(cdp, "document.body.innerText.includes('Demo sandbox')", 'demo sandbox controls');
  const body = await evaluate(cdp, 'document.body.innerText');
  if (!body.includes('Reset demo data') || !body.includes('Exit demo')) throw new Error('Demo reset/exit controls are missing.');

  await cdp.send('Page.navigate', { url: appOrigin + '/reflection' });
  await poll(
    cdp,
    "document.querySelector('.weekly-reflection-page h1')?.textContent === 'Weekly overview' && document.querySelector('#weekly-rhythm-title')?.textContent === 'Recorded activity by day'",
    'weekly overview route',
  );

  console.log('Browser demo isolation, IndexedDB migration, and weekly overview route checks passed.');
} finally {
  cdp?.close();
  chrome?.kill('SIGTERM');
  preview.kill('SIGTERM');
}
