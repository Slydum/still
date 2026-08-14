import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_WORK_PROFILE,
  nextPayday,
  normalizedWorkSchedule,
  payPeriodEstimate,
  shiftEarnings,
  shiftEarningsInRange,
  workedHours,
  workedHoursInRange,
  type WorkProfile,
  type WorkShift,
} from '../../src/domain/work.js';

function assertClose(actual: number, expected: number, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `Expected ${actual} to be within ${tolerance} of ${expected}`);
}

describe('work domain calculations', () => {
  const hourlyProfile: WorkProfile = {
    ...DEFAULT_WORK_PROFILE,
    hourlyRate: 20,
    overtimeAfterHours: 8,
    overtimeMultiplier: 1.5,
  };

  it('subtracts configured unpaid breaks from completed shifts', () => {
    const shift: WorkShift = {
      id: 'shift-1',
      startedAt: Date.parse('2026-08-03T09:00:00Z'),
      endedAt: Date.parse('2026-08-03T17:00:00Z'),
      unpaidBreakMinutes: 60,
    };

    assert.equal(workedHours(shift), 7);
  });

  it('applies overtime multiplier after the configured threshold', () => {
    const shift: WorkShift = {
      id: 'shift-2',
      startedAt: Date.parse('2026-08-03T08:00:00Z'),
      endedAt: Date.parse('2026-08-03T19:00:00Z'),
      unpaidBreakMinutes: 60,
    };

    assert.equal(shiftEarnings(shift, hourlyProfile), 220);
  });

  it('counts the portion of an overnight shift that overlaps today', () => {
    const shift: WorkShift = {
      id: 'shift-overnight',
      startedAt: Date.parse('2026-08-13T23:00:00Z'),
      endedAt: Date.parse('2026-08-14T07:00:00Z'),
      unpaidBreakMinutes: 60,
    };
    const todayStart = Date.parse('2026-08-14T00:00:00Z');
    const todayEnd = Date.parse('2026-08-15T00:00:00Z');

    assert.equal(workedHours(shift), 7);
    assertClose(workedHoursInRange(shift, todayStart, todayEnd), 6.125);
    assertClose(shiftEarningsInRange(shift, hourlyProfile, todayStart, todayEnd), 122.5);
  });

  it('range splits add back up to the full shift totals', () => {
    const shift: WorkShift = {
      id: 'shift-split',
      startedAt: Date.parse('2026-08-13T22:00:00Z'),
      endedAt: Date.parse('2026-08-14T10:00:00Z'),
      unpaidBreakMinutes: 60,
    };
    const midnight = Date.parse('2026-08-14T00:00:00Z');
    const end = Date.parse('2026-08-14T10:00:00Z');

    const splitHours = workedHoursInRange(shift, shift.startedAt, midnight)
      + workedHoursInRange(shift, midnight, end);
    const splitEarnings = shiftEarningsInRange(shift, hourlyProfile, shift.startedAt, midnight)
      + shiftEarningsInRange(shift, hourlyProfile, midnight, end);

    assertClose(splitHours, workedHours(shift));
    assertClose(splitEarnings, shiftEarnings(shift, hourlyProfile));
  });

  it('estimates salaried semimonthly pay periods', () => {
    const profile: WorkProfile = {
      ...DEFAULT_WORK_PROFILE,
      payType: 'salary',
      annualSalary: 72_000,
      payFrequency: 'semimonthly',
    };

    assert.equal(payPeriodEstimate(profile), 3_000);
  });

  it('advances anchored biweekly paydays until they are not in the past', () => {
    const profile: WorkProfile = {
      ...DEFAULT_WORK_PROFILE,
      nextPaydayDate: '2026-08-07',
      payFrequency: 'biweekly',
    };

    assert.equal(nextPayday(profile, new Date('2026-08-20T00:00:00Z')).toISOString().slice(0, 10), '2026-08-21');
  });

  it('normalizes legacy regular days into a full weekly schedule', () => {
    const profile: WorkProfile = {
      ...DEFAULT_WORK_PROFILE,
      regularDays: [1, 3],
      shiftStart: '10:00',
      shiftEnd: '15:00',
      weeklySchedule: undefined,
    };

    const schedule = normalizedWorkSchedule(profile);

    assert.equal(schedule.length, 7);
    assert.ok(schedule.find((day) => day.day === 1)?.enabled);
    assert.equal(schedule.find((day) => day.day === 1)?.start, '10:00');
    assert.equal(schedule.find((day) => day.day === 2)?.enabled, false);
  });
});
