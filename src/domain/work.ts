import type { LifeEntityRef } from './lifeAreas';

export type WorkPayType = 'hourly' | 'salary';
export type WorkPayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';

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
  links?: LifeEntityRef[];
};

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
  unpaidBreakMinutes: 60,
  overtimeAfterHours: 8,
  overtimeMultiplier: 1.5,
};

export function effectiveHourlyRate(profile: WorkProfile) {
  if (profile.payType === 'hourly') return Math.max(0, profile.hourlyRate);
  return Math.max(0, profile.annualSalary) / (52 * Math.max(1, profile.weeklyHours));
}

export function workedHours(shift: WorkShift, now = Date.now()) {
  const elapsedMs = Math.max(0, (shift.endedAt ?? now) - shift.startedAt);
  return Math.max(0, elapsedMs / 3_600_000 - shift.unpaidBreakMinutes / 60);
}

export function shiftEarnings(shift: WorkShift, profile: WorkProfile, now = Date.now()) {
  const hours = workedHours(shift, now);
  const rate = effectiveHourlyRate(profile);
  const regularHours = Math.min(hours, Math.max(0, profile.overtimeAfterHours));
  const overtimeHours = Math.max(0, hours - regularHours);
  return regularHours * rate + overtimeHours * rate * Math.max(1, profile.overtimeMultiplier);
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
