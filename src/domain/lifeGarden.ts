import type { LifeAreaId } from './lifeAreas';
import type { WorkShift } from './work';

export type LifeGardenTask = {
  areaId?: LifeAreaId;
};

export type LifeGardenEvent = {
  areaId?: LifeAreaId;
  category: 'personal' | LifeAreaId;
};

export type LifeGardenJournalEntry = {
  areaId?: LifeAreaId;
};

export type LifeGardenExpense = {
  areaId?: LifeAreaId;
};

export type LifeGardenSummary = {
  areaId: LifeAreaId;
  recordCount: number;
  detail: string;
};

export type LifeGardenInput = {
  tasks: LifeGardenTask[];
  events: LifeGardenEvent[];
  journalEntries: LifeGardenJournalEntry[];
  expenses: LifeGardenExpense[];
  workShifts: WorkShift[];
};

function plural(count: number, singular: string, pluralLabel = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

function eventArea(event: LifeGardenEvent): LifeAreaId | undefined {
  if (event.areaId) return event.areaId;
  return event.category === 'personal' ? undefined : event.category;
}

export function buildLifeGardenSummaries(input: LifeGardenInput): Record<LifeAreaId, LifeGardenSummary> {
  const counts: Record<LifeAreaId, { tasks: number; events: number; journals: number; expenses: number; shifts: number }> = {
    work: { tasks: 0, events: 0, journals: 0, expenses: 0, shifts: input.workShifts.length },
    love: { tasks: 0, events: 0, journals: 0, expenses: 0, shifts: 0 },
    health: { tasks: 0, events: 0, journals: 0, expenses: 0, shifts: 0 },
    money: { tasks: 0, events: 0, journals: 0, expenses: 0, shifts: 0 },
  };

  for (const task of input.tasks) {
    if (task.areaId) counts[task.areaId].tasks += 1;
  }

  for (const event of input.events) {
    const areaId = eventArea(event);
    if (areaId) counts[areaId].events += 1;
  }

  for (const entry of input.journalEntries) {
    if (entry.areaId) counts[entry.areaId].journals += 1;
  }

  for (const expense of input.expenses) {
    const areaId = expense.areaId ?? 'money';
    counts[areaId].expenses += 1;
  }

  const summaryFor = (areaId: LifeAreaId): LifeGardenSummary => {
    const area = counts[areaId];
    const recordCount = area.tasks + area.events + area.journals + area.expenses + area.shifts;
    const parts: string[] = [];

    if (area.tasks) parts.push(plural(area.tasks, 'task'));
    if (area.events) parts.push(plural(area.events, 'event'));
    if (area.journals) parts.push(plural(area.journals, 'reflection'));
    if (area.expenses) parts.push(plural(area.expenses, 'expense'));
    if (area.shifts) parts.push(plural(area.shifts, 'shift'));

    return {
      areaId,
      recordCount,
      detail: parts.length ? parts.slice(0, 2).join(' · ') : 'No connected records yet',
    };
  };

  return {
    work: summaryFor('work'),
    love: summaryFor('love'),
    health: summaryFor('health'),
    money: summaryFor('money'),
  };
}
