import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const failures = [];

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

const correctnessCss = await readFile(path.join(root, 'src/theme/v03-ux-correctness.css'), 'utf8');
const authSelectedCss = await readFile(path.join(root, 'src/theme/auth-selected-fidelity.css'), 'utf8');
const mainSource = await readFile(path.join(root, 'src/main.tsx'), 'utf8');
const workHubSource = await readFile(path.join(root, 'src/features/work/WorkHubPage.tsx'), 'utf8');
const moneySource = await readFile(path.join(root, 'src/features/money/MoneyPage.tsx'), 'utf8');
const healthSource = await readFile(path.join(root, 'src/features/health/HealthPage.tsx'), 'utf8');
const currentDateSource = await readFile(path.join(root, 'src/hooks/useCurrentDate.ts'), 'utf8');

if (!/focus-list\s*>\s*:nth-child\(n \+ 4\)[\s\S]*display:\s*flex/.test(correctnessCss)) {
  failures.push('Home must keep task #4+ reachable until an All Tasks surface exists.');
}
if (!/garden-card\.love[\s\S]*garden-card\.health[\s\S]*pointer-events:\s*auto/.test(correctnessCss)) {
  failures.push('Love and Health Life Areas must remain interactive.');
}
if (!/weekly-reflection-entry[\s\S]*order:\s*5/.test(correctnessCss)) {
  failures.push('Weekly overview must remain after Life Garden in the Phase 1 hierarchy.');
}
if (!mainSource.includes("import './theme/base-path-assets';")) {
  failures.push('Base-path asset normalization must load before app rendering.');
}
if (workHubSource.includes('unpaidBreakMinutes: 0')) {
  failures.push('Work Hub must not rewrite the saved unpaid-break configuration just to hide break tracking in the hub UI.');
}
if (!currentDateSource.includes("document.addEventListener('visibilitychange'") || !currentDateSource.includes('window.setInterval')) {
  failures.push('Date-sensitive pages need a shared clock that refreshes while open and when the app becomes visible again.');
}
if (!moneySource.includes('const now = useCurrentDate();') || !moneySource.includes('[expenses, now]') || !moneySource.includes('[bills, now]')) {
  failures.push('Money month totals and bill status must refresh when the current date changes.');
}
if (!healthSource.includes('const now = useCurrentDate();') || healthSource.includes('subDays(new Date(), 6), end: new Date() }), [])') || !healthSource.includes('}, [today]);')) {
  failures.push('Health must roll its seven-day summary forward when the local date changes.');
}
if (!authSelectedCss.includes('@media (min-width: 900px)') || !authSelectedCss.includes('@media (max-width: 480px)') || !authSelectedCss.includes('@media (max-width: 360px)')) {
  failures.push('The selected auth experience must keep explicit desktop, phone, and small-phone responsive breakpoints.');
}
if (!authSelectedCss.includes('@media (max-height: 640px) and (orientation: landscape)')) {
  failures.push('The selected auth experience must remain usable on short landscape screens instead of clipping the form.');
}

const sourceFiles = (await walk(path.join(root, 'src')))
  .filter((file) => ['.ts', '.tsx'].includes(path.extname(file)));
const legacyRootAssetAllowlist = new Set(['src/features/work/WorkPage.tsx']);
for (const file of sourceFiles) {
  const relative = path.relative(root, file).replaceAll('\\', '/');
  const content = await readFile(file, 'utf8');
  if ((/src=["']\/assets\//.test(content) || /src=\{["']\/assets\//.test(content)) && !legacyRootAssetAllowlist.has(relative)) {
    failures.push(`${relative}: root-relative public asset paths are not base-path safe; use toAppPath().`);
  }
}

if (failures.length) {
  console.error('UX correctness checks failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('UX correctness checks passed.');
