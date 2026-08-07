import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildWeeklyReflection, getWeekWindow } from '../../src/domain/weeklyReflection.js';

function atLocalNoon(date: string) {
  return new Date(`${date}T12:00:00`).getTime();
}

describe('weekly reflection', () => {
  it('uses Monday through Sunday for the selected week', () => {
    const window = getWeekWindow('2026-08-08');
    assert.equal(window.startDate, '2026-08-03');
    assert.equal(window.endDate, '2026-08-09');
  });

  it('summarizes only records that belong to the selected week', () => {
    const reflection = buildWeeklyReflection({
      anchorDate: '2026-08-08',
      tasks: [
        { id: 'task-1', completedAt: atLocalNoon('2026-08-04'), areaId: 'work' },
        { id: 'task-old', completedAt: atLocalNoon('2026-08-02'), areaId: 'love' },
        { id: 'task-open', areaId: 'health' },
      ],
      events: [
        { id: 'event-1', date: '2026-08-05', areaId: 'love' },
        { id: 'event-old', date: '2026-08-01', areaId: 'work' },
      ],
      journalEntries: [
        { id: 'journal-1', entryDate: '2026-08-06', areaId: 'health' },
      ],
      expenses: [
        { id: 'expense-1', expenseDate: '2026-08-07', amount: 12.5, currency: 'USD' },
        { id: 'expense-work', expenseDate: '2026-08-08', amount: 4, currency: 'USD', areaId: 'work' },
      ],
      workShifts: [
        { id: 'shift-1', startedAt: atLocalNoon('2026-08-03') },
      ],
      checkIns: [
        { date: '2026-08-03', mood: 3, energy: 2 },
        { date: '2026-08-07', mood: 5, energy: 4 },
        { date: '2026-08-02', mood: 1, energy: 1 },
      ],
    });

    assert.equal(reflection.completedTasks, 1);
    assert.equal(reflection.events, 1);
    assert.equal(reflection.reflections, 1);
    assert.equal(reflection.expenses, 2);
    assert.equal(reflection.shifts, 1);
    assert.equal(reflection.checkIns, 2);
    assert.equal(reflection.moodAverage, 4);
    assert.equal(reflection.energyAverage, 3);
    assert.equal(reflection.currencyTotals.length, 1);
    assert.equal(reflection.currencyTotals[0].currency, 'USD');
    assert.equal(reflection.currencyTotals[0].amount, 16.5);
    assert.equal(reflection.currencyTotals[0].count, 2);
    assert.equal(reflection.areaActivity.work, 3);
    assert.equal(reflection.areaActivity.love, 1);
    assert.equal(reflection.areaActivity.health, 1);
    assert.equal(reflection.areaActivity.money, 1);
    assert.equal(reflection.totalActivity, 8);
    assert.equal(reflection.activeDays, 6);
  });

  it('keeps Life Area activity factual and does not infer from check-ins', () => {
    const reflection = buildWeeklyReflection({
      anchorDate: '2026-08-08',
      tasks: [],
      events: [],
      journalEntries: [],
      expenses: [{ id: 'expense', expenseDate: '2026-08-04', currency: 'PHP' }],
      workShifts: [],
      checkIns: [{ date: '2026-08-04', mood: 1, energy: 1 }],
    });

    assert.equal(reflection.areaActivity.money, 1);
    assert.equal(reflection.areaActivity.health, 0);
    assert.equal(reflection.areaActivity.love, 0);
    assert.equal(reflection.areaActivity.work, 0);
  });

  it('returns a quiet empty reflection when the week has no records', () => {
    const reflection = buildWeeklyReflection({
      anchorDate: '2026-08-08',
      tasks: [],
      events: [],
      journalEntries: [],
      expenses: [],
      workShifts: [],
      checkIns: [],
    });

    assert.equal(reflection.totalActivity, 0);
    assert.equal(reflection.activeDays, 0);
    assert.equal(reflection.highlights.length, 0);
    assert.equal(reflection.moodAverage, undefined);
    assert.equal(reflection.energyAverage, undefined);
  });
});
