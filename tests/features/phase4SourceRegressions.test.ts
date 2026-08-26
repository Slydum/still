import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';

const read = (path: string) => fs.readFileSync(path, 'utf8');

describe('Phase 4 trust and polish contracts', () => {
  it('keeps portable exports discoverable from Settings', () => {
    const settingsRoute = read('src/features/more/MoreSettingsPage.tsx');
    const exportPanel = read('src/features/more/DataExportPanel.tsx');
    assert.ok(settingsRoute.includes('<DataExportPanel />'));
    assert.ok(exportPanel.includes('Complete JSON backup'));
    assert.ok(exportPanel.includes('Tasks CSV'));
    assert.ok(exportPanel.includes('Journal Markdown'));
  });

  it('keeps onboarding progressive rather than mandatory', () => {
    const guide = read('src/features/onboarding/FirstWeekGuide.tsx');
    assert.ok(guide.includes('still-first-week-guide-v1'));
    assert.ok(guide.includes('establishedRecordCount >= 6'));
    assert.ok(guide.includes('Dismiss first-week guide'));
    assert.ok(guide.includes("day: 0"));
    assert.ok(guide.includes("day: 2"));
  });

  it('keeps search filterable and keyboard navigation skippable', () => {
    const search = read('src/features/search/SearchPage.tsx');
    const app = read('src/app/App.tsx');
    const accessibility = read('src/theme/accessibility.css');
    assert.ok(search.includes('Filter search results by type'));
    assert.ok(search.includes('setKindFilter'));
    assert.ok(app.includes('Skip to content'));
    assert.ok(accessibility.includes('@media (pointer: coarse)'));
    assert.ok(accessibility.includes('@media (prefers-reduced-motion: reduce)'));
  });
});
