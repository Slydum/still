import { spawn, spawnSync } from 'node:child_process';
import { rm } from 'node:fs/promises';

const origin = 'http://127.0.0.1:4176';
const chromePort = 9226;
const profileDir = '/tmp/still-work-meeting-delete-qa';
const meetingTitle = 'Delete me · Work meeting QA';

function findChrome() {
  for (const candidate of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    if (spawnSync(candidate, ['--version'], { stdio: 'ignore' }).status === 0) return candidate;
  }
  throw new Error('A Chromium/Chrome binary is required for Work meeting QA.');
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
const preview = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4176'], { stdio: 'inherit' });
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

  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  await navigate(cdp, '/work');

  const optionOneState = await evaluate(cdp, `(() => {
    const quick = document.querySelector('.work-quick-access');
    const overview = document.querySelector('.work-overview');
    return {
      quickDisplay: quick ? getComputedStyle(quick).display : '',
      quickButtons: quick ? quick.querySelectorAll('button').length : 0,
      overviewColumns: overview ? getComputedStyle(overview).gridTemplateColumns.split(' ').length : 0,
    };
  })()`);
  assert(optionOneState.quickDisplay === 'grid' && optionOneState.quickButtons === 4, 'Option 1 quick-access strip is not active on desktop.');
  assert(optionOneState.overviewColumns === 4, 'Option 1 work summary is not the four-column desktop strip.');

  await evaluate(cdp, `(() => {
    const button = [...document.querySelectorAll('.work-meetings .work-section-head button')].find((item) => item.textContent?.includes('Meeting'));
    button?.click();
    return Boolean(button);
  })()`);
  await poll(cdp, "Boolean(document.querySelector('.work-desktop-modal .work-meeting-form'))", 'add meeting modal');

  await evaluate(cdp, `(() => {
    const input = document.querySelector('.work-desktop-modal .work-meeting-form input[placeholder="Meeting name"]');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(meetingTitle)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.work-desktop-modal .work-meeting-form').requestSubmit();
    return true;
  })()`);
  await poll(cdp, `[...document.querySelectorAll('.work-meetings .work-record')].some((item) => item.textContent?.includes(${JSON.stringify(meetingTitle)}))`, 'saved meeting');

  await evaluate(cdp, `(() => {
    const row = [...document.querySelectorAll('.work-meetings .work-record')].find((item) => item.textContent?.includes(${JSON.stringify(meetingTitle)}));
    row?.click();
    return Boolean(row);
  })()`);
  await poll(cdp, "Boolean(document.querySelector('.work-desktop-modal .work-modal-danger-link'))", 'meeting delete action');
  await evaluate(cdp, "document.querySelector('.work-desktop-modal .work-modal-danger-link').click(); true");
  await poll(cdp, "Boolean(document.querySelector('.work-desktop-modal .work-delete-confirm .work-modal-danger'))", 'meeting delete confirmation');
  await evaluate(cdp, "document.querySelector('.work-desktop-modal .work-delete-confirm .work-modal-danger').click(); true");
  await poll(cdp, `![...document.querySelectorAll('.work-meetings .work-record')].some((item) => item.textContent?.includes(${JSON.stringify(meetingTitle)}))`, 'meeting removal');

  await new Promise((resolve) => setTimeout(resolve, 900));
  await navigate(cdp, '/work');
  const persisted = await evaluate(cdp, `[...document.querySelectorAll('.work-meetings .work-record')].some((item) => item.textContent?.includes(${JSON.stringify(meetingTitle)}))`);
  assert(!persisted, 'Deleted Work meeting returned after navigation; deletion was not persisted.');

  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate(cdp, '/work');
  const phoneState = await evaluate(cdp, `(() => {
    const quick = document.querySelector('.work-quick-access');
    return { quickDisplay: quick ? getComputedStyle(quick).display : '', overflow: document.documentElement.scrollWidth - innerWidth };
  })()`);
  assert(phoneState.quickDisplay === 'none', 'Option 1 desktop quick access leaked onto phone Work.');
  assert(phoneState.overflow <= 2, `Phone Work has ${phoneState.overflow}px horizontal overflow.`);

  console.log('Work Option 1 and persisted meeting deletion QA passed.');
} finally {
  cdp?.close();
  chrome?.kill('SIGTERM');
  preview.kill('SIGTERM');
}
