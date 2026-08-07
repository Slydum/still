import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  enqueueRepositoryWrite,
  flushRepositoryWrites,
} from '../../src/data/repositoryWriteQueue.js';

describe('repository write queue', () => {
  it('waits for pending durable writes before resolving a flush', async () => {
    let releaseWrite: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { releaseWrite = resolve; });
    let completed = false;

    enqueueRepositoryWrite(async () => {
      await gate;
      completed = true;
    });

    let flushed = false;
    const flush = flushRepositoryWrites().then(() => { flushed = true; });
    await Promise.resolve();

    assert.equal(flushed, false);
    assert.equal(completed, false);

    releaseWrite();
    await flush;

    assert.equal(completed, true);
    assert.equal(flushed, true);
  });

  it('preserves write order', async () => {
    const order: number[] = [];

    enqueueRepositoryWrite(async () => { order.push(1); });
    enqueueRepositoryWrite(async () => { order.push(2); });
    enqueueRepositoryWrite(async () => { order.push(3); });

    await flushRepositoryWrites();
    assert.equal(order.join(','), '1,2,3');
  });

  it('surfaces the latest durable write failure until a later write succeeds', async () => {
    const expected = new Error('durable write failed');
    enqueueRepositoryWrite(async () => { throw expected; });

    let observed: unknown;
    try {
      await flushRepositoryWrites();
    } catch (error) {
      observed = error;
    }
    assert.equal(observed, expected);

    enqueueRepositoryWrite(async () => undefined);
    await flushRepositoryWrites();
    assert.ok(true);
  });
});
