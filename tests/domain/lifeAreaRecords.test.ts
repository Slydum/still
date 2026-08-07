import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { recordsForLifeArea } from '../../src/domain/lifeAreaRecords.js';

describe('Life Area record filtering', () => {
  const records = {
    tasks: [
      { id: 'task-work', areaId: 'work' as const },
      { id: 'task-health', areaId: 'health' as const },
      { id: 'task-unassigned' },
    ],
    events: [
      { id: 'event-love', category: 'love' as const },
      { id: 'event-health', category: 'personal' as const, areaId: 'health' as const },
      { id: 'event-personal', category: 'personal' as const },
    ],
    journalEntries: [
      { id: 'journal-love', areaId: 'love' as const },
      { id: 'journal-unassigned' },
    ],
    expenses: [
      { id: 'expense-default-money' },
      { id: 'expense-work', areaId: 'work' as const },
    ],
    workShifts: [
      { id: 'shift-1' },
    ],
  };

  it('uses the same deterministic ownership rules as Life Garden summaries', () => {
    const work = recordsForLifeArea('work', records);
    assert.deepEqual(work.tasks.map((record) => record.id), ['task-work']);
    assert.deepEqual(work.expenses.map((record) => record.id), ['expense-work']);
    assert.deepEqual(work.workShifts.map((record) => record.id), ['shift-1']);

    const love = recordsForLifeArea('love', records);
    assert.deepEqual(love.events.map((record) => record.id), ['event-love']);
    assert.deepEqual(love.journalEntries.map((record) => record.id), ['journal-love']);
    assert.equal(love.workShifts.length, 0);

    const health = recordsForLifeArea('health', records);
    assert.deepEqual(health.tasks.map((record) => record.id), ['task-health']);
    assert.deepEqual(health.events.map((record) => record.id), ['event-health']);

    const money = recordsForLifeArea('money', records);
    assert.deepEqual(money.expenses.map((record) => record.id), ['expense-default-money']);
  });

  it('does not infer a Life Area for personal or unassigned records', () => {
    const work = recordsForLifeArea('work', records);
    const health = recordsForLifeArea('health', records);
    const love = recordsForLifeArea('love', records);
    const money = recordsForLifeArea('money', records);

    const connectedIds = [work, health, love, money].flatMap((set) => [
      ...set.tasks.map((record) => record.id),
      ...set.events.map((record) => record.id),
      ...set.journalEntries.map((record) => record.id),
    ]);

    assert.equal(connectedIds.includes('task-unassigned'), false);
    assert.equal(connectedIds.includes('event-personal'), false);
    assert.equal(connectedIds.includes('journal-unassigned'), false);
  });
});
