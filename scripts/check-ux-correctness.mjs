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
const authSource = await readFile(path.join(root, 'src/features/auth/AuthPage.tsx'), 'utf8');
const desktopHomeSource = await readFile(path.join(root, 'src/theme/desktop-home-option1.ts'), 'utf8');
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
if (!mainSource.includes("import './theme/desktop-home-option1';")) {
  failures.push('The selected desktop Home skin must load after the existing Home styles.');
}
if (!desktopHomeSource.includes('@media (min-width: 1024px)') || desktopHomeSource.includes('@media (max-width: 1023px)')) {
  failures.push('The Option 1 Home redesign must remain desktop-only so phone Home stays unchanged.');
}
if (!desktopHomeSource.includes('.app .bottom-nav') || !desktopHomeSource.includes('transform: none !important') || !desktopHomeSource.includes('.app {\n    padding-left: 252px;')) {
  failures.push('Desktop navigation must remain a fully visible persistent app shell instead of inheriting the mobile floating-nav transform.');
}
if (!desktopHomeSource.includes('grid-template-areas:') || !desktopHomeSource.includes("'upcoming checkin'")) {
  failures.push('Desktop Home must keep the selected wide focus / two-column content composition.');
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
if (authSource.includes('still-cloud-mascot') || authSource.includes('auth-art')) {
  failures.push('The selected login experience must stay illustration-free and rely on the gradient layout.');
}
if (!authSource.includes("title: 'Make space for what matters.'") || !authSource.includes("subtitle: 'Your life, gently organized.'") || !authSource.includes('>Sign in</h2>')) {
  failures.push('Login must keep the concise Still message and a distinct Sign in card heading.');
}
if (!authSelectedCss.includes('grid-template-columns:') || !authSelectedCss.includes('grid-column: 1;') || !authSelectedCss.includes('grid-column: 2;')) {
  failures.push('Desktop login must keep the editorial split layout while mobile remains single-column.');
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
