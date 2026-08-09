import { readFile } from 'node:fs/promises';

const tokens = await readFile('src/theme/tokens.css', 'utf8');
const main = await readFile('src/main.tsx', 'utf8');
const helper = await readFile('src/components/ui/dialogAccessibility.ts', 'utf8');
const quickAdd = await readFile('src/components/ui/QuickAddSheet.tsx', 'utf8');
const workModal = await readFile('src/theme/work-modal-interactions.ts', 'utf8');

const failures = [];

function channel(value) {
  const normalized = value / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((offset) => channel(Number.parseInt(value.slice(offset, offset + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

for (const token of ['muted', 'muted-soft']) {
  const match = tokens.match(new RegExp(`--${token}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) {
    failures.push(`tokens.css: missing --${token}`);
    continue;
  }
  const ratio = contrast(match[1], '#fff9f4');
  if (ratio < 4.5) failures.push(`tokens.css: --${token} contrast is ${ratio.toFixed(2)}:1 on --bg; expected >= 4.5:1`);
}

if (!helper.includes('trapTabKey') || !helper.includes('focusFirst') || !helper.includes("aria-modal")) {
  failures.push('dialogAccessibility.ts: shared focus trap, initial focus, and modal semantics are required');
}
if (!quickAdd.includes("from './dialogAccessibility'") || !quickAdd.includes('trapTabKey') || !quickAdd.includes('focusFirst')) {
  failures.push('QuickAddSheet.tsx: Quick Add must use shared dialog accessibility utilities directly');
}
if (!quickAdd.includes('role="alertdialog"') || !quickAdd.includes('returnFocusRef')) {
  failures.push('QuickAddSheet.tsx: draft confirmation and focus restoration must remain explicit');
}
if (!workModal.includes("from '../components/ui/dialogAccessibility'")) {
  failures.push('work-modal-interactions.ts: Work shift editor must use shared dialog accessibility utilities');
}
if (!main.includes("'./theme/work-modal-interactions'")) failures.push('main.tsx: Work modal accessibility controller is not loaded');
if (!main.includes("'./theme/v03-accessibility.css'")) failures.push('main.tsx: accessibility interaction styles are not loaded');

if (failures.length) {
  console.error('Accessibility foundation checks failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Accessibility foundation checks passed.');
