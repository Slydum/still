import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

const dashboard = read('src/features/dashboard/DashboardPage.tsx');
const styles = read('src/theme/home-simplification.css');

expect(dashboard.includes('HOME_TASK_PREVIEW_COUNT = 3'), 'Home must default to a three-task preview.');
expect(dashboard.includes('taskListExpanded'), 'Home must preserve access to the full task list through disclosure.');
expect(dashboard.includes('Show less') && dashboard.includes('Show ${hiddenTaskCount} more'), 'Task disclosure must clearly expose expansion and collapse.');
expect(dashboard.includes('HOME_EVENT_PREVIEW_COUNT = 3'), 'Home must limit the calendar preview to three events.');
expect(dashboard.includes('Weekly overview'), 'Home must use the canonical Weekly overview destination name.');
expect(dashboard.includes('Life areas'), 'Home must present the garden as concise Life Area navigation.');
expect(!dashboard.includes('getSecondaryQuote'), 'Home must not render a second inspirational quote after the hero.');
expect(!dashboard.includes('closing-note closing-note-v2'), 'The redundant closing reminder must stay off Home.');
expect(dashboard.includes("import '../../theme/home-simplification.css'"), 'Home simplification styles must stay locally attached to Dashboard.');
expect(styles.includes('max-height: 360px') && styles.includes('overflow-y: auto'), 'Expanded tasks must remain contained instead of making Home unbounded.');
expect(styles.includes('.weekly-reflection-entry-copy small') && styles.includes('display: none'), 'Weekly Overview must remain a compact navigation row on Home.');

if (failures.length) {
  console.error('Home simplification checks failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Home simplification checks passed.');
