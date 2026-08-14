import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertCloudUserCompatibility,
  chunkRows,
  collectPaginatedRows,
  createSingleFlight,
  maxServerRevision,
  mergeByKey,
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

  it('paginates until the final partial page', async () => {
    const source = Array.from({ length: 1001 }, (_, index) => index);
    const calls: string[] = [];
    const rows = await collectPaginatedRows(async (from, to) => {
      calls.push(`${from}-${to}`);
      return source.slice(from, to + 1);
    }, 500);

    assert.equal(rows.length, 1001);
    assert.equal(calls.join(','), '0-499,500-999,1000-1499');
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
});
