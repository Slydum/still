import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const bottomNavSource = readFileSync('src/components/navigation/BottomNav.tsx', 'utf8');
const workHubFixesSource = readFileSync('src/theme/work-hub-fixes.ts', 'utf8');
const workHubSource = readFileSync('src/features/work/WorkHubPageOption1.tsx', 'utf8');
const workLiveTrackerSource = readFileSync('src/features/work/WorkLiveTracker.tsx', 'utf8');

describe('Phase 3 source regressions', () => {
  it('uses real links for route navigation while keeping Quick Add a button', () => {
    assert.ok(bottomNavSource.includes("import { Link, useLocation } from 'react-router-dom'"));
    assert.ok(bottomNavSource.includes('<Link'));
    assert.ok(bottomNavSource.includes('aria-label="Quick add"'));
    assert.equal(bottomNavSource.includes('useNavigate'), false);
  });

  it('does not inject Work change-sheet CSS from TypeScript', () => {
    assert.equal(workHubFixesSource.includes("document.createElement('style')"), false);
    assert.equal(workHubFixesSource.includes('style.textContent'), false);
  });

  it('isolates the one-second Work clock from the full Work hub', () => {
    assert.ok(workHubSource.includes('<WorkLiveTracker />'));
    assert.ok(workHubSource.includes('window.setInterval(refreshClock, 30_000)'));
    assert.equal(workHubSource.includes('activeShift ? 1000 : 30_000'), false);
    assert.ok(workLiveTrackerSource.includes('activeShift ? 1000 : 30_000'));
  });
});
