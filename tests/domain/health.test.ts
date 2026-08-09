import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  healthNoteKind,
  healthNoteTags,
  normalizeOptionalHealthNumber,
  routineCadenceLabel,
  routineCompletedForDate,
  type HealthRoutine,
} from '../../src/domain/health.js';

function routine(overrides: Partial<HealthRoutine> = {}): HealthRoutine {
  return {
    id: 'routine-1',
    title: 'Stretch',
    cadence: 'daily',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe('Health domain', () => {
  it('treats daily routines as complete only on the saved day', () => {
    const record = routine({ lastCompletedDate: '2026-08-09' });
    assert.equal(routineCompletedForDate(record, '2026-08-09'), true);
    assert.equal(routineCompletedForDate(record, '2026-08-10'), false);
  });

  it('treats weekly routines as complete within the same Monday-based week', () => {
    const record = routine({ cadence: 'weekly', lastCompletedDate: '2026-08-05' });
    assert.equal(routineCompletedForDate(record, '2026-08-09'), true);
    assert.equal(routineCompletedForDate(record, '2026-08-10'), false);
    assert.equal(routineCadenceLabel('weekly'), 'Weekly');
  });

  it('round-trips Health note kinds through tags', () => {
    assert.equal(healthNoteKind(healthNoteTags('symptom')), 'symptom');
    assert.equal(healthNoteKind(healthNoteTags('appointment')), 'appointment');
    assert.equal(healthNoteKind(['health-note']), 'note');
  });

  it('normalizes optional observation values without creating targets', () => {
    assert.equal(normalizeOptionalHealthNumber(undefined, 24), undefined);
    assert.equal(normalizeOptionalHealthNumber(Number.NaN, 24), undefined);
    assert.equal(normalizeOptionalHealthNumber(-2, 24), 0);
    assert.equal(normalizeOptionalHealthNumber(30, 24), 24);
    assert.equal(normalizeOptionalHealthNumber(7.5, 24), 7.5);
  });
});
