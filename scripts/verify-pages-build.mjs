import { readFile } from 'node:fs/promises';

const [indexHtml, serviceWorker, manifest] = await Promise.all([
  readFile('dist/index.html', 'utf8'),
  readFile('dist/reminder-sw.js', 'utf8'),
  readFile('dist/manifest.webmanifest', 'utf8'),
]);

function assertIncludes(source, expected, label) {
  if (!source.includes(expected)) {
    throw new Error(`${label} is missing expected value: ${expected}`);
  }
}

assertIncludes(indexHtml, '/still/manifest.webmanifest', 'Pages index');
assertIncludes(indexHtml, '/still/icons/favicon-32.png', 'Pages index');
assertIncludes(indexHtml, '/still/assets/auth/cloud-loader.js', 'Pages index');

const parsedManifest = JSON.parse(manifest);
if (parsedManifest.start_url !== '.' || parsedManifest.scope !== './') {
  throw new Error('Manifest start_url and scope must remain relative to the deployed directory.');
}

assertIncludes(serviceWorker, 'self.registration.scope', 'Reminder service worker');
assertIncludes(serviceWorker, 'APP_SHELL_URL', 'Reminder service worker');
assertIncludes(serviceWorker, 'appUrl(targetPath)', 'Reminder service worker');

for (const forbidden of [
  "cache.addAll([\n      '/',",
  "caches.match('/')",
  "register('/reminder-sw.js')",
  "src=\"/assets/auth/",
]) {
  if (indexHtml.includes(forbidden) || serviceWorker.includes(forbidden)) {
    throw new Error(`Pages build contains a root-bound runtime path: ${forbidden}`);
  }
}

console.log('GitHub Pages nested-base build verified.');
