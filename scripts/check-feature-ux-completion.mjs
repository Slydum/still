import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

const app = read('src/app/App.tsx');
const bottomNav = read('src/components/navigation/BottomNav.tsx');
const tasks = read('src/features/tasks/TasksPage.tsx');
const health = read('src/features/health/HealthPage.tsx');
const journal = read('src/features/journal/JournalPage.tsx');
const repository = read('src/data/repositories/localStillRepository.ts');
const money = read('src/features/money/MoneyPage.tsx');
const expenseEditor = read('src/components/ui/quick-add/ExpenseEditor.tsx');
const lifeArea = read('src/features/life-area/LifeAreaPage.tsx');
const notifications = read('src/features/notifications/NotificationsPage.tsx');

expect(app.includes('path="/tasks"') && app.includes('<TasksPage />'), 'Tasks must have a dedicated routable management surface.');
expect(bottomNav.includes("pathname === '/tasks'"), 'Tasks must remain in the Home navigation context.');
expect(tasks.includes("type TaskFilter = 'open' | 'completed' | 'all'"), 'Tasks must support Open, Completed, and All filtering.');
expect(tasks.includes('openTaskEditor(task.id)') && tasks.includes('toggleTask(task.id)') && tasks.includes('deleteTask(task.id)'), 'Tasks management must preserve edit, completion, and deletion actions.');
expect(expenseEditor.includes('expense?: StillExpense') && expenseEditor.includes("expense ? 'Save changes'") && expenseEditor.includes('allowIncome'), 'The shared expense editor must support existing expense edits and Money income.');
expect(money.includes('updateExpense(transactionEditor.id, input)') && money.includes('Edit transaction'), 'Money must expose transaction correction without delete-and-recreate.');
expect(money.includes('trapTabKey(event, dialog)') && money.includes('focusFirst(dialog)'), 'Transaction editing must keep the shared accessible dialog keyboard contract.');
expect(health.includes('listCheckIns') && health.includes('saveCheckIn') && health.includes('healthRoutines'), 'Health must reuse durable check-ins and keep routines in the Health settings model.');
expect(health.includes("entry.tags.includes('health-note')") && journal.includes("!entry.tags.includes('health-note')"), 'Health Notes must stay dedicated to Health instead of duplicating into Journal.');
expect(repository.includes('stripCheckInMetadata(existing)') && repository.includes('...record'), 'Partial check-in saves must merge with the existing daily record so Health signals survive Home edits.');
expect(lifeArea.includes("navigate('/money')") && lifeArea.includes("navigate('/work')"), 'Money and Work records in Life Areas must not remain static dead ends.');
expect(notifications.includes("if (kind === 'task') navigate('/tasks')") && notifications.includes("if (kind === 'event') navigate('/calendar')"), 'Task and event notifications must lead to actionable destinations.');

if (failures.length) {
  console.error('Feature UX completion checks failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Feature UX completion checks passed.');
