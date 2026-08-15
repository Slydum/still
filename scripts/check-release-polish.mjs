import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

const packageJson = JSON.parse(read('package.json'));
const versionSource = read('src/app/version.ts');
const more = read('src/features/more/MorePage.tsx');
const main = read('src/main.tsx');
const quickAdd = read('src/components/ui/QuickAddSheet.tsx');
const releaseQa = read('scripts/e2e-release-qa.mjs');
const liveVisual = read('scripts/live-visual-check.mjs');
const iosForms = read('src/theme/ios-form-fix.css');

const versionMatch = versionSource.match(/STILL_VERSION\s*=\s*['"]([^'"]+)['"]/);
expect(Boolean(versionMatch), 'Release identity must export STILL_VERSION.');
expect(versionMatch?.[1] === packageJson.version, 'Displayed Still version must match package.json.');
expect(more.includes('STILL_VERSION') && !more.includes('Version 0.3.0'), 'Settings must use the shared release identity instead of a stale hard-coded version.');

expect(releaseQa.includes("'/today'") && !releaseQa.includes("'/journal'"), 'Release QA must exercise the real Journal route.');
expect(releaseQa.includes("'/health'") && releaseQa.includes("'/work/details'"), 'Release QA must exercise the dedicated Health and Work detail surfaces.');
expect(releaseQa.includes('packageJson.version'), 'Release QA must verify the version from package.json rather than a hard-coded historical value.');
for (const path of ["'/work'", "'/life/love'", "'/money'", "'/health'", "'/more'"]) {
  expect(liveVisual.includes(path), `Release visual QA must cover ${path}.`);
}
for (const viewport of ['390x844', '1024x768', '1280x900', '1440x900', '1680x1050']) {
  expect(liveVisual.includes(viewport), `Release visual QA must retain the ${viewport} target viewport.`);
}
expect(liveVisual.includes('inspectQuickAdd') && liveVisual.includes("[role=dialog][aria-modal=true]"), 'Release visual QA must cover Quick Add dialog geometry and focus.');

expect(iosForms.includes('.app input') && iosForms.includes('.app select') && iosForms.includes('.app textarea'), 'iOS form protection must cover app-wide form controls, not only Quick Add.');
expect(!main.includes('quick-add-interactions'), 'Quick Add interactions must not rely on a global MutationObserver side-effect import.');
expect(quickAdd.includes('trapTabKey') && quickAdd.includes('discard-confirm') && quickAdd.includes('returnFocusRef'), 'Quick Add must own focus trapping, draft protection, and focus restoration in React.');

if (failures.length) {
  console.error('Final release polish checks failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Final release polish checks passed for Still v${packageJson.version}.`);
