import { readFile, writeFile, unlink } from 'node:fs/promises';

async function replaceOnce(path, marker, insertion) {
  const text = await readFile(path, 'utf8');
  if (!text.includes(marker)) throw new Error(`${path}: insertion marker not found`);
  await writeFile(path, text.replace(marker, insertion + marker));
}

await replaceOnce(
  'src/app/App.tsx',
  "import { NotificationsPage } from '../features/notifications/NotificationsPage';",
  "import { WeeklyReflectionPage } from '../features/reflection/WeeklyReflectionPage';\n",
);

await replaceOnce(
  'src/app/App.tsx',
  '        <Route path="/notifications" element={<NotificationsPage />} />',
  '        <Route path="/reflection" element={<WeeklyReflectionPage />} />\n',
);

await replaceOnce(
  'src/features/dashboard/DashboardPage.tsx',
  '      <section className="section closing-note closing-note-v2">',
  `      <section className="section weekly-reflection-entry">
        <button className="card weekly-reflection-entry-card" onClick={() => navigate('/reflection')} type="button">
          <span className="weekly-reflection-entry-icon"><Sparkles size={20} /></span>
          <span className="weekly-reflection-entry-copy">
            <span className="section-kicker">Weekly reflection</span>
            <strong>See the week in your own records</strong>
            <small>Tasks, events, reflections, spending, work, check-ins, and Life Areas — summarized without guessing what they mean.</small>
          </span>
          <span className="weekly-reflection-entry-action">Look back</span>
        </button>
      </section>

`,
);

const cssPath = 'src/features/reflection/weekly-reflection.css';
const css = await readFile(cssPath, 'utf8');
await writeFile(cssPath, `${css}

.weekly-reflection-entry-card {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 1.05rem 1.15rem;
  border: 0;
  color: inherit;
  text-align: left;
}

.weekly-reflection-entry-icon {
  width: 2.55rem;
  height: 2.55rem;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 0.9rem;
  background: rgba(124, 111, 167, 0.1);
}

.weekly-reflection-entry-copy {
  min-width: 0;
  display: grid;
  gap: 0.22rem;
  flex: 1;
}

.weekly-reflection-entry-copy strong {
  font-size: 1.02rem;
}

.weekly-reflection-entry-copy small {
  line-height: 1.4;
  opacity: 0.62;
}

.weekly-reflection-entry-action {
  font-size: 0.8rem;
  font-weight: 700;
  opacity: 0.62;
  white-space: nowrap;
}

@media (max-width: 520px) {
  .weekly-reflection-entry-card {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .weekly-reflection-entry-action {
    margin-left: 3.45rem;
  }
}
`);

await replaceOnce(
  'scripts/e2e-live-pages.mjs',
  "  await cdp.send('Page.navigate', { url: liveUrl.toString() });",
  `  const reflectionUrl = new URL('reflection', liveUrl).toString();
  await cdp.send('Page.navigate', { url: reflectionUrl });
  await poll(
    cdp,
    "document.body.innerText.includes('Weekly reflection') && document.body.innerText.includes('Week rhythm') && Boolean(navigator.serviceWorker.controller)",
    'controlled direct live /reflection route',
  );

`,
);

await unlink('scripts/phase4-wire.mjs');
await unlink('.github/workflows/phase4-wire-reflection.yml');
