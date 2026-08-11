import { spawn, spawnSync } from 'node:child_process';
import { rm } from 'node:fs/promises';

const origin = 'http://127.0.0.1:4175';
const chromePort = 9225;
const profileDir = '/tmp/still-work-laptop-qa-chrome';

function findChrome() {
  for (const candidate of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    if (spawnSync(candidate, ['--version'], { stdio: 'ignore' }).status === 0) return candidate;
  }
  throw new Error('A Chromium/Chrome binary is required for Work laptop QA.');
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
  await poll(cdp, `document.readyState === 'complete' && location.pathname === ${JSON.stringify(path)} && Boolean(document.querySelector('main'))`, path);
  await new Promise((resolve) => setTimeout(resolve, 120));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await rm(profileDir, { recursive: true, force: true });
const preview = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4175'], { stdio: 'inherit' });
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

  const laptopViewports = [
    { width: 1366, height: 768, label: '1366x768 work laptop' },
    { width: 1440, height: 900, label: '1440x900 work laptop' },
  ];

  for (const viewport of laptopViewports) {
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false });
    await navigate(cdp, '/work');
    const state = await evaluate(cdp, `(() => {
      const rect = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
      };
      const nav = document.querySelector('.bottom-nav');
      const main = document.querySelector('.work-hub-page');
      const clockButtons = [...document.querySelectorAll('.work-live-actions button')].map((button) => {
        const box = button.getBoundingClientRect();
        return { text: button.textContent?.trim(), top: box.top, bottom: box.bottom, height: box.height };
      });
      return {
        overflow: document.documentElement.scrollWidth - innerWidth,
        navRect: rect('.bottom-nav'),
        navPosition: nav ? getComputedStyle(nav).position : '',
        navTransform: nav ? getComputedStyle(nav).transform : '',
        navLabels: nav ? [...nav.querySelectorAll('.nav-item')].map((item) => item.textContent?.trim()).filter(Boolean) : [],
        activeNavLabels: nav ? [...nav.querySelectorAll('.nav-item.active')].map((item) => item.textContent?.trim()).filter(Boolean) : [],
        mainRect: rect('.work-hub-page'),
        mainDisplay: main ? getComputedStyle(main).display : '',
        header: rect('.work-hub-header'),
        live: rect('.work-live-card'),
        overview: rect('.work-overview'),
        meetings: rect('.work-meetings'),
        board: rect('.work-board'),
        privacy: rect('.work-live-eye'),
        clockButtons,
        backDisplay: (() => { const back = document.querySelector('.work-hub-back'); return back ? getComputedStyle(back).display : ''; })(),
      };
    })()`);

    assert(state.overflow <= 2, `${viewport.label}: horizontal overflow of ${state.overflow}px.`);
    assert(state.navRect && Math.abs(state.navRect.left) <= 1 && Math.abs(state.navRect.width - 252) <= 2, `${viewport.label}: desktop sidebar is not anchored at 252px on the left edge.`);
    assert(state.navPosition === 'fixed' && state.navTransform === 'none', `${viewport.label}: desktop navigation is not a stable fixed rail.`);
    assert(['Home', 'Work', 'Journal', 'Add', 'Calendar', 'Settings'].every((label) => state.navLabels.includes(label)), `${viewport.label}: desktop navigation labels are incomplete.`);
    assert(state.activeNavLabels.length === 1 && state.activeNavLabels[0] === 'Work', `${viewport.label}: Work is not the single active desktop destination on the Work route.`);
    assert(state.mainRect && state.mainRect.left >= 252 && state.mainDisplay === 'grid', `${viewport.label}: Work is not using the desktop grid inside the app shell.`);
    assert(state.backDisplay === 'none', `${viewport.label}: redundant mobile back control is visible beside the desktop sidebar.`);

    for (const [name, box] of Object.entries({ header: state.header, live: state.live, overview: state.overview, meetings: state.meetings, board: state.board, privacy: state.privacy })) {
      assert(box && box.top >= -1 && box.bottom <= viewport.height + 1, `${viewport.label}: ${name} is not fully visible in the first viewport.`);
    }
    assert(state.clockButtons.length === 2 && state.clockButtons.every((button) => button.height >= 44 && button.bottom <= viewport.height + 1), `${viewport.label}: clock controls are not fully visible 44px targets.`);
    assert(state.live.right <= state.overview.left + 1, `${viewport.label}: live tracker overlaps the work summary.`);
    assert(state.meetings.right <= state.board.left + 1, `${viewport.label}: Meetings overlaps My Work.`);
  }

  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  await navigate(cdp, '/work/details');
  const detailsState = await evaluate(cdp, `(() => {
    const main = document.querySelector('.still-work-page');
    const box = main?.getBoundingClientRect();
    const active = [...document.querySelectorAll('.bottom-nav .nav-item.active')].map((item) => item.textContent?.trim()).filter(Boolean);
    return { overflow: document.documentElement.scrollWidth - innerWidth, left: box?.left ?? -1, width: box?.width ?? 0, active };
  })()`);
  assert(detailsState.overflow <= 2, `1366x768 work details: horizontal overflow of ${detailsState.overflow}px.`);
  assert(detailsState.left >= 252 && detailsState.width >= 760, '1366x768 work details: content is still using the narrow phone-width canvas.');
  assert(detailsState.active.length === 1 && detailsState.active[0] === 'Work', '1366x768 work details: desktop sidebar does not keep Work active.');

  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate(cdp, '/work');
  const phoneState = await evaluate(cdp, `(() => {
    const main = document.querySelector('.work-hub-page');
    const nav = document.querySelector('.bottom-nav');
    const back = document.querySelector('.work-hub-back');
    const navBox = nav?.getBoundingClientRect();
    return {
      display: main ? getComputedStyle(main).display : '',
      navWidth: navBox?.width ?? 0,
      navBottom: navBox?.bottom ?? 0,
      navLabels: nav ? [...nav.querySelectorAll('.nav-item')].map((item) => item.textContent?.trim()).filter(Boolean) : [],
      activeNavLabels: nav ? [...nav.querySelectorAll('.nav-item.active')].map((item) => item.textContent?.trim()).filter(Boolean) : [],
      backDisplay: back ? getComputedStyle(back).display : '',
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  })()`);
  assert(phoneState.overflow <= 2, `phone Work: horizontal overflow of ${phoneState.overflow}px.`);
  assert(phoneState.display !== 'grid', 'phone Work: desktop Work grid leaked below 1024px.');
  assert(phoneState.navWidth < 390 && Math.abs(phoneState.navBottom - 844) <= 16, 'phone Work: existing floating bottom navigation changed unexpectedly.');
  assert(phoneState.navLabels.join('|') === ['Home', 'Journal', 'Add', 'Calendar', 'Settings'].join('|'), 'phone Work: desktop-only Work navigation leaked into the phone bottom bar.');
  assert(phoneState.activeNavLabels.length === 1 && phoneState.activeNavLabels[0] === 'Home', 'phone Work: existing Home umbrella navigation state changed unexpectedly.');
  assert(phoneState.backDisplay !== 'none', 'phone Work: existing back control was removed by the desktop treatment.');

  console.log('Work laptop QA passed at 1366x768 and 1440x900, with desktop Work navigation and phone Work unchanged.');
} finally {
  cdp?.close();
  chrome?.kill('SIGTERM');
  preview.kill('SIGTERM');
}
