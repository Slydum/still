import { spawn, spawnSync } from 'node:child_process';
import { rm } from 'node:fs/promises';

const origin = 'http://127.0.0.1:4174';
const chromePort = 9224;
const profileDir = '/tmp/still-release-qa-chrome';

function findChrome() {
  for (const candidate of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    if (spawnSync(candidate, ['--version'], { stdio: 'ignore' }).status === 0) return candidate;
  }
  throw new Error('A Chromium/Chrome binary is required for release QA.');
}

async function waitFor(url, attempts = 80) {
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch (error) { lastError = error; }
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
      const result = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
      socket.send(JSON.stringify({ id, method, params }));
      return result;
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
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function navigate(cdp, path) {
  await cdp.send('Page.navigate', { url: `${origin}${path}` });
  await poll(cdp, "document.readyState === 'complete' && Boolean(document.querySelector('main'))", path);
}

const routes = [
  '/', '/tasks', '/calendar', '/journal', '/check-ins', '/reflection',
  '/life/work', '/life/money', '/life/love', '/life/health', '/work', '/money', '/notifications', '/more',
];
const viewports = [
  { width: 320, height: 720, label: 'small phone' },
  { width: 390, height: 844, label: 'phone' },
  { width: 768, height: 1024, label: 'tablet' },
  { width: 1280, height: 900, label: 'desktop' },
];

await rm(profileDir, { recursive: true, force: true });
const preview = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4174'], { stdio: 'inherit' });
let chrome;
let cdp;

try {
  await waitFor(origin);
  chrome = spawn(findChrome(), [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    `--remote-debugging-port=${chromePort}`, `--user-data-dir=${profileDir}`, 'about:blank',
  ], { stdio: 'ignore' });
  await waitFor(`http://127.0.0.1:${chromePort}/json/version`);
  const pageResponse = await fetch(`http://127.0.0.1:${chromePort}/json/new?${encodeURIComponent(`${origin}/auth`)}`, { method: 'PUT' });
  if (!pageResponse.ok) throw new Error(`Could not create browser target: ${pageResponse.status}`);
  const page = await pageResponse.json();
  cdp = createCdp(page.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await poll(cdp, "Boolean(document.querySelector('.auth-demo-entry button'))", 'demo entry');
  await evaluate(cdp, "document.querySelector('.auth-demo-entry button').click(); true");
  await poll(cdp, "Boolean(document.querySelector('.app')) && !location.pathname.endsWith('/auth')", 'demo app');

  for (const viewport of viewports) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.width < 768,
    });
    for (const route of routes) {
      await navigate(cdp, route);
      const state = await evaluate(cdp, `({
        path: location.pathname,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        mainVisible: (() => { const el = document.querySelector('main'); if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; })(),
        h1Count: document.querySelectorAll('main h1').length,
        versionText: document.body.innerText.includes('Version 0.3.0')
      })`);
      if (!state.mainVisible) throw new Error(`${viewport.label} ${route}: main content is not visible.`);
      if (state.overflow > 2) throw new Error(`${viewport.label} ${route}: horizontal overflow of ${state.overflow}px.`);
      if (route !== '/' && state.h1Count < 1) throw new Error(`${viewport.label} ${route}: missing page heading.`);
      if (route === '/more' && !state.versionText) throw new Error('Settings does not report Version 0.3.0.');
    }
  }

  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate(cdp, '/tasks');
  const opened = await evaluate(cdp, `(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.includes('Add task'));
    if (!button) return false;
    button.click(); return true;
  })()`);
  if (!opened) throw new Error('Tasks Add task action is unavailable.');
  await poll(cdp, "Boolean(document.querySelector('[role=dialog][aria-modal=true]'))", 'task dialog');
  const focusInside = await evaluate(cdp, "document.querySelector('[role=dialog]')?.contains(document.activeElement) === true");
  if (!focusInside) throw new Error('Task dialog did not place keyboard focus inside the modal.');
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
  await poll(cdp, "!document.querySelector('[role=dialog][aria-modal=true]')", 'task dialog close');

  console.log('v0.3 release QA passed: responsive routes, headings, version identity, and modal keyboard behavior.');
} finally {
  cdp?.close();
  chrome?.kill('SIGTERM');
  preview.kill('SIGTERM');
}
