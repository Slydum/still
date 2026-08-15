import { mkdir, rm, writeFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';

const configuredLiveUrl = process.env.STILL_LIVE_URL;
const localPreviewUrl = 'http://127.0.0.1:4177/';
const releaseUrl = new URL(configuredLiveUrl || localPreviewUrl);
if (!releaseUrl.pathname.endsWith('/')) releaseUrl.pathname += '/';
const chromePort = 9237;
const profileDir = '/tmp/still-release-visual-chrome';
const artifactDir = 'artifacts/release-visual';

const viewports = [
  { width: 390, height: 844, key: '390x844' },
  { width: 1024, height: 768, key: '1024x768' },
  { width: 1280, height: 900, key: '1280x900' },
  { width: 1440, height: 900, key: '1440x900' },
  { width: 1680, height: 1050, key: '1680x1050' },
];

const features = [
  { path: '/', selector: '.dashboard-v2', key: 'home', label: 'Home' },
  { path: '/work', selector: '.work-hub-page', key: 'work', label: 'Work' },
  { path: '/life/love', selector: '.love-page', key: 'love', label: 'Love' },
  { path: '/money', selector: '.money-page', key: 'money', label: 'Money' },
  { path: '/health', selector: '.health-page', key: 'health', label: 'Health' },
  { path: '/more', selector: '.more-page', key: 'settings', label: 'Settings' },
];

function findChrome() {
  for (const candidate of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    const result = spawnSync(candidate, ['--version'], { stdio: 'ignore' });
    if (result.status === 0) return candidate;
  }
  throw new Error('A Chromium/Chrome binary is required for release visual QA.');
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
  const screenshot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
    fromSurface: true,
  });
  await writeFile(`${artifactDir}/${name}.png`, Buffer.from(screenshot.data, 'base64'));
}

function featureUrl(path) {
  return new URL(path.replace(/^\//, ''), releaseUrl).toString();
}

async function navigateFeature(cdp, feature) {
  const url = featureUrl(feature.path);
  await evaluate(cdp, `window.history.pushState({},'',${JSON.stringify(url)});window.dispatchEvent(new PopStateEvent('popstate'));true`);
  await poll(cdp, `Boolean(document.querySelector(${JSON.stringify(feature.selector)}))`, feature.label);
  await new Promise((resolve) => setTimeout(resolve, 350));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function inspectFeature(cdp, feature, viewport) {
  await navigateFeature(cdp, feature);
  const metrics = await evaluate(cdp, `(() => {
    const page = document.querySelector(${JSON.stringify(feature.selector)});
    const nav = document.querySelector('.bottom-nav');
    if (!page || !nav) return null;
    const pageRect = page.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    const navStyle = getComputedStyle(nav);
    return {
      page: {
        left: pageRect.left,
        top: pageRect.top,
        right: pageRect.right,
        bottom: pageRect.bottom,
        width: pageRect.width,
        height: pageRect.height,
      },
      hasHeading: Boolean(page.querySelector('h1')),
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      nav: {
        left: navRect.left,
        top: navRect.top,
        right: navRect.right,
        bottom: navRect.bottom,
        width: navRect.width,
        height: navRect.height,
        position: navStyle.position,
        transform: navStyle.transform,
        labels: [...nav.querySelectorAll('.nav-item')].map((item) => item.textContent?.trim()).filter(Boolean),
      },
    };
  })()`);

  assert(metrics, `${viewport.key} ${feature.label}: page or primary navigation is missing.`);
  assert(metrics.hasHeading, `${viewport.key} ${feature.label}: primary heading is missing.`);
  assert(metrics.horizontalOverflow <= 2, `${viewport.key} ${feature.label}: horizontal overflow of ${metrics.horizontalOverflow}px.`);
  assert(metrics.page.width > 0 && metrics.page.height > 0, `${viewport.key} ${feature.label}: page has no visible geometry.`);

  if (viewport.width >= 1024) {
    assert(Math.abs(metrics.nav.left) <= 1 && Math.abs(metrics.nav.top) <= 1, `${viewport.key} ${feature.label}: desktop navigation is shifted off-screen.`);
    assert(metrics.nav.width >= 240 && metrics.nav.width <= 260, `${viewport.key} ${feature.label}: desktop navigation width is ${metrics.nav.width}px.`);
    assert(metrics.nav.height >= viewport.height - 2, `${viewport.key} ${feature.label}: desktop navigation does not fill the viewport.`);
    assert(metrics.nav.position === 'fixed' && metrics.nav.transform === 'none', `${viewport.key} ${feature.label}: desktop navigation inherited mobile positioning.`);
    assert(metrics.nav.labels.includes('Work'), `${viewport.key} ${feature.label}: desktop navigation is missing Work.`);
    assert(metrics.page.left >= 250, `${viewport.key} ${feature.label}: content overlaps the desktop navigation rail.`);
    assert(metrics.page.right <= viewport.width + 2, `${viewport.key} ${feature.label}: content extends beyond the desktop viewport.`);
  } else {
    assert(!metrics.nav.labels.includes('Work'), `${viewport.key} ${feature.label}: desktop-only Work navigation leaked into mobile.`);
    assert(metrics.nav.height < viewport.height / 2, `${viewport.key} ${feature.label}: mobile navigation unexpectedly became a desktop rail.`);
    assert(Math.abs(metrics.nav.bottom - viewport.height) <= 18, `${viewport.key} ${feature.label}: mobile navigation is not anchored to the viewport bottom.`);
    assert(metrics.page.left >= -1 && metrics.page.right <= viewport.width + 2, `${viewport.key} ${feature.label}: mobile content extends outside the viewport.`);
  }

  if (feature.key === 'home' && viewport.width === 390) {
    const alignment = await evaluate(cdp, `(() => {
      const task = document.querySelector('.task-empty-state strong')?.getBoundingClientRect();
      const calendar = document.querySelector('.upcoming-empty strong')?.getBoundingClientRect();
      if (!task || !calendar) return null;
      return { delta: Math.abs(task.left - calendar.left) };
    })()`);
    assert(alignment && alignment.delta <= 2, `390x844 Home: Today empty rows are misaligned${alignment ? ` by ${alignment.delta.toFixed(1)}px` : ''}.`);
  }

  if (feature.key === 'work') {
    const work = await evaluate(cdp, `(() => {
      const tabs = [...document.querySelectorAll('.work-tabs button')].map((item) => item.textContent?.trim().toLowerCase() ?? '');
      const headings = [...document.querySelectorAll('.work-section h2')].map((item) => item.textContent?.trim() ?? '');
      return {
        tabs,
        headings,
        hasLivePay: Boolean(document.querySelector('.work-live-card')),
        hasBreak: [...document.querySelectorAll('.work-live-actions button')].some((item) => item.textContent?.includes('Break')),
      };
    })()`);
    assert(work.tabs.length === 3 && work.tabs.some((value) => value.startsWith('to do')) && work.tabs.some((value) => value.startsWith('in progress')) && work.tabs.some((value) => value.startsWith('done')), `${viewport.key} Work: queue tabs are incomplete.`);
    assert(work.hasLivePay && !work.hasBreak, `${viewport.key} Work: live tracker is missing or the retired break timer returned.`);
    assert(['Meetings', 'Incidents', 'Changes', 'Notes'].every((heading) => work.headings.includes(heading)), `${viewport.key} Work: one or more operational sections are missing.`);
  }

  await capture(cdp, `${viewport.key}-${feature.key}`);
  return metrics;
}

async function inspectQuickAdd(cdp, viewport) {
  await navigateFeature(cdp, features[0]);
  const opened = await evaluate(cdp, `(() => {
    const trigger = [...document.querySelectorAll('.bottom-nav .nav-item')]
      .find((item) => item.textContent?.trim() === 'Add' && item.tagName === 'BUTTON');
    if (!trigger) return false;
    trigger.click();
    return true;
  })()`);
  assert(opened, `${viewport.key} Quick Add: Add trigger is missing.`);
  await poll(cdp, "Boolean(document.querySelector('[role=dialog][aria-modal=true]'))", `${viewport.key} Quick Add dialog`);
  await poll(cdp, "document.querySelector('[role=dialog][aria-modal=true]')?.contains(document.activeElement) === true", `${viewport.key} Quick Add focus`);
  // The sheet has a short translateY entrance animation. Measure the resting box,
  // not the transient animated frame that intentionally starts below the viewport.
  await new Promise((resolve) => setTimeout(resolve, 320));

  const modal = await evaluate(cdp, `(() => {
    const dialog = document.querySelector('[role=dialog][aria-modal=true]');
    if (!dialog) return null;
    const rect = dialog.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      focusInside: dialog.contains(document.activeElement),
    };
  })()`);
  assert(modal, `${viewport.key} Quick Add: dialog geometry is missing.`);
  assert(modal.width > 0 && modal.height > 0, `${viewport.key} Quick Add: dialog is not visible.`);
  assert(modal.left >= -2 && modal.right <= viewport.width + 2, `${viewport.key} Quick Add: dialog exceeds the horizontal viewport.`);
  assert(modal.top >= -2 && modal.bottom <= viewport.height + 2, `${viewport.key} Quick Add: settled dialog exceeds the vertical viewport (${Math.round(modal.top)}..${Math.round(modal.bottom)} in ${viewport.height}px).`);
  assert(modal.overflow <= 2, `${viewport.key} Quick Add: dialog creates ${modal.overflow}px horizontal overflow.`);
  assert(modal.focusInside, `${viewport.key} Quick Add: keyboard focus is outside the dialog.`);
  await capture(cdp, `${viewport.key}-quick-add`);

  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape' });
  await poll(cdp, "!document.querySelector('[role=dialog][aria-modal=true]')", `${viewport.key} Quick Add close`);
  return modal;
}

await rm(profileDir, { recursive: true, force: true });
await rm(artifactDir, { recursive: true, force: true });
await mkdir(artifactDir, { recursive: true });
let preview;
let chrome;
let cdp;

try {
  if (!configuredLiveUrl) {
    preview = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4177'], { stdio: 'inherit' });
  }
  await waitFor(releaseUrl.toString());

  chrome = spawn(findChrome(), [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    `--remote-debugging-port=${chromePort}`, `--user-data-dir=${profileDir}`, 'about:blank',
  ], { stdio: 'ignore' });
  await waitFor(`http://127.0.0.1:${chromePort}/json/version`);
  const authUrl = featureUrl('/auth');
  const pageResponse = await fetch(`http://127.0.0.1:${chromePort}/json/new?${encodeURIComponent(authUrl)}`, { method: 'PUT' });
  if (!pageResponse.ok) throw new Error(`Could not create browser target: ${pageResponse.status}`);
  const page = await pageResponse.json();
  cdp = createCdp(page.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await poll(cdp, "Boolean(document.querySelector('.auth-demo-entry button'))", 'demo entry');
  await evaluate(cdp, "document.querySelector('.auth-demo-entry button').click(); true");
  await poll(cdp, "Boolean(document.querySelector('.dashboard-v2'))", 'Home dashboard');

  const results = {};
  for (const viewport of viewports) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: viewport.width < 768,
      screenWidth: viewport.width,
      screenHeight: viewport.height,
    });
    results[viewport.key] = { features: {}, quickAdd: null };
    for (const feature of features) {
      results[viewport.key].features[feature.key] = await inspectFeature(cdp, feature, viewport);
    }
    results[viewport.key].quickAdd = await inspectQuickAdd(cdp, viewport);
  }

  await writeFile(`${artifactDir}/metrics.json`, JSON.stringify({
    url: releaseUrl.toString(),
    source: configuredLiveUrl ? 'deployed-pages' : 'local-preview',
    results,
  }, null, 2));
  console.log(`Release visual QA passed across ${viewports.length} viewports, ${features.length} core surfaces, and Quick Add modal states.`);
} finally {
  cdp?.close();
  chrome?.kill('SIGTERM');
  preview?.kill('SIGTERM');
}
