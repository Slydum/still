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

function synced(record: RecordFixture, metadata: Partial<SyncMetadata> = {}): SyncedFixture {
  return {
    ...record,
    userId: 'user-1',
    schemaVersion: 1,
    syncCounter: 1,
    mutationId: 'base',
    dirty: false,
    ...metadata,
  };
}

describe('permanent data repository contract', () => {
  it('adds sync metadata and marks new records dirty', () => {
    const [record] = reconcileCollection([], [fixture('one', 10)], 20);

    assert.equal(record.id, 'one');
    assert.equal(record.userId, LOCAL_DEVICE_USER_ID);
    assert.equal(record.schemaVersion, PERMANENT_DATA_SCHEMA_VERSION);
    assert.equal(record.updatedAt, 10);
    assert.equal(record.deletedAt, undefined);
    assert.equal(record.syncCounter, 1);
    assert.equal(record.dirty, true);
    assert.ok(Boolean(record.mutationId));
  });

  it('increments logical revisions for edits and tombstones', () => {
    const existing = reconcileCollection([], [fixture('one', 10), fixture('two', 11)], 20);
    const next = reconcileCollection(existing, [fixture('two', 30)], 40);
    const removed = next.find((record) => record.id === 'one');
    const kept = next.find((record) => record.id === 'two');

    assert.equal(removed?.deletedAt, 40);
    assert.equal(removed?.syncCounter, 2);
    assert.equal(removed?.dirty, true);
    assert.equal(kept?.deletedAt, undefined);
    assert.equal(kept?.updatedAt, 30);
    assert.equal(kept?.syncCounter, 2);
    assert.equal(activeRecords(next).length, 1);
  });

  it('resolves changes by logical revision independent of updatedAt clock skew', () => {
    const futureClockLocal = synced(fixture('one', 9_999_999), {
      syncCounter: 2,
      mutationId: 'a',
    });
    const normalClockRemote = synced({ ...fixture('one', 30), title: 'Remote' }, {
      syncCounter: 3,
      mutationId: 'b',
    });
    const merged = mergeSyncedRecords([futureClockLocal], [normalClockRemote]);

    assert.equal(merged.length, 1);
    assert.equal(merged[0].title, 'Remote');
  });

  it('resolves concurrent equal-counter writes deterministically', () => {
    const left = synced({ ...fixture('one', 20), title: 'Left' }, { syncCounter: 5, mutationId: 'alpha' });
    const right = synced({ ...fixture('one', 20), title: 'Right' }, { syncCounter: 5, mutationId: 'omega' });

    assert.equal(mergeSyncedRecords([left], [right])[0].title, 'Right');
    assert.equal(mergeSyncedRecords([right], [left])[0].title, 'Right');
  });
});
