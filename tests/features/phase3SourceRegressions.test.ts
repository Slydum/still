import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const bottomNavSource = readFileSync('src/components/navigation/BottomNav.tsx', 'utf8');
const workHubFixesSource = readFileSync('src/theme/work-hub-fixes.ts', 'utf8');

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
});
