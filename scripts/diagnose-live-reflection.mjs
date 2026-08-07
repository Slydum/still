import { spawn, spawnSync } from 'node:child_process';
import { rm } from 'node:fs/promises';

const liveUrl = new URL('https://slydum.github.io/still/');
const chromePort = 9236;
const profileDir = '/tmp/still-reflection-diagnostic';

function findChrome() {
  for (const candidate of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    const result = spawnSync(candidate, ['--version'], { stdio: 'ignore' });
    if (result.status === 0) return candidate;
  }
  throw new Error('Chrome/Chromium is required.');
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
  const events = [];
  let nextId = 1;
  const opened = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) {
      if (message.method === 'Runtime.exceptionThrown' || message.method === 'Runtime.consoleAPICalled') events.push(message);
      return;
    }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  return {
    events,
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
  if (result.exceptionDetails) return { exception: result.exceptionDetails, value: undefined };
  return { value: result.result.value };
}

async function poll(cdp, expression, attempts = 100) {
  for (let index = 0; index < attempts; index += 1) {
    const result = await evaluate(cdp, expression);
    if (result.value) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

await rm(profileDir, { recursive: true, force: true });
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
  const pageResponse = await fetch(`http://127.0.0.1:${chromePort}/json/new?${encodeURIComponent(new URL('auth', liveUrl).toString())}`, { method: 'PUT' });
  const page = await pageResponse.json();
  cdp = createCdp(page.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');

  if (!await poll(cdp, "Boolean(document.querySelector('.auth-demo-entry button'))")) throw new Error('Demo entry did not render.');
  await evaluate(cdp, "document.querySelector('.auth-demo-entry button').click(); true");
  if (!await poll(cdp, "Boolean(document.querySelector('.app')) && !location.pathname.endsWith('/auth')")) throw new Error('Demo app did not render.');

  const moreUrl = new URL('more', liveUrl).toString();
  await cdp.send('Page.navigate', { url: moreUrl });
  await poll(cdp, "document.body.innerText.includes('Demo sandbox')");
  console.log('MORE STATE', JSON.stringify((await evaluate(cdp, `({
    href: location.href,
    path: location.pathname,
    demo: sessionStorage.getItem('still-demo-mode-v1'),
    text: document.body.innerText.slice(0, 500),
    controller: Boolean(navigator.serviceWorker.controller)
  })`)).value, null, 2));

  const reflectionUrl = new URL('reflection', liveUrl).toString();
  await cdp.send('Page.navigate', { url: reflectionUrl });
  await new Promise((resolve) => setTimeout(resolve, 4000));
  const state = (await evaluate(cdp, `({
    href: location.href,
    path: location.pathname,
    demo: sessionStorage.getItem('still-demo-mode-v1'),
    readyState: document.readyState,
    rootHtml: document.querySelector('#root')?.innerHTML?.slice(0, 2000),
    text: document.body.innerText.slice(0, 3000),
    controller: Boolean(navigator.serviceWorker.controller),
    scriptSrcs: [...document.scripts].map((script) => script.src)
  })`)).value;
  console.log('REFLECTION STATE', JSON.stringify(state, null, 2));
  console.log('RUNTIME EVENTS', JSON.stringify(cdp.events.map((event) => ({ method: event.method, params: event.params })), null, 2));
} finally {
  cdp?.close();
  chrome?.kill('SIGTERM');
}
