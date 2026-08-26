import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('Phase 4 trust and polish contracts', () => {
  it('keeps portable exports discoverable from Settings', async () => {
    const settingsRoute = await read('src/features/more/MoreSettingsPage.tsx');
    const exportPanel = await read('src/features/more/DataExportPanel.tsx');
    assert.ok(settingsRoute.includes('<DataExportPanel />'));
    assert.ok(exportPanel.includes('Complete JSON backup'));
    assert.ok(exportPanel.includes('Tasks CSV'));
    assert.ok(exportPanel.includes('Journal Markdown'));
  });

  it('keeps onboarding progressive rather than mandatory', async () => {
    const guide = await read('src/features/onboarding/FirstWeekGuide.tsx');
    assert.ok(guide.includes('still-first-week-guide-v1'));
    assert.ok(guide.includes('establishedRecordCount >= 6'));
    assert.ok(guide.includes('Dismiss first-week guide'));
    assert.ok(guide.includes("day: 0"));
    assert.ok(guide.includes("day: 2"));
  });

  it('keeps search filterable and keyboard navigation skippable', async () => {
    const search = await read('src/features/search/SearchPage.tsx');
    const app = await read('src/app/App.tsx');
    const accessibility = await read('src/theme/accessibility.css');
    assert.ok(search.includes('Filter search results by type'));
    assert.ok(search.includes('setKindFilter'));
    assert.ok(app.includes('Skip to content'));
    assert.ok(accessibility.includes('@media (pointer: coarse)'));
    assert.ok(accessibility.includes('@media (prefers-reduced-motion: reduce)'));
  });
});
