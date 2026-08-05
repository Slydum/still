import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertCloudUserCompatibility,
  chunkRows,
  collectPaginatedRows,
  createSingleFlight,
  mergeByKey,
} from '../../src/data/cloudSyncCore.js';

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

  it('uses latest-write-wins and lets deletion win timestamp ties', () => {
    const local = [{ id: 'one', updatedAt: 20, title: 'local' }];
    const remote = [{ id: 'one', updatedAt: 30, title: 'remote' }];
    const latest = mergeByKey(local, remote, (record) => record.id);
    assert.equal(latest[0].title, 'remote');

    const deletion = [{ id: 'one', updatedAt: 30, title: 'remote', deletedAt: 30 }];
    const tied = mergeByKey(remote, deletion, (record) => record.id);
    assert.equal(tied[0].deletedAt, 30);
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
    const firstRun = new Promise<void>((resolve) => {
      release = resolve;
    });

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
    try {
      await first;
    } catch {
      rejected = true;
    }
    assert.equal(rejected, true);

    const recovered = await synchronize();
    assert.equal(recovered, 'recovered');
    assert.equal(attempts, 2);
  });
});
