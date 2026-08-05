import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  activeRecords,
  mergeSyncedRecords,
  reconcileCollection,
} from '../../src/data/repositories/reconcile.js';
import {
  LOCAL_DEVICE_USER_ID,
  PERMANENT_DATA_SCHEMA_VERSION,
  type SyncMetadata,
} from '../../src/data/repositories/types.js';

type RecordFixture = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

type SyncedFixture = RecordFixture & SyncMetadata;

function fixture(id: string, updatedAt: number): RecordFixture {
  return { id, title: `Record ${id}`, createdAt: 1, updatedAt };
}

describe('permanent data repository contract', () => {
  it('adds Supabase-ready metadata to active records', () => {
    const [record] = reconcileCollection([], [fixture('one', 10)], 20);

    assert.equal(record.id, 'one');
    assert.equal(record.userId, LOCAL_DEVICE_USER_ID);
    assert.equal(record.schemaVersion, PERMANENT_DATA_SCHEMA_VERSION);
    assert.equal(record.updatedAt, 10);
    assert.equal(record.deletedAt, undefined);
  });

  it('keeps removed records as tombstones instead of losing deletion history', () => {
    const existing = reconcileCollection([], [fixture('one', 10), fixture('two', 11)], 20);
    const next = reconcileCollection(existing, [fixture('two', 30)], 40);
    const removed = next.find((record) => record.id === 'one');
    const kept = next.find((record) => record.id === 'two');

    assert.equal(removed?.deletedAt, 40);
    assert.equal(removed?.updatedAt, 40);
    assert.equal(kept?.deletedAt, undefined);
    assert.equal(kept?.updatedAt, 30);
    assert.equal(activeRecords(next).length, 1);
  });

  it('resolves local and future remote changes by latest update and deletion', () => {
    const base: SyncedFixture = {
      ...fixture('one', 10),
      userId: 'user-1',
      schemaVersion: 1,
    };
    const newerRemote: SyncedFixture = { ...base, title: 'Remote', updatedAt: 30 };
    const olderLocal: SyncedFixture = { ...base, title: 'Local', updatedAt: 20 };
    const merged = mergeSyncedRecords([olderLocal], [newerRemote]);

    assert.equal(merged.length, 1);
    assert.equal(merged[0].title, 'Remote');

    const deletion: SyncedFixture = { ...newerRemote, deletedAt: 30 };
    const deletionWinsTie = mergeSyncedRecords([newerRemote], [deletion]);
    assert.equal(deletionWinsTie[0].deletedAt, 30);
  });
});
