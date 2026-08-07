import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildLifeGardenSummaries } from '../../src/domain/lifeGarden.js';

describe('Life Garden summaries', () => {
  it('counts only records actually connected to each life area', () => {
    const summaries = buildLifeGardenSummaries({
      tasks: [
        { areaId: 'work' },
        { areaId: 'health' },
        {},
      ],
      events: [
        { category: 'love' },
        { category: 'personal', areaId: 'health' },
        { category: 'personal' },
      ],
      journalEntries: [
        { areaId: 'love' },
        {},
      ],
      expenses: [
        {},
        { areaId: 'work' },
      ],
      workShifts: [
        { id: 'shift-1', startedAt: 100, unpaidBreakMinutes: 30 },
      ],
    });

    assert.equal(summaries.work.recordCount, 3);
    assert.equal(summaries.work.detail, '1 task · 1 expense');
    assert.equal(summaries.love.recordCount, 2);
    assert.equal(summaries.love.detail, '1 event · 1 reflection');
    assert.equal(summaries.health.recordCount, 2);
    assert.equal(summaries.health.detail, '1 task · 1 event');
    assert.equal(summaries.money.recordCount, 1);
    assert.equal(summaries.money.detail, '1 expense');
  });

  it('treats uncategorized expenses as Money and personal events as unconnected', () => {
    const summaries = buildLifeGardenSummaries({
      tasks: [],
      events: [{ category: 'personal' }],
      journalEntries: [],
      expenses: [{}, {}],
      workShifts: [],
    });

    assert.equal(summaries.money.recordCount, 2);
    assert.equal(summaries.money.detail, '2 expenses');
    assert.equal(summaries.love.recordCount, 0);
    assert.equal(summaries.health.recordCount, 0);
    assert.equal(summaries.love.detail, 'No connected records yet');
  });

  it('reports Work shifts without pretending they belong to another area', () => {
    const summaries = buildLifeGardenSummaries({
      tasks: [],
      events: [],
      journalEntries: [],
      expenses: [],
      workShifts: [
        { id: 'shift-1', startedAt: 100, unpaidBreakMinutes: 0 },
        { id: 'shift-2', startedAt: 200, unpaidBreakMinutes: 0 },
      ],
    });

    assert.equal(summaries.work.recordCount, 2);
    assert.equal(summaries.work.detail, '2 shifts');
    assert.equal(summaries.money.recordCount, 0);
  });
});
