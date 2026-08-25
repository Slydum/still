import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createSyncOutboxRecord,
  syncOutboxKey,
  syncOutboxRecordForDirtyRow,
} from '../../src/data/syncOutboxCore.js';

describe('sync outbox core', () => {
  it('deduplicates repeated mutations by stable source and record identity', () => {
    const first = createSyncOutboxRecord('tasks', 'task-1', 100);
    const later = createSyncOutboxRecord('tasks', 'task-1', 200);

    assert.equal(first.key, 'tasks:task-1');
    assert.equal(later.key, first.key);
    assert.equal(later.enqueuedAt, 200);
  });

  it('keeps identical record ids distinct across sync sources', () => {
    assert.ok(
      syncOutboxKey('tasks', 'shared-id') !== syncOutboxKey('events', 'shared-id'),
    );
  });

  it('queues only dirty rows and uses their durable update time', () => {
    const dirty = syncOutboxRecordForDirtyRow('checkIns', {
      date: '2026-08-25',
      updatedAt: 1234,
      dirty: true,
    }, 'date', 9999);
    const clean = syncOutboxRecordForDirtyRow('checkIns', {
      date: '2026-08-25',
      updatedAt: 1234,
      dirty: false,
    }, 'date', 9999);

    assert.deepEqual(dirty, {
      key: 'checkIns:2026-08-25',
      source: 'checkIns',
      recordId: '2026-08-25',
      enqueuedAt: 1234,
    });
    assert.equal(clean, undefined);
  });
});
