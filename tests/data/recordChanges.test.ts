import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { diffCollectionChanges } from '../../src/data/repositories/recordChanges.js';

type Fixture = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

function fixture(id: string, updatedAt: number): Fixture {
  return { id, title: id, createdAt: 1, updatedAt };
}

describe('record-level repository changes', () => {
  it('persists only records that were explicitly changed', () => {
    const previous = [fixture('one', 10), fixture('two', 20)];
    const next = [fixture('one', 30), fixture('two', 20)];
    const changes = diffCollectionChanges(previous, next);

    assert.equal(changes.upserts.length, 1);
    assert.equal(changes.upserts[0].id, 'one');
    assert.equal(changes.deletedIds.length, 0);
  });

  it('creates a deletion only for a record removed from the current tab state', () => {
    const previous = [fixture('one', 10)];
    const changes = diffCollectionChanges(previous, []);

    assert.equal(changes.upserts.length, 0);
    assert.equal(changes.deletedIds.join(','), 'one');
  });

  it('does not infer deletion for records the current tab never observed', () => {
    const previous = [fixture('one', 10)];
    const next = [fixture('one', 20)];
    const changes = diffCollectionChanges(previous, next);

    assert.equal(changes.deletedIds.length, 0);
    assert.equal(changes.upserts[0].id, 'one');
  });
});
