import type { LifeAreaId } from './lifeAreas';

export type LifeAreaTaskRecord = {
  id: string;
  areaId?: LifeAreaId;
};

export type LifeAreaEventRecord = {
  id: string;
  areaId?: LifeAreaId;
  category: 'personal' | LifeAreaId;
};

export type LifeAreaJournalRecord = {
  id: string;
  areaId?: LifeAreaId;
};

export type LifeAreaExpenseRecord = {
  id: string;
  areaId?: LifeAreaId;
};

export type LifeAreaShiftRecord = {
  id: string;
};

export type LifeAreaRecordCollections<
  TTask extends LifeAreaTaskRecord = LifeAreaTaskRecord,
  TEvent extends LifeAreaEventRecord = LifeAreaEventRecord,
  TJournal extends LifeAreaJournalRecord = LifeAreaJournalRecord,
  TExpense extends LifeAreaExpenseRecord = LifeAreaExpenseRecord,
  TShift extends LifeAreaShiftRecord = LifeAreaShiftRecord,
> = {
  tasks: TTask[];
  events: TEvent[];
  journalEntries: TJournal[];
  expenses: TExpense[];
  workShifts: TShift[];
};

export type LifeAreaRecordSet<
  TTask extends LifeAreaTaskRecord = LifeAreaTaskRecord,
  TEvent extends LifeAreaEventRecord = LifeAreaEventRecord,
  TJournal extends LifeAreaJournalRecord = LifeAreaJournalRecord,
  TExpense extends LifeAreaExpenseRecord = LifeAreaExpenseRecord,
  TShift extends LifeAreaShiftRecord = LifeAreaShiftRecord,
> = LifeAreaRecordCollections<TTask, TEvent, TJournal, TExpense, TShift>;

export function getEventLifeArea(event: LifeAreaEventRecord): LifeAreaId | undefined {
  if (event.areaId) return event.areaId;
  return event.category === 'personal' ? undefined : event.category;
}

export function getExpenseLifeArea(expense: LifeAreaExpenseRecord): LifeAreaId {
  return expense.areaId ?? 'money';
}

export function recordsForLifeArea<
  TTask extends LifeAreaTaskRecord,
  TEvent extends LifeAreaEventRecord,
  TJournal extends LifeAreaJournalRecord,
  TExpense extends LifeAreaExpenseRecord,
  TShift extends LifeAreaShiftRecord,
>(
  areaId: LifeAreaId,
  input: LifeAreaRecordCollections<TTask, TEvent, TJournal, TExpense, TShift>,
): LifeAreaRecordSet<TTask, TEvent, TJournal, TExpense, TShift> {
  return {
    tasks: input.tasks.filter((task) => task.areaId === areaId),
    events: input.events.filter((event) => getEventLifeArea(event) === areaId),
    journalEntries: input.journalEntries.filter((entry) => entry.areaId === areaId),
    expenses: input.expenses.filter((expense) => getExpenseLifeArea(expense) === areaId),
    workShifts: areaId === 'work' ? [...input.workShifts] : [],
  };
}
