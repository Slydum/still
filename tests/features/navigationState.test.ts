import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isNavCurrentPage,
  isNavSectionActive,
} from '../../src/components/navigation/navigationState.js';

describe('primary navigation state', () => {
  it('keeps Home visually active for mobile section descendants without claiming aria-current', () => {
    for (const pathname of ['/money', '/health', '/notifications', '/work/details']) {
      assert.equal(isNavSectionActive('/', pathname, false), true);
      assert.equal(isNavCurrentPage('/', pathname), false);
    }
  });

  it('marks only the exact link target as the current page', () => {
    assert.equal(isNavCurrentPage('/', '/'), true);
    assert.equal(isNavCurrentPage('/work', '/work'), true);
    assert.equal(isNavCurrentPage('/work', '/work/details'), false);
    assert.equal(isNavCurrentPage('/more', '/more'), true);
  });

  it('keeps desktop Work highlighted across Work descendants', () => {
    assert.equal(isNavSectionActive('/work', '/work/details', true), true);
    assert.equal(isNavCurrentPage('/work', '/work/details'), false);
  });
});
