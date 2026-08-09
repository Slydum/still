import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

const nav = read('src/components/navigation/BottomNav.tsx');
const app = read('src/app/App.tsx');
const back = read('src/components/navigation/useBackNavigation.ts');
const life = read('src/features/life-area/LifeAreaPage.tsx');
const money = read('src/features/money/MoneyPage.tsx');
const settings = read('src/features/more/MorePage.tsx');
const overview = read('src/features/reflection/WeeklyReflectionPage.tsx');

expect(nav.includes("{ label: 'Home', path: '/', icon: Home }"), 'Primary root navigation must be named Home.');
expect(nav.includes("{ label: 'Settings', path: '/more'"), 'The settings destination must be labeled Settings in primary navigation.');
expect(nav.includes("pathname.startsWith('/life/')"), 'Life Area routes must retain Home parent-tab context.');
expect(nav.includes("pathname === '/work'") && nav.includes("pathname === '/money'"), 'Work and Money trackers must retain Home parent-tab context.');
expect(nav.includes('aria-current='), 'Active primary navigation must expose aria-current.');
expect(app.includes('useNavigationType') && app.includes("navigationType === 'POP'"), 'Route scrolling must preserve browser history restoration on POP navigation.');
expect(app.includes("window.history.scrollRestoration = 'auto'"), 'Browser scroll restoration must remain enabled.');
expect(back.includes('navigate(-1)') && back.includes('navigate(fallback'), 'Back navigation must use history with an explicit fallback.');
expect(life.includes("useBackNavigation('/')"), 'Life Area pages must use history-aware Back behavior.');
expect(life.includes("'work tracker'") && life.includes("'spending tracker'"), 'Life Areas must distinguish areas from specialized trackers.');
expect(money.includes('<h1>Where your money stands.</h1>') && money.includes("useBackNavigation('/life/money')"), 'Money overview naming and fallback must remain explicit.');
expect(settings.includes('<h1>Settings</h1>'), 'The Settings tab destination must identify itself as Settings.');
expect(overview.includes('<h1>Weekly overview</h1>') && overview.includes("useBackNavigation('/')"), 'The factual weekly records page must be named Weekly overview and use contextual Back behavior.');

if (failures.length) {
  console.error('Navigation IA checks failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Navigation IA checks passed.');
