import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';

const bottomNavSource = fs.readFileSync('src/components/navigation/BottomNav.tsx', 'utf8');
const workHubEnhancementsSource = fs.readFileSync('src/theme/workHubEnhancements.ts', 'utf8');
const workHubSource = fs.readFileSync('src/features/work/WorkHubContent.tsx', 'utf8');
const workLiveTrackerSource = fs.readFileSync('src/features/work/WorkLiveTracker.tsx', 'utf8');

describe('frontend structure source regressions', () => {
  it('uses real links for route navigation while keeping Quick Add a button', () => {
    assert.ok(bottomNavSource.includes("import { Link, useLocation } from 'react-router-dom'"));
    assert.ok(bottomNavSource.includes('<Link'));
    assert.ok(bottomNavSource.includes('aria-label="Quick add"'));
    assert.equal(bottomNavSource.includes('useNavigate'), false);
  });

  it('keeps Work change-sheet styling outside TypeScript', () => {
    assert.equal(workHubEnhancementsSource.includes('style.textContent'), false);
  });

  it('isolates the one-second Work clock from the full Work hub', () => {
    assert.ok(workHubSource.includes('<WorkLiveTracker />'));
    assert.ok(workHubSource.includes('window.setInterval(refreshClock, 30_000)'));
    assert.equal(workHubSource.includes('activeShift ? 1000 : 30_000'), false);
    assert.ok(workLiveTrackerSource.includes('activeShift ? 1000 : 30_000'));
  });
});
