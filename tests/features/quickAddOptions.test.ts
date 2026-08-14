import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  lifeAreaIdFromPath,
  shouldOpenEventMoreOptions,
  shouldOpenTaskMoreOptions,
} from '../../src/components/ui/quick-add/quickAddOptions.js';

describe('Quick Add behavior', () => {
  it('keeps More options collapsed for new tasks and events', () => {
    assert.equal(shouldOpenTaskMoreOptions(), false);
    assert.equal(shouldOpenEventMoreOptions(), false);
  });

  it('opens task details only when an existing task has non-default details', () => {
    assert.equal(shouldOpenTaskMoreOptions({
      note: '',
      dueDate: '',
      repeat: 'none',
      priority: 'medium',
    }), false);
    assert.equal(shouldOpenTaskMoreOptions({
      note: '',
      dueDate: '2026-08-14',
      repeat: 'none',
      priority: 'medium',
    }), true);
  });

  it('opens event details only when an existing event has non-default details', () => {
    assert.equal(shouldOpenEventMoreOptions({
      note: '',
      repeat: 'none',
      category: 'personal',
      startDate: '2026-08-14',
      endDate: '2026-08-14',
    }), false);
    assert.equal(shouldOpenEventMoreOptions({
      note: '',
      repeat: 'none',
      category: 'work',
      startDate: '2026-08-14',
      endDate: '2026-08-14',
    }), true);
  });

  it('resolves dedicated, nested, and Life Area routes to the right context', () => {
    assert.equal(lifeAreaIdFromPath('/work'), 'work');
    assert.equal(lifeAreaIdFromPath('/work/details'), 'work');
    assert.equal(lifeAreaIdFromPath('/health'), 'health');
    assert.equal(lifeAreaIdFromPath('/money'), 'money');
    assert.equal(lifeAreaIdFromPath('/life/love'), 'love');
    assert.equal(lifeAreaIdFromPath('/calendar'), undefined);
  });
});
