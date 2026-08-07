import type { WorkShift } from './work';

export type RepeatCadence = 'daily' | 'weekly' | 'monthly';

type CivilDate = { year: number; month: number; day: number };

function parseDateKey(dateKey: string): CivilDate | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return undefined;
  return { year, month, day };
}

function dateKeyFromUtc(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function nextRecurringDate(dateKey: string, cadence: RepeatCadence) {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return dateKey;

  if (cadence === 'daily' || cadence === 'weekly') {
    const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
    date.setUTCDate(date.getUTCDate() + (cadence === 'daily' ? 1 : 7));
    return dateKeyFromUtc(date);
  }

  const nextMonthIndex = parsed.month;
  const nextYear = parsed.year + Math.floor(nextMonthIndex / 12);
  const nextMonth = (nextMonthIndex % 12) + 1;
  const clampedDay = Math.min(parsed.day, daysInMonth(nextYear, nextMonth));
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

export function normalizeTimedRange(
  startDate: string,
  endDate: string,
  startTime: string,
  endTime: string,
) {
  if (endDate === startDate && endTime < startTime) {
    return { startTime, endTime: startTime };
  }
  return { startTime, endTime };
}

export function normalizeFiniteMoney(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.max(0, value);
}

export type VersionedWorkShift = WorkShift & {
  createdAt?: number;
  updatedAt?: number;
};

export function ensureWorkShiftTimestamps<T extends VersionedWorkShift>(shift: T): T & { createdAt: number; updatedAt: number } {
  const createdAt = Number.isFinite(shift.createdAt) ? shift.createdAt! : shift.startedAt;
  const updatedAt = Number.isFinite(shift.updatedAt)
    ? shift.updatedAt!
    : (shift.endedAt ?? shift.startedAt);
  return { ...shift, createdAt, updatedAt };
}

export function touchWorkShift<T extends VersionedWorkShift>(shift: T, now = Date.now()) {
  const versioned = ensureWorkShiftTimestamps(shift);
  return { ...versioned, updatedAt: Math.max(now, versioned.updatedAt + 1) };
}
