import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

const nav = read('src/components/navigation/BottomNav.tsx');
const navState = read('src/components/navigation/navigationState.ts');
const app = read('src/app/App.tsx');
const back = read('src/components/navigation/useBackNavigation.ts');
const life = read('src/features/life-area/LifeAreaPage.tsx');
const health = read('src/features/health/HealthPage.tsx');
const money = read('src/features/money/MoneyPage.tsx');
const settings = read('src/features/more/MorePage.tsx');
const overview = read('src/features/reflection/WeeklyReflectionPage.tsx');

expect(nav.includes("{ label: 'Home', path: '/', icon: Home }"), 'Primary root navigation must be named Home.');
expect(nav.includes("{ label: 'Tasks', path: '/tasks'"), 'Tasks must be a primary navigation destination.');
expect(nav.includes("{ label: 'More', path: '/more'"), 'The utility and settings destination must be labeled More in primary navigation.');
expect(!navState.includes("pathname === '/tasks'"), 'Tasks must not inherit Home parent-tab context once promoted to primary navigation.');
expect(navState.includes("pathname.startsWith('/life/')"), 'Life Area routes must retain Home parent-tab context.');
expect(navState.includes('!desktop && isWorkPath(pathname)') && navState.includes("pathname === '/money'") && navState.includes("pathname === '/health'"), 'Work, Money, and Health trackers must retain Home parent-tab context.');
expect(nav.includes('<Link') && nav.includes('to={path}'), 'Primary route navigation must use semantic links.');
expect(nav.includes('aria-current={isNavCurrentPage('), 'Active primary navigation must expose exact-page aria-current semantics.');
expect(navState.includes('return pathname === itemPath;'), 'aria-current must remain exact rather than inheriting section-active state.');
expect(app.includes('useNavigationType') && app.includes("navigationType === 'POP'"), 'Route scrolling must preserve browser history restoration on POP navigation.');
expect(app.includes("window.history.scrollRestoration = 'auto'"), 'Browser scroll restoration must remain enabled.');
expect(app.includes('path="/health"') && app.includes('path="/life/health"') && app.includes('<Navigate to="/health" replace />'), 'Health must promote from its Life Area route into the dedicated overview.');
expect(back.includes('navigate(-1)') && back.includes('navigate(fallback'), 'Back navigation must use history with an explicit fallback.');
expect(life.includes("useBackNavigation('/')"), 'Life Area pages must use history-aware Back behavior.');
expect(life.includes("'work tracker'") && life.includes("'spending tracker'"), 'Life Areas must distinguish areas from specialized trackers.');
expect(health.includes('<h1>How have you been lately?</h1>') && health.includes("useBackNavigation('/')"), 'Health overview naming and contextual Back behavior must remain explicit.');
expect(money.includes('<h1>Where your money stands.</h1>') && money.includes("useBackNavigation('/life/money')"), 'Money overview naming and fallback must remain explicit.');
expect(settings.includes('<h1>Settings</h1>'), 'Settings content inside More must remain clearly identified.');
expect(overview.includes('<h1>Weekly overview</h1>') && overview.includes("useBackNavigation('/')"), 'The factual weekly records page must be named Weekly overview and use contextual Back behavior.');

if (failures.length) {
  console.error('Navigation IA checks failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Navigation IA checks passed.');