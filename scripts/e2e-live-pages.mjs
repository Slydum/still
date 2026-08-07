import { spawn, spawnSync } from 'node:child_process';
import { rm } from 'node:fs/promises';

const liveUrl = new URL(process.env.STILL_LIVE_URL || 'https://slydum.github.io/still/');
if (!liveUrl.pathname.endsWith('/')) liveUrl.pathname += '/';

const chromePort = 9235;
const profileDir = '/tmp/still-live-smoke-chrome';

function findChrome() {
  for (const candidate of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    const result = spawnSync(candidate, ['--version'], { stdio: 'ignore' });
    if (result.status === 0) return candidate;
  }
  throw new Error('A Chromium/Chrome binary is required for the live release smoke test.');
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

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Browser evaluation failed.');
  return result.result.value;
}

async function poll(cdp, expression, label, attempts = 120) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      if (await evaluate(cdp, expression)) return;
    } catch {
      // Navigation can briefly replace the execution context.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

const rootResponse = await fetch(liveUrl);
if (!rootResponse.ok) throw new Error(`Live app returned ${rootResponse.status} at ${liveUrl}`);
const rootHtml = await rootResponse.text();
if (!rootHtml.includes('id="root"')) throw new Error('Live app shell is missing the React root element.');

const manifestUrl = new URL('manifest.webmanifest', liveUrl);
const manifestResponse = await fetch(manifestUrl);
if (!manifestResponse.ok) throw new Error(`Live manifest returned ${manifestResponse.status}.`);
const manifest = await manifestResponse.json();
if (manifest.start_url !== '.' || manifest.scope !== './') {
  throw new Error(`Live manifest is not base-relative: ${JSON.stringify({ start_url: manifest.start_url, scope: manifest.scope })}`);
}

await rm(profileDir, { recursive: true, force: true });
let chrome;
let cdp;

try {
  chrome = spawn(findChrome(), [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    `--remote-debugging-port=${chromePort}`,
    `--user-data-dir=${profileDir}`,
    'about:blank',
  ], { stdio: 'ignore' });

  await waitFor(`http://127.0.0.1:${chromePort}/json/version`);
  const authUrl = new URL('auth', liveUrl).toString();
  const pageResponse = await fetch(`http://127.0.0.1:${chromePort}/json/new?${encodeURIComponent(authUrl)}`, { method: 'PUT' });
  if (!pageResponse.ok) throw new Error(`Could not create live browser target: ${pageResponse.status}`);
  const page = await pageResponse.json();
  cdp = createCdp(page.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');

  await poll(cdp, "Boolean(document.querySelector('.auth-demo-entry button'))", 'live demo entry button');
  await evaluate(cdp, "document.querySelector('.auth-demo-entry button').click(); true");
  await poll(cdp, "Boolean(document.querySelector('.app')) && !location.pathname.endsWith('/auth')", 'live demo application');

  const readyScope = await evaluate(cdp, 'navigator.serviceWorker.ready.then((registration) => registration.scope)');
  if (readyScope !== liveUrl.toString()) {
    throw new Error(`Service worker scope mismatch. Expected ${liveUrl}, got ${readyScope}`);
  }

  // An active registration can become ready slightly before Chrome attaches it as
  // the controller for the current document. A real scoped navigation gives the
  // active worker the next document instead of racing that controller handoff.
  const moreUrl = new URL('more', liveUrl).toString();
  await cdp.send('Page.navigate', { url: moreUrl });
  await poll(
    cdp,
    "document.body.innerText.includes('Demo sandbox') && document.body.innerText.includes('Reset demo data') && Boolean(navigator.serviceWorker.controller)",
    'controlled direct live /more route',
  );

  const reflectionUrl = new URL('reflection', liveUrl).toString();
  await cdp.send('Page.navigate', { url: reflectionUrl });
  await poll(
    cdp,
    "document.querySelector('.weekly-reflection-page h1')?.textContent === 'Weekly reflection' && document.querySelector('#weekly-rhythm-title')?.textContent === 'Recorded activity by day' && Boolean(navigator.serviceWorker.controller)",
    'controlled direct live /reflection route',
  );

  await cdp.send('Page.navigate', { url: liveUrl.toString() });
  await poll(cdp, "Boolean(document.querySelector('.app')) && Boolean(navigator.serviceWorker.controller)", 'controlled live app before offline reload');

  await cdp.send('Network.emulateNetworkConditions', {
    offline: true,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await cdp.send('Page.reload').catch(() => undefined);
  await poll(cdp, "Boolean(document.querySelector('.app')) && Boolean(navigator.serviceWorker.controller)", 'offline service-worker app shell');

  console.log(`Live release smoke checks passed for ${liveUrl}`);
} finally {
  if (cdp) {
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    }).catch(() => undefined);
    cdp.close();
  }
  chrome?.kill('SIGTERM');
}
