import type { LifeEntityRef } from './lifeAreas';

export type WorkPayType = 'hourly' | 'salary';
export type WorkPayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

export type WorkScheduleDay = {
  day: number;
  enabled: boolean;
  start: string;
  end: string;
};

export type WorkScheduleOverride = {
  date: string;
  enabled: boolean;
  start: string;
  end: string;
};

export type WorkProfile = {
  payType: WorkPayType;
  currency: string;
  hourlyRate: number;
  annualSalary: number;
  payFrequency: WorkPayFrequency;
  weeklyHours: number;
  regularDays: number[];
  shiftStart: string;
  shiftEnd: string;
  weeklySchedule?: WorkScheduleDay[];
  scheduleOverrides?: WorkScheduleOverride[];
  nextPaydayDate?: string;
  payPeriodStartDate?: string;
  payPeriodEndDate?: string;
  unpaidBreakMinutes: number;
  overtimeAfterHours: number;
  overtimeMultiplier: number;
};

export type WorkShift = {
  id: string;
  startedAt: number;
  endedAt?: number;
  unpaidBreakMinutes: number;
  expectedEarnings?: number;
  breakStartedAt?: number;
  recordedBreakMs?: number;
  note?: string;
  links?: LifeEntityRef[];
  createdAt?: number;
  updatedAt?: number;
};

export type WorkShiftInput = {
  startedAt: number;
  endedAt: number;
  unpaidBreakMinutes: number;
  note?: string;
};

export const DEFAULT_WORK_SCHEDULE: WorkScheduleDay[] = [
  { day: 1, enabled: true, start: '09:00', end: '17:00' },
  { day: 2, enabled: true, start: '09:00', end: '17:00' },
  { day: 3, enabled: true, start: '09:00', end: '17:00' },
  { day: 4, enabled: true, start: '09:00', end: '17:00' },
  { day: 5, enabled: true, start: '09:00', end: '17:00' },
  { day: 6, enabled: false, start: '09:00', end: '17:00' },
  { day: 0, enabled: false, start: '09:00', end: '17:00' },
];

export const DEFAULT_WORK_PROFILE: WorkProfile = {
  payType: 'hourly',
  currency: 'PHP',
  hourlyRate: 0,
  annualSalary: 0,
  payFrequency: 'biweekly',
  weeklyHours: 40,
  regularDays: [1, 2, 3, 4, 5],
  shiftStart: '09:00',
  shiftEnd: '17:00',
  weeklySchedule: DEFAULT_WORK_SCHEDULE,
  scheduleOverrides: [],
  unpaidBreakMinutes: 60,
  overtimeAfterHours: 8,
  overtimeMultiplier: 1.5,
};

export function normalizedWorkSchedule(profile: WorkProfile) {
  if (profile.weeklySchedule?.length === 7) return profile.weeklySchedule;
  return DEFAULT_WORK_SCHEDULE.map((item) => ({
    ...item,
    enabled: profile.regularDays.includes(item.day),
    start: profile.shiftStart,
    end: profile.shiftEnd,
  }));
}

export function effectiveHourlyRate(profile: WorkProfile) {
  if (profile.payType === 'hourly') return Math.max(0, profile.hourlyRate);
  return Math.max(0, profile.annualSalary) / (52 * Math.max(1, profile.weeklyHours));
}

export function workedHours(shift: WorkShift, now = Date.now()) {
  const elapsedMs = Math.max(0, (shift.endedAt ?? now) - shift.startedAt);
  const activeBreakMs = shift.breakStartedAt
    ? Math.max(0, (shift.endedAt ?? now) - shift.breakStartedAt)
    : 0;
  const recordedBreakMs = Math.max(0, shift.recordedBreakMs ?? 0) + activeBreakMs;
  const breakMs = shift.endedAt
    ? Math.max(recordedBreakMs, shift.unpaidBreakMinutes * 60_000)
    : recordedBreakMs;
  return Math.max(0, (elapsedMs - breakMs) / 3_600_000);
}

export function overtimeHours(shift: WorkShift, profile: WorkProfile, now = Date.now()) {
  return Math.max(0, workedHours(shift, now) - Math.max(0, profile.overtimeAfterHours));
}

export function shiftEarnings(shift: WorkShift, profile: WorkProfile, now = Date.now()) {
  const hours = workedHours(shift, now);
  const rate = effectiveHourlyRate(profile);
  const regularHours = Math.min(hours, Math.max(0, profile.overtimeAfterHours));
  const extraHours = Math.max(0, hours - regularHours);
  return regularHours * rate + extraHours * rate * Math.max(1, profile.overtimeMultiplier);
}

export function payPeriodEstimate(profile: WorkProfile) {
  if (profile.payType === 'salary') {
    const divisor = profile.payFrequency === 'weekly'
      ? 52
      : profile.payFrequency === 'biweekly'
        ? 26
        : profile.payFrequency === 'semimonthly'
          ? 24
          : 12;
    return Math.max(0, profile.annualSalary) / divisor;
  }

  const weekly = effectiveHourlyRate(profile) * Math.max(0, profile.weeklyHours);
  if (profile.payFrequency === 'weekly') return weekly;
  if (profile.payFrequency === 'biweekly') return weekly * 2;
  if (profile.payFrequency === 'semimonthly') return weekly * 52 / 24;
  return weekly * 52 / 12;
}

export function nextPayday(profile: WorkProfile, from = new Date()) {
  if (profile.nextPaydayDate) {
    const anchor = new Date(`${profile.nextPaydayDate}T12:00:00`);
    if (!Number.isNaN(anchor.getTime())) {
      while (anchor < from) {
        if (profile.payFrequency === 'weekly') anchor.setDate(anchor.getDate() + 7);
        else if (profile.payFrequency === 'biweekly') anchor.setDate(anchor.getDate() + 14);
        else if (profile.payFrequency === 'semimonthly') anchor.setDate(anchor.getDate() + 15);
        else anchor.setMonth(anchor.getMonth() + 1);
      }
      return anchor;
    }
  }

  if (profile.payFrequency === 'weekly' || profile.payFrequency === 'biweekly') {
    const result = new Date(from);
    result.setDate(result.getDate() + (profile.payFrequency === 'weekly' ? 7 : 14));
    return result;
  }

  if (profile.payFrequency === 'semimonthly' && from.getDate() < 15) {
    return new Date(from.getFullYear(), from.getMonth(), 15);
  }

  return new Date(from.getFullYear(), from.getMonth() + 1, 1);
}
