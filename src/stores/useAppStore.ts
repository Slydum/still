import {
  ensureWorkShiftTimestamps,
  nextRecurringDate,
  normalizeFiniteMoney,
  normalizeTimedRange,
  touchWorkShift,
} from '../domain/domainCorrectness';
import { shiftEarnings, type WorkShift } from '../domain/work';
import { devicePersistedState } from './devicePersistence';
import { useAppStore as coreStore } from './appStoreCore';
import type { EventInput, ExpenseInput } from './appStoreCore';

export type {
  AppNotification,
  AppNotificationKind,
  AppearanceTone,
  EventCategory,
  EventInput,
  EventRepeat,
  ExpenseInput,
  JournalEntry,
  JournalInput,
  JournalMood,
  StillEvent,
  StillExpense,
  StillTask,
  TaskInput,
  TaskPriority,
  TaskRepeat,
} from './appStoreCore';

function createRecordId(prefix = 'record') {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function correctedEventInput(input: EventInput): EventInput {
  if (input.allDay) return input;

  const startDate = input.startDate;
  const endDate = input.endDate && input.endDate >= startDate ? input.endDate : startDate;
  const startTime = input.startTime || '09:00';
  const endTime = input.endTime || '10:00';
  const times = normalizeTimedRange(startDate, endDate, startTime, endTime);

  return { ...input, startTime: times.startTime, endTime: times.endTime };
}

function correctedExpenseInput(input: ExpenseInput): ExpenseInput {
  return { ...input, amount: normalizeFiniteMoney(input.amount) };
}

const originalActions = coreStore.getState();

// v1 persisted nearly the whole application in localStorage as well as IndexedDB.
// Keep v1 hydration readable for migration, but every write from the public store
// retains device-only state. Repository snapshots therefore prune old durable
// localStorage payloads after they have been imported into IndexedDB.
coreStore.persist.setOptions({
  partialize: (state) => devicePersistedState(state),
});

coreStore.setState((state) => ({
  workShifts: state.workShifts.map((shift) => ensureWorkShiftTimestamps(shift)),

  toggleTask: (id) => coreStore.setState((current) => {
    const selected = current.tasks.find((task) => task.id === id);
    if (!selected) return current;

    const completing = !selected.completed;
    const now = Date.now();
    const tasks = current.tasks.map((task) => task.id === id
      ? {
          ...task,
          completed: completing,
          completedAt: completing ? now : undefined,
          updatedAt: now,
        }
      : task);

    if (
      completing
      && selected.repeat !== 'none'
      && selected.dueDate
      && !current.tasks.some((task) => task.generatedFromId === selected.id)
    ) {
      tasks.push({
        ...selected,
        id: createRecordId('task'),
        dueDate: nextRecurringDate(selected.dueDate, selected.repeat),
        completed: false,
        completedAt: undefined,
        createdAt: now,
        updatedAt: now,
        generatedFromId: selected.id,
      });
    }

    return { tasks };
  }),

  addEvent: (input) => originalActions.addEvent(correctedEventInput(input)),
  updateEvent: (id, input) => originalActions.updateEvent(id, correctedEventInput(input)),
  addExpense: (input) => originalActions.addExpense(correctedExpenseInput(input)),
  updateExpense: (id, input) => originalActions.updateExpense(id, correctedExpenseInput(input)),

  startWorkShift: () => coreStore.setState((current) => {
    if (current.workShifts.some((shift) => !shift.endedAt)) return current;
    const now = Date.now();
    const shift = {
      id: createRecordId('shift'),
      startedAt: now,
      unpaidBreakMinutes: current.workProfile.unpaidBreakMinutes,
      createdAt: now,
      updatedAt: now,
    };
    return { workShifts: [shift, ...current.workShifts] };
  }),

  endWorkShift: () => coreStore.setState((current) => {
    const active = current.workShifts.find((shift) => !shift.endedAt);
    if (!active) return current;
    const endedAt = Date.now();
    const completed = touchWorkShift({
      ...ensureWorkShiftTimestamps(active),
      endedAt,
      recordedBreakMs: (active.recordedBreakMs ?? 0)
        + (active.breakStartedAt ? endedAt - active.breakStartedAt : 0),
      breakStartedAt: undefined,
    }, endedAt);

    return {
      workShifts: current.workShifts.map((shift) => shift.id === active.id
        ? { ...completed, expectedEarnings: shiftEarnings(completed, current.workProfile, endedAt) }
        : shift),
    };
  }),

  toggleWorkBreak: () => coreStore.setState((current) => {
    const active = current.workShifts.find((shift) => !shift.endedAt);
    if (!active) return current;
    const now = Date.now();

    return {
      workShifts: current.workShifts.map((shift) => {
        if (shift.id !== active.id) return shift;
        const versioned = ensureWorkShiftTimestamps(shift);
        if (!shift.breakStartedAt) return touchWorkShift({ ...versioned, breakStartedAt: now }, now);
        return touchWorkShift({
          ...versioned,
          breakStartedAt: undefined,
          recordedBreakMs: (shift.recordedBreakMs ?? 0) + (now - shift.breakStartedAt),
        }, now);
      }),
    };
  }),

  addWorkShift: (input) => coreStore.setState((current) => {
    const now = Date.now();
    const shift: WorkShift & { createdAt: number; updatedAt: number } = {
      id: createRecordId('shift'),
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      unpaidBreakMinutes: Math.max(0, input.unpaidBreakMinutes),
      recordedBreakMs: 0,
      note: input.note,
      createdAt: now,
      updatedAt: now,
    };
    const completed = {
      ...shift,
      expectedEarnings: shiftEarnings(shift, current.workProfile, input.endedAt),
    };
    return {
      workShifts: [completed, ...current.workShifts].sort((a, b) => b.startedAt - a.startedAt),
    };
  }),

  updateWorkShift: (id, input) => coreStore.setState((current) => ({
    workShifts: current.workShifts
      .map((shift) => {
        if (shift.id !== id || !shift.endedAt) return shift;
        const now = Date.now();
        const updated = touchWorkShift({
          ...ensureWorkShiftTimestamps(shift),
          startedAt: input.startedAt,
          endedAt: input.endedAt,
          unpaidBreakMinutes: Math.max(0, input.unpaidBreakMinutes),
          recordedBreakMs: 0,
          breakStartedAt: undefined,
          note: input.note,
        }, now);
        return {
          ...updated,
          expectedEarnings: shiftEarnings(updated, current.workProfile, input.endedAt),
        };
      })
      .sort((a, b) => b.startedAt - a.startedAt),
  })),
}));

export const useAppStore = coreStore;
