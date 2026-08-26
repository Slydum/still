import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import type { LifeAreaId } from './lifeAreas';

export type WeeklyTaskRecord = {
  id: string;
  completedAt?: number;
  areaId?: LifeAreaId;
};

export type WeeklyEventRecord = {
  id: string;
  date: string;
  areaId?: LifeAreaId;
};

export type WeeklyJournalRecord = {
  id: string;
  entryDate: string;
  areaId?: LifeAreaId;
  tags?: string[];
};

export type WeeklyExpenseRecord = {
  id: string;
  expenseDate: string;
  amount?: number;
  currency: string;
  areaId?: LifeAreaId;
};

export type WeeklyShiftRecord = {
  id: string;
  startedAt: number;
};

export type WeeklyCheckInRecord = {
  date: string;
  mood?: number;
  energy?: number;
};

export type WeeklyReflectionInput = {
  anchorDate: string;
  tasks: WeeklyTaskRecord[];
  events: WeeklyEventRecord[];
  journalEntries: WeeklyJournalRecord[];
  expenses: WeeklyExpenseRecord[];
  workShifts: WeeklyShiftRecord[];
  checkIns: WeeklyCheckInRecord[];
};

export type WeeklyCurrencyTotal = {
  currency: string;
  amount: number;
  count: number;
};

export type WeeklyAreaActivity = Record<LifeAreaId, number>;

export type WeeklyDayActivity = {
  date: string;
  count: number;
};

export type WeeklyReflection = {
  startDate: string;
  endDate: string;
  completedTasks: number;
  events: number;
  reflections: number;
  expenses: number;
  shifts: number;
  checkIns: number;
  activeDays: number;
  moodAverage?: number;
  energyAverage?: number;
  currencyTotals: WeeklyCurrencyTotal[];
  areaActivity: WeeklyAreaActivity;
  dayActivity: WeeklyDayActivity[];
  totalActivity: number;
  highlights: string[];
};

const lifeAreaIds: LifeAreaId[] = ['work', 'love', 'health', 'money'];
const SYSTEM_JOURNAL_TAGS = new Set(['still-goal', 'still-reminder', 'still-attachment']);

export function getWeekWindow(anchorDate: string) {
  const start = startOfWeek(parseISO(anchorDate), { weekStartsOn: 1 });
  const end = addDays(start, 6);
  return {
    startDate: format(start, 'yyyy-MM-dd'),
    endDate: format(end, 'yyyy-MM-dd'),
  };
}

export function localDateKeyFromTimestamp(timestamp: number) {
  return format(new Date(timestamp), 'yyyy-MM-dd');
}

function inWindow(date: string, startDate: string, endDate: string) {
  return date >= startDate && date <= endDate;
}

function average(values: Array<number | undefined>) {
  const known = values.filter((value): value is number => typeof value === 'number');
  if (!known.length) return undefined;
  return known.reduce((sum, value) => sum + value, 0) / known.length;
}

function rounded(value?: number) {
  return value === undefined ? undefined : Math.round(value * 10) / 10;
}

function activityLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function buildWeeklyReflection(input: WeeklyReflectionInput): WeeklyReflection {
  const { startDate, endDate } = getWeekWindow(input.anchorDate);
  const completedTasks = input.tasks.filter((task) => task.completedAt
    && inWindow(localDateKeyFromTimestamp(task.completedAt), startDate, endDate));
  const events = input.events.filter((event) => inWindow(event.date, startDate, endDate));
  const journalEntries = input.journalEntries.filter((entry) =>
    inWindow(entry.entryDate, startDate, endDate)
    && !entry.tags?.some((tag) => SYSTEM_JOURNAL_TAGS.has(tag)));
  const expenses = input.expenses.filter((expense) => inWindow(expense.expenseDate, startDate, endDate));
  const workShifts = input.workShifts.filter((shift) => inWindow(localDateKeyFromTimestamp(shift.startedAt), startDate, endDate));
  const checkIns = input.checkIns.filter((record) => inWindow(record.date, startDate, endDate));

  const currencyMap = new Map<string, WeeklyCurrencyTotal>();
  for (const expense of expenses) {
    const existing = currencyMap.get(expense.currency) ?? { currency: expense.currency, amount: 0, count: 0 };
    existing.amount += expense.amount ?? 0;
    existing.count += 1;
    currencyMap.set(expense.currency, existing);
  }
  const currencyTotals = [...currencyMap.values()]
    .map((total) => ({ ...total, amount: Math.round(total.amount * 100) / 100 }))
    .sort((left, right) => left.currency.localeCompare(right.currency));

  const areaActivity: WeeklyAreaActivity = { work: 0, love: 0, health: 0, money: 0 };
  for (const task of completedTasks) if (task.areaId) areaActivity[task.areaId] += 1;
  for (const event of events) if (event.areaId) areaActivity[event.areaId] += 1;
  for (const entry of journalEntries) if (entry.areaId) areaActivity[entry.areaId] += 1;
  for (const expense of expenses) areaActivity[expense.areaId ?? 'money'] += 1;
  areaActivity.work += workShifts.length;

  const dayMap = new Map<string, number>();
  for (let offset = 0; offset < 7; offset += 1) {
    dayMap.set(format(addDays(parseISO(startDate), offset), 'yyyy-MM-dd'), 0);
  }
  const recordDay = (date: string) => dayMap.set(date, (dayMap.get(date) ?? 0) + 1);
  completedTasks.forEach((task) => recordDay(localDateKeyFromTimestamp(task.completedAt!)));
  events.forEach((event) => recordDay(event.date));
  journalEntries.forEach((entry) => recordDay(entry.entryDate));
  expenses.forEach((expense) => recordDay(expense.expenseDate));
  workShifts.forEach((shift) => recordDay(localDateKeyFromTimestamp(shift.startedAt)));
  checkIns.forEach((record) => recordDay(record.date));
  const dayActivity = [...dayMap.entries()].map(([date, count]) => ({ date, count }));
  const activeDays = dayActivity.filter((day) => day.count > 0).length;

  const totalActivity = completedTasks.length + events.length + journalEntries.length
    + expenses.length + workShifts.length + checkIns.length;
  const highlights: string[] = [];

  if (completedTasks.length) highlights.push(`You completed ${activityLabel(completedTasks.length, 'task')}.`);
  if (journalEntries.length) highlights.push(`You captured ${activityLabel(journalEntries.length, 'reflection')}.`);
  if (checkIns.length) highlights.push(`You checked in on ${activityLabel(checkIns.length, 'day')}.`);

  const rankedAreas = lifeAreaIds
    .map((areaId) => ({ areaId, count: areaActivity[areaId] }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count || lifeAreaIds.indexOf(left.areaId) - lifeAreaIds.indexOf(right.areaId));
  if (rankedAreas.length && (rankedAreas.length === 1 || rankedAreas[0].count > rankedAreas[1].count)) {
    const top = rankedAreas[0];
    highlights.push(`${top.areaId[0].toUpperCase()}${top.areaId.slice(1)} had the most connected activity with ${activityLabel(top.count, 'record')}.`);
  }

  if (highlights.length < 4 && workShifts.length) {
    highlights.push(`You recorded ${activityLabel(workShifts.length, 'work shift')}.`);
  }
  if (highlights.length < 4 && events.length) {
    highlights.push(`Your calendar held ${activityLabel(events.length, 'event')}.`);
  }
  if (highlights.length < 4 && currencyTotals.length === 1) {
    const total = currencyTotals[0];
    highlights.push(`You recorded ${activityLabel(total.count, 'expense')} totaling ${total.amount.toLocaleString()} ${total.currency}.`);
  }

  return {
    startDate,
    endDate,
    completedTasks: completedTasks.length,
    events: events.length,
    reflections: journalEntries.length,
    expenses: expenses.length,
    shifts: workShifts.length,
    checkIns: checkIns.length,
    activeDays,
    moodAverage: rounded(average(checkIns.map((record) => record.mood))),
    energyAverage: rounded(average(checkIns.map((record) => record.energy))),
    currencyTotals,
    areaActivity,
    dayActivity,
    totalActivity,
    highlights: highlights.slice(0, 4),
  };
}
