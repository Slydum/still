import { mkdir, rm, writeFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';

const liveUrl = new URL(process.env.STILL_LIVE_URL || 'https://slydum.github.io/still/');
if (!liveUrl.pathname.endsWith('/')) liveUrl.pathname += '/';
const chromePort = 9237;
const profileDir = '/tmp/still-live-visual-chrome';
const artifactDir = 'artifacts/live-visual';

function findChrome() {
  for (const candidate of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    const result = spawnSync(candidate, ['--version'], { stdio: 'ignore' });
    if (result.status === 0) return candidate;
  }
  throw new Error('A Chromium/Chrome binary is required for live visual QA.');
}

async function waitFor(url, attempts = 100) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
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
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function capture(cdp, name) {
  const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await writeFile(`${artifactDir}/${name}.png`, Buffer.from(screenshot.data, 'base64'));
}

await rm(profileDir, { recursive: true, force: true });
await mkdir(artifactDir, { recursive: true });
let chrome;
let cdp;

try {
  chrome = spawn(findChrome(), [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    `--remote-debugging-port=${chromePort}`,
    `--user-data-dir=${profileDir}`,
    'about:blank',
  ], { stdio: 'ignore' });
  await waitFor(`http://127.0.0.1:${chromePort}/json/version`);
  const authUrl = new URL('auth', liveUrl).toString();
  const pageResponse = await fetch(`http://127.0.0.1:${chromePort}/json/new?${encodeURIComponent(authUrl)}`, { method: 'PUT' });
  if (!pageResponse.ok) throw new Error(`Could not create browser target: ${pageResponse.status}`);
  const page = await pageResponse.json();
  cdp = createCdp(page.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
    screenWidth: 390, screenHeight: 844,
  });

  await poll(cdp, "Boolean(document.querySelector('.auth-demo-entry button'))", 'demo entry');
  await evaluate(cdp, "document.querySelector('.auth-demo-entry button').click(); true");
  await poll(cdp, "Boolean(document.querySelector('.dashboard-v2'))", 'Home dashboard');
  await new Promise((resolve) => setTimeout(resolve, 800));

  const alignment = await evaluate(cdp, `(() => {
    const task = document.querySelector('.task-empty-state strong')?.getBoundingClientRect();
    const calendar = document.querySelector('.upcoming-empty strong')?.getBoundingClientRect();
    if (!task || !calendar) return null;
    return { taskLeft: task.left, calendarLeft: calendar.left, delta: Math.abs(task.left - calendar.left) };
  })()`);
  if (!alignment) throw new Error('Could not find both empty Today rows on the deployed Home screen.');
  if (alignment.delta > 2) {
    throw new Error(`Today empty rows are misaligned by ${alignment.delta.toFixed(1)}px (${alignment.taskLeft.toFixed(1)} vs ${alignment.calendarLeft.toFixed(1)}).`);
  }
  await capture(cdp, 'home-mobile');

  const workUrl = new URL('work', liveUrl).toString();
  await evaluate(cdp, `window.history.pushState({}, '', ${JSON.stringify(workUrl)}); window.dispatchEvent(new PopStateEvent('popstate')); true`);
  await poll(cdp, "Boolean(document.querySelector('.still-work-page'))", 'Work page');
  await new Promise((resolve) => setTimeout(resolve, 600));
  const workMetrics = await evaluate(cdp, `(() => {
    const page = document.querySelector('.still-work-page');
    const live = document.querySelector('.still-work-live');
    const summary = document.querySelector('.still-work-summary');
    const pulse = [...document.querySelectorAll('.still-work-section h2')].find((node) => node.textContent?.includes('Your work at a glance'));
    const settings = document.querySelector('#work-settings details');
    if (!page || !live || !summary || !pulse || !settings) return null;
    return {
      width: page.getBoundingClientRect().width,
      summaryCards: summary.children.length,
      settingsCollapsed: !settings.open,
      hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  })()`);
  if (!workMetrics) throw new Error('Work visual QA could not find the Phase 2 overview structure.');
  if (workMetrics.summaryCards !== 4) throw new Error(`Expected 4 Work overview cards, found ${workMetrics.summaryCards}.`);
  if (!workMetrics.settingsCollapsed) throw new Error('Work schedule & pay settings should be collapsed by default.');
  if (workMetrics.hasHorizontalOverflow) throw new Error('Work page has horizontal overflow at the mobile viewport.');
  await capture(cdp, 'work-mobile');

  await writeFile(`${artifactDir}/metrics.json`, JSON.stringify({ url: liveUrl.toString(), alignment, work: workMetrics }, null, 2));
  console.log(`Live visual QA passed. Home delta: ${alignment.delta.toFixed(1)}px; Work overview cards: ${workMetrics.summaryCards}.`);
} finally {
  cdp?.close();
  chrome?.kill('SIGTERM');
}
