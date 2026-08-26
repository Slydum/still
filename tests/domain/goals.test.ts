import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  goalConnections,
  goalFromEntry,
  goalJournalInput,
  goalRef,
  isGoalEntry,
} from '../../src/domain/goals.js';
import type { LifeEntityLink } from '../../src/domain/lifeAreas.js';
import type { JournalEntry } from '../../src/stores/useAppStore.js';

function goalEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 'goal-1',
    title: 'Finish certification',
    body: 'Build toward the exam without rushing it.',
    entryDate: '2026-08-27',
    tags: ['still-goal', 'goal-target:2026-10-01'],
    createdAt: 1,
    updatedAt: 2,
    areaId: 'work',
    ...overrides,
  };
}

describe('Goals domain', () => {
  it('round-trips a goal through the synced journal record shape', () => {
    const entry = goalEntry();
    assert.equal(isGoalEntry(entry), true);
    assert.deepEqual(goalFromEntry(entry), {
      id: 'goal-1',
      title: 'Finish certification',
      description: 'Build toward the exam without rushing it.',
      targetDate: '2026-10-01',
      areaId: 'work',
      completed: false,
      createdAt: 1,
      updatedAt: 2,
    });
  });

  it('keeps status and target date explicit in goal tags', () => {
    const input = goalJournalInput({
      title: 'Move out',
      description: 'Prepare calmly.',
      targetDate: '2027-01-15',
      areaId: 'money',
      completed: true,
    }, '2026-08-27');
    assert.equal(input.body, 'Prepare calmly.');
    assert.equal(input.areaId, 'money');
    assert.ok(input.tags.includes('still-goal'));
    assert.ok(input.tags.includes('goal-completed'));
    assert.ok(input.tags.includes('goal-target:2027-01-15'));
  });

  it('finds connected records regardless of link direction', () => {
    const links: LifeEntityLink[] = [
      { id: 'a', from: goalRef('goal-1'), to: { kind: 'task', id: 'task-1' }, type: 'contributes-to', createdAt: 1 },
      { id: 'b', from: { kind: 'journal', id: 'journal-1' }, to: goalRef('goal-1'), type: 'related', createdAt: 2 },
      { id: 'c', from: goalRef('goal-2'), to: { kind: 'task', id: 'task-2' }, type: 'contributes-to', createdAt: 3 },
    ];
    assert.deepEqual(goalConnections('goal-1', links).map((item) => `${item.ref.kind}:${item.ref.id}`), ['task:task-1', 'journal:journal-1']);
  });
});
