import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  databaseNameForMode,
  DEMO_DATABASE_NAME,
  PRIMARY_DATABASE_NAME,
} from '../../src/app/demoMode.js';

describe('demo mode isolation', () => {
  it('uses a different IndexedDB database from the primary app', () => {
    assert.equal(databaseNameForMode(false), PRIMARY_DATABASE_NAME);
    assert.equal(databaseNameForMode(true), DEMO_DATABASE_NAME);
    assert.ok(DEMO_DATABASE_NAME !== PRIMARY_DATABASE_NAME);
  });
});
