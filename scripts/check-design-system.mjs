import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

const shared = read('src/theme/design-system.css');
const main = read('src/main.tsx');
const health = read('src/features/health/HealthPage.tsx');
const money = read('src/features/money/MoneyPage.tsx');
const tasks = read('src/features/tasks/TasksPage.tsx');
const taskStyles = read('src/features/tasks/tasks.css');

expect(shared.includes('.still-page-header'), 'Shared design system must define a reusable page header.');
expect(shared.includes('.still-action-button'), 'Shared design system must define reusable action buttons.');
expect(shared.includes('.still-filter-tabs'), 'Shared design system must define reusable segmented filters.');
expect(shared.includes('.still-summary-tile'), 'Shared design system must define reusable summary tiles.');
expect(main.includes("import './theme/design-system.css'"), 'The shared design system stylesheet must be loaded once at startup.');
expect(health.includes('still-page-header') && health.includes('still-summary-tile'), 'Health must use shared page and summary primitives.');
expect(money.includes('still-page-header') && money.includes('still-summary-tile'), 'Money must use shared page and summary primitives.');
expect(tasks.includes('still-page-header') && tasks.includes('still-filter-tabs'), 'Tasks must use shared header and filter primitives.');
expect(!taskStyles.includes('.tasks-page-header') && !taskStyles.includes('.tasks-filter button'), 'Tasks must not reintroduce page-specific copies of shared primitives.');

if (failures.length) {
  console.error('Design-system consolidation checks failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Design-system consolidation checks passed.');
