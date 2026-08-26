import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  eventsToCsv,
  expensesToCsv,
  journalToMarkdown,
  rowsToCsv,
  serializeBackup,
  tasksToCsv,
} from '../../src/features/more/dataExport.js';

describe('Still data export', () => {
  it('quotes CSV fields without corrupting commas, quotes, or new lines', () => {
    assert.equal(rowsToCsv(['name', 'note'], [['A, B', 'He said "hi"\nthen left']]), 'name,note\n"A, B","He said ""hi""\nthen left"');
  });

  it('serializes a versioned full backup envelope', () => {
    const json = serializeBackup({
      tasks: [{ id: 'task-1' }], events: [], journalEntries: [], expenses: [], entityLinks: [], workShifts: [], checkIns: [], settings: [], notifications: [],
    }, '2026-08-27T00:00:00.000Z');
    const parsed = JSON.parse(json);
    assert.equal(parsed.format, 'still-backup');
    assert.equal(parsed.version, 1);
    assert.equal(parsed.exportedAt, '2026-08-27T00:00:00.000Z');
    assert.equal(parsed.records.tasks[0].id, 'task-1');
  });

  it('creates readable exports from ordinary records', () => {
    const now = Date.UTC(2026, 7, 27, 0, 0, 0);
    const taskCsv = tasksToCsv([{ id: 't1', title: 'Call dentist', priority: 'high', repeat: 'none', completed: false, createdAt: now, updatedAt: now }]);
    const eventCsv = eventsToCsv([{ id: 'e1', title: 'Dentist', category: 'health', startDate: '2026-08-28', endDate: '2026-08-28', allDay: false, startTime: '10:00', endTime: '11:00', repeat: 'none', createdAt: now, updatedAt: now }]);
    const moneyCsv = expensesToCsv([{ id: 'x1', title: 'Groceries', amount: 500, currency: 'PHP', expenseDate: '2026-08-27', createdAt: now, updatedAt: now }]);
    const markdown = journalToMarkdown([{ id: 'j1', title: 'A day', body: 'Quiet and good.', entryDate: '2026-08-27', tags: ['home'], createdAt: now, updatedAt: now }]);

    assert.ok(taskCsv.includes('Call dentist'));
    assert.ok(eventCsv.includes('2026-08-28'));
    assert.ok(moneyCsv.includes('Groceries'));
    assert.ok(markdown.includes('## A day'));
    assert.ok(markdown.includes('#home'));
  });
});
