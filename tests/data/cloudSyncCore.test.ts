import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertCloudUserCompatibility,
  chunkRows,
  collectKeysetPaginatedRows,
  createSingleFlight,
  maxServerRevision,
  mergeByKey,
  runPullBoundSyncCycle,
} from '../../src/data/cloudSyncCore.js';

type MergeFixture = {
  id: string;
  syncCounter: number;
  mutationId: string;
  title: string;
  deletedAt?: number;
  serverRevision?: number;
  dirty?: boolean;
};

type RevisionFixture = {
  id: number;
  server_revision: number;
};

describe('cloud sync core', () => {
  it('batches large pushes without dropping records', () => {
    const rows = Array.from({ length: 501 }, (_, index) => index);
    const batches = chunkRows(rows, 250);

    assert.equal(batches.length, 3);
    assert.equal(batches[0].length, 250);
    assert.equal(batches[1].length, 250);
    assert.equal(batches[2].length, 1);
    assert.equal(batches.flat().length, 501);
  });

  it('keyset-paginates until the final partial page', async () => {
    const source: RevisionFixture[] = Array.from({ length: 1001 }, (_, index) => ({
      id: index + 1,
      server_revision: index + 1,
    }));
    const calls: number[] = [];
    const result = await collectKeysetPaginatedRows(async (afterCursor, pageSize) => {
      calls.push(afterCursor);
      return source
        .filter((row) => row.server_revision > afterCursor)
        .sort((left, right) => left.server_revision - right.server_revision)
        .slice(0, pageSize)
        .map((row) => ({ ...row }));
    }, 500, 0, (row) => row.server_revision);

    assert.equal(result.rows.length, 1001);
    assert.equal(result.cursor, 1001);
    assert.deepEqual(calls, [0, 500, 1000]);
  });

  it('does not skip a row when an earlier record is re-versioned between pull pages', async () => {
    const source: RevisionFixture[] = Array.from({ length: 1001 }, (_, index) => ({
      id: index + 1,
      server_revision: index + 1,
    }));
    const calls: number[] = [];

    const result = await collectKeysetPaginatedRows(async (afterCursor, pageSize) => {
      calls.push(afterCursor);
      const page = source
        .filter((row) => row.server_revision > afterCursor)
        .sort((left, right) => left.server_revision - right.server_revision)
        .slice(0, pageSize)
        .map((row) => ({ ...row }));

      if (calls.length === 1) source[0].server_revision = 1002;
      return page;
    }, 500, 0, (row) => row.server_revision);

    assert.equal(new Set(result.rows.map((row) => row.id)).size, 1001);
    assert.ok(result.rows.some((row) => row.id === 501));
    assert.equal(result.rows.length, 1002);
    assert.equal(result.cursor, 1002);
    assert.deepEqual(calls, [0, 500, 1000]);
  });

  it('keeps push acknowledgements from advancing the durable pull cursor past unseen revisions', async () => {
    const operations: string[] = [];
    let pullCount = 0;
    let pushCount = 0;

    const cursor = await runPullBoundSyncCycle(100, {
      push: async () => {
        pushCount += 1;
        operations.push(pushCount === 2 ? 'push:ack-revision-102' : 'push');
      },
      migrate: async () => {
        operations.push('migrate');
      },
      pullAndApply: async (pullCursor) => {
        pullCount += 1;
        operations.push(`pull:${pullCursor}`);
        if (pullCount === 1) return 100;

        // Another device wrote revision 101 before this client's second push
        // received revision 102. The final pull must still begin at 100 so 101
        // cannot fall permanently behind the saved cursor.
        assert.equal(pullCursor, 100);
        return 102;
      },
    });

    assert.equal(cursor, 102);
    assert.deepEqual(operations, [
      'push',
      'pull:100',
      'migrate',
      'push:ack-revision-102',
      'pull:100',
    ]);
  });

  it('uses logical counters instead of device clocks for conflict ordering', () => {
    const local: MergeFixture[] = [{ id: 'one', syncCounter: 2, mutationId: 'a', title: 'local' }];
    const remote: MergeFixture[] = [{ id: 'one', syncCounter: 3, mutationId: 'a', title: 'remote' }];
    const latest = mergeByKey(local, remote, (record) => record.id);
    assert.equal(latest[0].title, 'remote');
  });

  it('lets real cloud settings beat a pristine local placeholder', () => {
    const placeholder: MergeFixture[] = [{
      id: 'work',
      syncCounter: 0,
      mutationId: 'placeholder:work',
      title: 'default',
      dirty: false,
    }];
    const cloud: MergeFixture[] = [{
      id: 'work',
      syncCounter: 1,
      mutationId: 'remote-work',
      title: 'user value',
      dirty: false,
      serverRevision: 17,
    }];

    const merged = mergeByKey(placeholder, cloud, (record) => record.id);
    assert.equal(merged[0].title, 'user value');
    assert.equal(merged[0].serverRevision, 17);
  });

  it('resolves concurrent equal-counter writes deterministically by mutation id', () => {
    const left: MergeFixture[] = [{ id: 'one', syncCounter: 5, mutationId: 'device-a', title: 'left' }];
    const right: MergeFixture[] = [{ id: 'one', syncCounter: 5, mutationId: 'device-z', title: 'right' }];
    assert.equal(mergeByKey(left, right, (record) => record.id)[0].title, 'right');
    assert.equal(mergeByKey(right, left, (record) => record.id)[0].title, 'right');
  });

  it('lets an acknowledged server row clear dirty state on an exact version tie', () => {
    const local: MergeFixture[] = [{ id: 'one', syncCounter: 4, mutationId: 'same', title: 'value', dirty: true }];
    const acknowledged: MergeFixture[] = [{
      id: 'one', syncCounter: 4, mutationId: 'same', title: 'value', dirty: false, serverRevision: 42,
    }];
    const merged = mergeByKey(local, acknowledged, (record) => record.id);
    assert.equal(merged[0].dirty, false);
    assert.equal(merged[0].serverRevision, 42);
  });

  it('lets deletion win an otherwise exact logical-version tie', () => {
    const active: MergeFixture[] = [{ id: 'one', syncCounter: 4, mutationId: 'same', title: 'value' }];
    const deletion: MergeFixture[] = [{ id: 'one', syncCounter: 4, mutationId: 'same', title: 'value', deletedAt: 30 }];
    assert.equal(mergeByKey(active, deletion, (record) => record.id)[0].deletedAt, 30);
  });

  it('advances a server cursor only to the highest observed server revision', () => {
    assert.equal(maxServerRevision([{ server_revision: 12 }, { server_revision: 19 }], 8), 19);
    assert.equal(maxServerRevision([], 8), 8);
  });

  it('blocks a different account from reusing linked local data', () => {
    let error: unknown;
    try {
      assertCloudUserCompatibility('user-one', 'user-two');
    } catch (caught) {
      error = caught;
    }

    assert.ok(error instanceof Error);
    assert.ok((error as Error).message.includes('another Still account'));
  });

  it('deduplicates simultaneous syncs and recovers after a network failure', async () => {
    let attempts = 0;
    let release: (() => void) | undefined;
    const firstRun = new Promise<void>((resolve) => { release = resolve; });

    const synchronize = createSingleFlight(async () => {
      attempts += 1;
      if (attempts === 1) {
        await firstRun;
        throw new Error('offline');
      }
      return 'recovered';
    });

    const first = synchronize();
    const duplicate = synchronize();
    assert.ok(first === duplicate);
    release?.();

    let rejected = false;
    try { await first; } catch { rejected = true; }
    assert.equal(rejected, true);

    const recovered = await synchronize();
    assert.equal(recovered, 'recovered');
    assert.equal(attempts, 2);
  });

  it('reconciles an offline local edit after reconnect and preserves its acknowledgement', () => {
    const offlineLocal: MergeFixture[] = [{
      id: 'one',
      syncCounter: 8,
      mutationId: 'device-z-offline',
      title: 'edited offline',
      dirty: true,
    }];
    const staleCloud: MergeFixture[] = [{
      id: 'one',
      syncCounter: 7,
      mutationId: 'device-a-cloud',
      title: 'older cloud value',
      dirty: false,
      serverRevision: 50,
    }];

    const beforePush = mergeByKey(offlineLocal, staleCloud, (record) => record.id);
    assert.equal(beforePush[0].title, 'edited offline');
    assert.equal(beforePush[0].dirty, true);

    const acknowledgement: MergeFixture[] = [{
      ...offlineLocal[0],
      dirty: false,
      serverRevision: 51,
    }];
    const afterReconnect = mergeByKey(beforePush, acknowledgement, (record) => record.id);
    assert.equal(afterReconnect[0].title, 'edited offline');
    assert.equal(afterReconnect[0].dirty, false);
    assert.equal(afterReconnect[0].serverRevision, 51);
  });
});
