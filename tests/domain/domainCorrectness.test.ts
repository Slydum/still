import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ensureWorkShiftTimestamps,
  nextRecurringDate,
  normalizeFiniteMoney,
  normalizeTimedRange,
  touchWorkShift,
} from '../../src/domain/domainCorrectness.js';

describe('domain correctness helpers', () => {
  it('clamps monthly recurrence to the last valid day', () => {
    assert.equal(nextRecurringDate('2025-01-31', 'monthly'), '2025-02-28');
    assert.equal(nextRecurringDate('2024-01-31', 'monthly'), '2024-02-29');
    assert.equal(nextRecurringDate('2025-03-31', 'monthly'), '2025-04-30');
    assert.equal(nextRecurringDate('2025-12-31', 'monthly'), '2026-01-31');
  });

  it('keeps daily and weekly recurrence on civil calendar dates', () => {
    assert.equal(nextRecurringDate('2025-12-31', 'daily'), '2026-01-01');
    assert.equal(nextRecurringDate('2025-12-28', 'weekly'), '2026-01-04');
  });

  it('prevents a same-day timed event from ending before it starts', () => {
    assert.deepEqual(normalizeTimedRange('2026-08-07', '2026-08-07', '16:00', '15:00'), {
      startTime: '16:00',
      endTime: '16:00',
    });
    assert.deepEqual(normalizeTimedRange('2026-08-07', '2026-08-08', '16:00', '01:00'), {
      startTime: '16:00',
      endTime: '01:00',
    });
  });

  it('rejects non-finite money values and clamps negative amounts', () => {
    assert.equal(normalizeFiniteMoney(undefined), undefined);
    assert.equal(normalizeFiniteMoney(Number.NaN), undefined);
    assert.equal(normalizeFiniteMoney(Number.POSITIVE_INFINITY), undefined);
    assert.equal(normalizeFiniteMoney(Number.NEGATIVE_INFINITY), undefined);
    assert.equal(normalizeFiniteMoney(-20), 0);
    assert.equal(normalizeFiniteMoney(12.5), 12.5);
  });

  it('gives legacy work shifts deterministic timestamps and strictly advances updates', () => {
    const legacy = ensureWorkShiftTimestamps({
      id: 'shift-1',
      startedAt: 100,
      endedAt: 500,
      unpaidBreakMinutes: 0,
    });
    assert.equal(legacy.createdAt, 100);
    assert.equal(legacy.updatedAt, 500);

    const touched = touchWorkShift(legacy, 500);
    assert.equal(touched.createdAt, 100);
    assert.equal(touched.updatedAt, 501);
  });
});
