import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const dist = path.join(process.cwd(), 'dist');
const KiB = 1024;
const limits = {
  largestJavaScript: 900 * KiB,
  totalJavaScript: 1305 * KiB,
  largestCss: 150 * KiB,
};

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else files.push(fullPath);
  }
  return files;
}

function formatKiB(bytes) {
  return `${(bytes / KiB).toFixed(1)} KiB`;
}

const files = await walk(dist);
const measured = await Promise.all(files.map(async (file) => ({ file, size: (await stat(file)).size })));
const js = measured.filter(({ file }) => file.endsWith('.js'));
const css = measured.filter(({ file }) => file.endsWith('.css'));
const largestJs = js.reduce((best, item) => item.size > (best?.size ?? -1) ? item : best, null);
const largestCss = css.reduce((best, item) => item.size > (best?.size ?? -1) ? item : best, null);
const totalJs = js.reduce((sum, item) => sum + item.size, 0);

const failures = [];
if ((largestJs?.size ?? 0) > limits.largestJavaScript) {
  failures.push(`largest JS chunk ${formatKiB(largestJs.size)} exceeds ${formatKiB(limits.largestJavaScript)} (${path.relative(dist, largestJs.file)})`);
}
if (totalJs > limits.totalJavaScript) {
  failures.push(`total JavaScript ${formatKiB(totalJs)} exceeds ${formatKiB(limits.totalJavaScript)}`);
}
if ((largestCss?.size ?? 0) > limits.largestCss) {
  failures.push(`largest CSS file ${formatKiB(largestCss.size)} exceeds ${formatKiB(limits.largestCss)} (${path.relative(dist, largestCss.file)})`);
}

console.log(`Build budget: largest JS ${formatKiB(largestJs?.size ?? 0)}, total JS ${formatKiB(totalJs)}, largest CSS ${formatKiB(largestCss?.size ?? 0)}.`);
if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Production bundle is within the Phase 7 size budget.');
