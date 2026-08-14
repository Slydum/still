import { spawn, spawnSync } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';

const origin = 'http://127.0.0.1:4174';
const chromePort = 9224;
const profileDir = '/tmp/still-release-qa-chrome';
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

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

async function navigate(cdp, route) {
  await cdp.send('Page.navigate', { url: `${origin}${route.path}` });
  await poll(
    cdp,
    `document.readyState === 'complete' && location.pathname === ${JSON.stringify(route.expected ?? route.path)} && Boolean(document.querySelector('main')) && !document.querySelector('main.auth-loading')`,
    route.path,
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
}

function expectedCurrentNavLabel(pathname, desktop) {
  if (pathname === '/') return 'Home';
  if (pathname === '/today') return 'Journal';
  if (pathname === '/calendar') return 'Calendar';
  if (pathname === '/more') return 'Settings';
  if (desktop && pathname === '/work') return 'Work';
  return null;
}

const routes = [
  { path: '/' },
  { path: '/tasks' },
  { path: '/today' },
  { path: '/calendar' },
  { path: '/check-ins' },
  { path: '/reflection' },
  { path: '/life/work', expected: '/work' },
  { path: '/life/money' },
  { path: '/life/love' },
  { path: '/life/health', expected: '/health' },
  { path: '/work' },
  { path: '/work/details' },
  { path: '/money' },
  { path: '/health' },
  { path: '/notifications' },
  { path: '/more' },
];
const viewports = [
  { width: 320, height: 720, label: 'small phone' },
  { width: 390, height: 844, label: 'phone' },
  { width: 768, height: 1024, label: 'tablet' },
  { width: 1280, height: 900, label: 'desktop' },
];
const expectedNavLabels = ['Home', 'Journal', 'Add', 'Calendar', 'Settings'];

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
        versionText: document.body.innerText.includes(${JSON.stringify(`Version ${packageJson.version}`)}),
        appPaddingBottom: (() => {
          const app = document.querySelector('.app');
          return app ? Number.parseFloat(getComputedStyle(app).paddingBottom) : 0;
        })(),
        currentNavLabels: [...document.querySelectorAll('.bottom-nav .nav-item[aria-current="page"] > span:last-child')]
          .map((label) => label.textContent?.trim() ?? ''),
        nav: (() => {
          const el = document.querySelector('.bottom-nav');
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          const labels = [...el.querySelectorAll('.nav-item > span:last-child')].map((label) => {
            const labelRect = label.getBoundingClientRect();
            return { text: label.textContent?.trim() ?? '', width: labelRect.width, height: labelRect.height };
          });
          return {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
            position: style.position,
            transform: style.transform,
            labels,
          };
        })()
      })`);
      if (!state.mainVisible) throw new Error(`${viewport.label} ${route.path}: main content is not visible.`);
      if (state.path !== (route.expected ?? route.path)) throw new Error(`${viewport.label} ${route.path}: resolved to unexpected route ${state.path}.`);
      if (state.overflow > 2) throw new Error(`${viewport.label} ${route.path}: horizontal overflow of ${state.overflow}px.`);
      if (route.path !== '/' && state.h1Count < 1) throw new Error(`${viewport.label} ${route.path}: missing page heading.`);
      if (route.path === '/more' && !state.versionText) throw new Error(`Settings does not report Version ${packageJson.version}.`);
      if (!state.nav) throw new Error(`${viewport.label} ${route.path}: primary navigation is missing.`);

      const expectedCurrent = expectedCurrentNavLabel(state.path, viewport.width >= 1024);
      if (state.currentNavLabels.length > 1) {
        throw new Error(`${viewport.label} ${route.path}: multiple primary links claim aria-current (${state.currentNavLabels.join(', ')}).`);
      }
      if (expectedCurrent === null && state.currentNavLabels.length !== 0) {
        throw new Error(`${viewport.label} ${route.path}: descendant route incorrectly claims aria-current on ${state.currentNavLabels[0]}.`);
      }
      if (expectedCurrent !== null && state.currentNavLabels[0] !== expectedCurrent) {
        throw new Error(`${viewport.label} ${route.path}: expected aria-current on ${expectedCurrent}, got ${state.currentNavLabels[0] ?? 'none'}.`);
      }

      if (viewport.width >= 1024) {
        if (Math.abs(state.nav.left) > 1 || Math.abs(state.nav.top) > 1) {
          throw new Error(`${viewport.label} ${route.path}: desktop sidebar is shifted off-screen (${state.nav.left}, ${state.nav.top}).`);
        }
        if (state.nav.width < 240 || state.nav.width > 260) {
          throw new Error(`${viewport.label} ${route.path}: desktop sidebar width is ${state.nav.width}px instead of the expected rail width.`);
        }
        if (state.nav.height < viewport.height - 2) {
          throw new Error(`${viewport.label} ${route.path}: desktop sidebar does not fill the viewport height.`);
        }
        if (state.nav.position !== 'fixed' || state.nav.transform !== 'none') {
          throw new Error(`${viewport.label} ${route.path}: desktop sidebar inherited mobile positioning (${state.nav.position}, ${state.nav.transform}).`);
        }
        for (const label of expectedNavLabels) {
          const rendered = state.nav.labels.find((item) => item.text === label);
          if (!rendered || rendered.width < 1 || rendered.height < 1) {
            throw new Error(`${viewport.label} ${route.path}: desktop sidebar label ${label} is clipped or hidden.`);
          }
        }
      } else {
        if (state.nav.height >= viewport.height / 2) {
          throw new Error(`${viewport.label} ${route.path}: mobile/tablet navigation unexpectedly became a desktop sidebar.`);
        }
        if (state.appPaddingBottom < state.nav.height + 36) {
          throw new Error(`${viewport.label} ${route.path}: app bottom clearance ${state.appPaddingBottom}px is too small for fixed navigation height ${state.nav.height}px.`);
        }
      }
    }
  }

  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate(cdp, { path: '/tasks' });
  const opened = await evaluate(cdp, `(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.includes('Add task'));
    if (!button) return false;
    button.dataset.releaseQaTrigger = 'true';
    button.focus();
    button.click();
    return true;
  })()`);
  if (!opened) throw new Error('Tasks Add task action is unavailable.');
  await poll(cdp, "Boolean(document.querySelector('[role=dialog][aria-modal=true]'))", 'task dialog');
  await poll(cdp, "document.querySelector('[role=dialog]')?.contains(document.activeElement) === true", 'task dialog keyboard focus');

  for (let index = 0; index < 12; index += 1) {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab' });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab' });
  }
  const focusStillInside = await evaluate(cdp, "document.querySelector('[role=dialog]')?.contains(document.activeElement) === true");
  if (!focusStillInside) throw new Error('Task dialog allowed keyboard focus to escape.');

  const changedDraft = await evaluate(cdp, `(() => {
    const input = document.querySelector('[role=dialog] input[type=text]');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, 'Release QA draft');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return input.value === 'Release QA draft';
  })()`);
  if (!changedDraft) throw new Error('Task dialog draft field could not be changed.');
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
  await poll(cdp, "Boolean(document.querySelector('[role=alertdialog][aria-modal=true]'))", 'discard confirmation');
  await poll(cdp, "document.querySelector('[role=alertdialog]')?.contains(document.activeElement) === true", 'discard confirmation keyboard focus');
  await evaluate(cdp, "document.querySelector('[role=alertdialog] [data-discard]')?.click(); true");
  await poll(cdp, "!document.querySelector('[role=dialog][aria-modal=true]')", 'task dialog close');
  await poll(cdp, "document.activeElement?.dataset.releaseQaTrigger === 'true'", 'task trigger focus restoration');

  console.log(`v${packageJson.version} release QA passed: real routes, exact aria-current semantics, fixed-nav clearance, responsive headings, desktop shell, release identity, modal focus trap, draft protection, Escape handling, and focus restoration.`);
} finally {
  cdp?.close();
  chrome?.kill('SIGTERM');
  preview.kill('SIGTERM');
}
