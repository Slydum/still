import { readFile, writeFile, unlink } from 'node:fs/promises';

async function replaceExact(path, before, after) {
  const text = await readFile(path, 'utf8');
  if (!text.includes(before)) throw new Error(`${path}: expected text not found`);
  await writeFile(path, text.replace(before, after));
}

await replaceExact(
  'scripts/e2e-live-pages.mjs',
  `    "document.body.innerText.includes('Weekly reflection') && document.body.innerText.includes('Week rhythm') && Boolean(navigator.serviceWorker.controller)",`,
  `    "document.querySelector('.weekly-reflection-page h1')?.textContent === 'Weekly reflection' && document.querySelector('#weekly-rhythm-title')?.textContent === 'Recorded activity by day' && Boolean(navigator.serviceWorker.controller)",`,
);

await replaceExact(
  'src/features/reflection/WeeklyReflectionPage.tsx',
  "          <span><Sparkles size={18} /> {isCurrentWeek ? 'This week so far' : 'Past week'}</span>",
  "          <span><Sparkles size={18} /> {isCurrentWeek ? 'This week' : 'Past week'}</span>",
);

await replaceExact(
  'scripts/e2e-demo-browser.mjs',
  `  console.log('Browser demo isolation and IndexedDB migration checks passed.');`,
  `  await cdp.send('Page.navigate', { url: \`${appOrigin}/reflection\` });
  await poll(
    cdp,
    "document.querySelector('.weekly-reflection-page h1')?.textContent === 'Weekly reflection' && document.querySelector('#weekly-rhythm-title')?.textContent === 'Recorded activity by day'",
    'weekly reflection route',
  );

  console.log('Browser demo isolation, IndexedDB migration, and weekly reflection route checks passed.');`,
);

await unlink('scripts/diagnose-live-reflection.mjs');
await unlink('scripts/apply-phase4-reflection-hotfix.mjs');
await unlink('.github/workflows/phase4-reflection-diagnostic.yml');
