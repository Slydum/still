import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getLocalDateKey, type OccasionKey, type WeatherKey } from '../theme/stillContext';
import {
  createLifeEntityLink,
  type LifeAreaId,
  type LifeAreaRecord,
  type LifeEntityLink,
  type LifeEntityLinkType,
  type LifeEntityRef,
} from '../domain/lifeAreas';
import { DEFAULT_WORK_PROFILE, shiftEarnings, type WorkProfile, type WorkShift, type WorkShiftInput } from '../domain/work';

export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskRepeat = 'none' | 'daily' | 'weekly' | 'monthly';
export type EventCategory = 'personal' | LifeAreaId;
export type EventRepeat = TaskRepeat;

export type StillTask = {
  id: string;
  title: string;
  note?: string;
  dueDate?: string;
  priority: TaskPriority;
  repeat: TaskRepeat;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  generatedFromId?: string;
  areaId?: LifeAreaId;
  links?: LifeEntityRef[];
};

export type TaskInput = Pick<
  StillTask,
  'title' | 'note' | 'dueDate' | 'priority' | 'repeat'
> & LifeAreaRecord;

export type StillEvent = {
  id: string;
  title: string;
  note?: string;
  category: EventCategory;
  startDate: string;
  endDate: string;
  allDay: boolean;
  startTime?: string;
  endTime?: string;
  repeat: EventRepeat;
  createdAt: number;
  updatedAt: number;
  areaId?: LifeAreaId;
  links?: LifeEntityRef[];
};

export type EventInput = Pick<
  StillEvent,
  | 'title'
  | 'note'
  | 'category'
  | 'startDate'
  | 'endDate'
  | 'allDay'
  | 'startTime'
  | 'endTime'
  | 'repeat'
> & LifeAreaRecord;

export type JournalMood = 1 | 2 | 3 | 4 | 5;
export type AppearanceTone = 'lavender' | 'warm' | 'sage';
export type AppNotificationKind = 'task' | 'event' | 'check-in' | 'system';

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  kind: AppNotificationKind;
  createdAt: number;
  read: boolean;
};

export type JournalEntry = {
  id: string;
  title?: string;
  body: string;
  entryDate: string;
  mood?: JournalMood;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  areaId?: LifeAreaId;
  links?: LifeEntityRef[];
};

export type JournalInput = Pick<
  JournalEntry,
  'title' | 'body' | 'entryDate' | 'mood' | 'tags'
> & LifeAreaRecord;

export type StillExpense = {
  id: string;
  title: string;
  amount?: number;
  currency: string;
  category?: string;
  note?: string;
  expenseDate: string;
  createdAt: number;
  updatedAt: number;
  areaId?: LifeAreaId;
  links?: LifeEntityRef[];
};

export type ExpenseInput = Pick<
  StillExpense,
  'title' | 'amount' | 'currency' | 'category' | 'note' | 'expenseDate'
> & LifeAreaRecord;

type QuickAddMode = 'menu' | 'task' | 'event' | 'journal' | 'expense' | 'check-in';

type AppState = {
  quickAddOpen: boolean;
  quickAddMode: QuickAddMode;
  editingTaskId?: string;
  editingEventId?: string;
  editingJournalId?: string;
  eventDraftDate?: string;
  journalDraftDate?: string;
  tasks: StillTask[];
  events: StillEvent[];
  journalEntries: JournalEntry[];
  expenses: StillExpense[];
  notifications: AppNotification[];
  entityLinks: LifeEntityLink[];
  workProfile: WorkProfile;
  workShifts: WorkShift[];
  workPrivacyBlur: boolean;
  name: string;
  mood?: number;
  energy?: number;
  checkInDate?: string;
  weather?: WeatherKey;
  occasion?: OccasionKey;
  appearanceTone: AppearanceTone;
  reduceMotion: boolean;
  notificationsEnabled: boolean;
  taskReminders: boolean;
  eventReminders: boolean;
  dailyCheckInReminder: boolean;
  reminderTime: string;
  eventReminderMinutes: number;
  autoWeather: boolean;
  openQuickAdd: (mode?: QuickAddMode) => void;
  openTaskEditor: (taskId?: string) => void;
  openEventEditor: (eventId?: string, initialDate?: string) => void;
  openJournalEditor: (entryId?: string, initialDate?: string) => void;
  closeQuickAdd: () => void;
  addTask: (input: TaskInput) => void;
  updateTask: (id: string, input: TaskInput) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  addEvent: (input: EventInput) => void;
  updateEvent: (id: string, input: EventInput) => void;
  deleteEvent: (id: string) => void;
  addJournalEntry: (input: JournalInput) => void;
  updateJournalEntry: (id: string, input: JournalInput) => void;
  deleteJournalEntry: (id: string) => void;
  addExpense: (input: ExpenseInput) => void;
  updateExpense: (id: string, input: ExpenseInput) => void;
  deleteExpense: (id: string) => void;
  setName: (value: string) => void;
  setMood: (value: number) => void;
  setEnergy: (value: number) => void;
  replaceTodayCheckIn: (mood?: number, energy?: number) => void;
  setWeather: (value?: WeatherKey) => void;
  setOccasion: (value?: OccasionKey) => void;
  setAppearanceTone: (value: AppearanceTone) => void;
  setReduceMotion: (value: boolean) => void;
  setNotificationsEnabled: (value: boolean) => void;
  setTaskReminders: (value: boolean) => void;
  setEventReminders: (value: boolean) => void;
  setDailyCheckInReminder: (value: boolean) => void;
  setReminderTime: (value: string) => void;
  setEventReminderMinutes: (value: number) => void;
  addNotification: (notification: Omit<AppNotification, 'createdAt' | 'read'>) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  linkEntities: (from: LifeEntityRef, to: LifeEntityRef, type?: LifeEntityLinkType) => void;
  unlinkEntities: (linkId: string) => void;
  updateWorkProfile: (profile: WorkProfile) => void;
  startWorkShift: () => void;
  endWorkShift: () => void;
  toggleWorkBreak: () => void;
  addWorkShift: (input: WorkShiftInput) => void;
  updateWorkShift: (id: string, input: WorkShiftInput) => void;
  deleteWorkShift: (id: string) => void;
  setWorkPrivacyBlur: (value: boolean) => void;
  setAutoWeather: (value: boolean) => void;
  hydrateForToday: () => void;
};

function createTaskId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `task-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function nextDueDate(dueDate: string, repeat: Exclude<TaskRepeat, 'none'>) {
  const next = new Date(`${dueDate}T12:00:00`);

  if (repeat === 'daily') next.setDate(next.getDate() + 1);
  if (repeat === 'weekly') next.setDate(next.getDate() + 7);
  if (repeat === 'monthly') next.setMonth(next.getMonth() + 1);

  const year = next.getFullYear();
  const month = String(next.getMonth() + 1).padStart(2, '0');
  const day = String(next.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizedTaskInput(input: TaskInput): TaskInput {
  return {
    title: input.title.trim(),
    note: input.note?.trim() || undefined,
    dueDate: input.dueDate || undefined,
    priority: input.priority,
    repeat: input.dueDate ? input.repeat : 'none',
    areaId: input.areaId,
    links: input.links,
  };
}

function normalizedEventInput(input: EventInput): EventInput {
  const startDate = input.startDate || getLocalDateKey();
  const endDate = input.endDate && input.endDate >= startDate
    ? input.endDate
    : startDate;

  return {
    title: input.title.trim(),
    note: input.note?.trim() || undefined,
    category: input.category,
    startDate,
    endDate,
    allDay: input.allDay,
    startTime: input.allDay ? undefined : input.startTime || '09:00',
    endTime: input.allDay ? undefined : input.endTime || '10:00',
    repeat: input.repeat,
    areaId: input.areaId ?? (input.category === 'personal' ? undefined : input.category),
    links: input.links,
  };
}


function normalizedExpenseInput(input: ExpenseInput): ExpenseInput {
  const amount = input.amount === undefined || Number.isNaN(input.amount)
    ? undefined
    : Math.max(0, input.amount);

  return {
    title: input.title.trim(),
    amount,
    currency: input.currency.trim() || 'PHP',
    category: input.category?.trim() || undefined,
    note: input.note?.trim() || undefined,
    expenseDate: input.expenseDate || getLocalDateKey(),
    areaId: input.areaId ?? 'money',
    links: input.links,
  };
}

function normalizedJournalInput(input: JournalInput): JournalInput {
  return {
    title: input.title?.trim() || undefined,
    body: input.body.trim(),
    entryDate: input.entryDate || getLocalDateKey(),
    mood: input.mood,
    tags: Array.from(new Set(input.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))).slice(0, 8),
    areaId: input.areaId,
    links: input.links,
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      quickAddOpen: false,
      quickAddMode: 'menu',
      editingTaskId: undefined,
      editingEventId: undefined,
      editingJournalId: undefined,
      eventDraftDate: undefined,
      journalDraftDate: undefined,
      tasks: [],
      events: [],
      journalEntries: [],
      expenses: [],
      notifications: [],
      entityLinks: [],
      workProfile: DEFAULT_WORK_PROFILE,
      workShifts: [],
      workPrivacyBlur: true,
      name: '',
      appearanceTone: 'lavender',
      reduceMotion: false,
      notificationsEnabled: false,
      taskReminders: true,
      eventReminders: true,
      dailyCheckInReminder: false,
      reminderTime: '09:00',
      eventReminderMinutes: 30,
      autoWeather: true,
      openQuickAdd: (quickAddMode = 'menu') => set({
        quickAddOpen: true,
        quickAddMode,
        editingTaskId: undefined,
        editingEventId: undefined,
        editingJournalId: undefined,
        eventDraftDate: undefined,
        journalDraftDate: undefined,
      }),
      openTaskEditor: (editingTaskId) => set({
        quickAddOpen: true,
        quickAddMode: 'task',
        editingTaskId,
        editingEventId: undefined,
        editingJournalId: undefined,
        eventDraftDate: undefined,
        journalDraftDate: undefined,
      }),
      openEventEditor: (editingEventId, eventDraftDate) => set({
        quickAddOpen: true,
        quickAddMode: 'event',
        editingTaskId: undefined,
        editingEventId,
        editingJournalId: undefined,
        eventDraftDate,
        journalDraftDate: undefined,
      }),
      openJournalEditor: (editingJournalId, journalDraftDate) => set({
        quickAddOpen: true,
        quickAddMode: 'journal',
        editingTaskId: undefined,
        editingEventId: undefined,
        editingJournalId,
        eventDraftDate: undefined,
        journalDraftDate,
      }),
      closeQuickAdd: () => set({
        quickAddOpen: false,
        quickAddMode: 'menu',
        editingTaskId: undefined,
        editingEventId: undefined,
        editingJournalId: undefined,
        eventDraftDate: undefined,
        journalDraftDate: undefined,
      }),
      addTask: (input) => set((state) => {
        const now = Date.now();
        const normalized = normalizedTaskInput(input);
        if (!normalized.title) return state;

        return {
          tasks: [
            ...state.tasks,
            {
              id: createTaskId(),
              ...normalized,
              completed: false,
              createdAt: now,
              updatedAt: now,
            },
          ],
        };
      }),
      updateTask: (id, input) => set((state) => {
        const normalized = normalizedTaskInput(input);
        if (!normalized.title) return state;

        return {
          tasks: state.tasks.map((task) => task.id === id
            ? { ...task, ...normalized, updatedAt: Date.now() }
            : task),
        };
      }),
      toggleTask: (id) => set((state) => {
        const selected = state.tasks.find((task) => task.id === id);
        if (!selected) return state;

        const completing = !selected.completed;
        const now = Date.now();
        const tasks = state.tasks.map((task) => task.id === id
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
          && !state.tasks.some((task) => task.generatedFromId === selected.id)
        ) {
          tasks.push({
            ...selected,
            id: createTaskId(),
            dueDate: nextDueDate(selected.dueDate, selected.repeat),
            completed: false,
            completedAt: undefined,
            createdAt: now,
            updatedAt: now,
            generatedFromId: selected.id,
          });
        }

        return { tasks };
      }),
      deleteTask: (id) => set((state) => ({
        tasks: state.tasks.filter((task) => task.id !== id),
      })),
      addEvent: (input) => set((state) => {
        const normalized = normalizedEventInput(input);
        if (!normalized.title) return state;

        const now = Date.now();
        return {
          events: [
            ...state.events,
            {
              id: createTaskId(),
              ...normalized,
              createdAt: now,
              updatedAt: now,
            },
          ],
        };
      }),
      updateEvent: (id, input) => set((state) => {
        const normalized = normalizedEventInput(input);
        if (!normalized.title) return state;

        return {
          events: state.events.map((event) => event.id === id
            ? { ...event, ...normalized, updatedAt: Date.now() }
            : event),
        };
      }),
      deleteEvent: (id) => set((state) => ({
        events: state.events.filter((event) => event.id !== id),
      })),
      addJournalEntry: (input) => set((state) => {
        const normalized = normalizedJournalInput(input);
        if (!normalized.body) return state;

        const now = Date.now();
        return {
          journalEntries: [
            ...state.journalEntries,
            {
              id: createTaskId(),
              ...normalized,
              createdAt: now,
              updatedAt: now,
            },
          ],
        };
      }),
      updateJournalEntry: (id, input) => set((state) => {
        const normalized = normalizedJournalInput(input);
        if (!normalized.body) return state;

        return {
          journalEntries: state.journalEntries.map((entry) => entry.id === id
            ? { ...entry, ...normalized, updatedAt: Date.now() }
            : entry),
        };
      }),
      deleteJournalEntry: (id) => set((state) => ({
        journalEntries: state.journalEntries.filter((entry) => entry.id !== id),
      })),
      addExpense: (input) => set((state) => {
        const normalized = normalizedExpenseInput(input);
        if (!normalized.title) return state;

        const now = Date.now();
        return {
          expenses: [
            ...state.expenses,
            {
              id: createTaskId(),
              ...normalized,
              createdAt: now,
              updatedAt: now,
            },
          ],
        };
      }),
      updateExpense: (id, input) => set((state) => {
        const normalized = normalizedExpenseInput(input);
        if (!normalized.title) return state;

        return {
          expenses: state.expenses.map((expense) => expense.id === id
            ? { ...expense, ...normalized, updatedAt: Date.now() }
            : expense),
        };
      }),
      deleteExpense: (id) => set((state) => ({
        expenses: state.expenses.filter((expense) => expense.id !== id),
      })),
      setName: (name) => set({ name }),
      setMood: (mood) => set((state) => {
        const today = getLocalDateKey();
        return {
          mood,
          energy: state.checkInDate === today ? state.energy : undefined,
          checkInDate: today,
        };
      }),
      setEnergy: (energy) => set((state) => {
        const today = getLocalDateKey();
        return {
          mood: state.checkInDate === today ? state.mood : undefined,
          energy,
          checkInDate: today,
        };
      }),
      replaceTodayCheckIn: (mood, energy) => set({
        mood,
        energy,
        checkInDate: getLocalDateKey(),
      }),
      setWeather: (weather) => set({ weather }),
      setOccasion: (occasion) => set({ occasion }),
      setAppearanceTone: (appearanceTone) => set({ appearanceTone }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
      setTaskReminders: (taskReminders) => set({ taskReminders }),
      setEventReminders: (eventReminders) => set({ eventReminders }),
      setDailyCheckInReminder: (dailyCheckInReminder) => set({ dailyCheckInReminder }),
      setReminderTime: (reminderTime) => set({ reminderTime }),
      setEventReminderMinutes: (eventReminderMinutes) => set({ eventReminderMinutes }),
      addNotification: (notification) => set((state) => ({
        notifications: state.notifications.some((item) => item.id === notification.id)
          ? state.notifications
          : [{ ...notification, createdAt: Date.now(), read: false }, ...state.notifications].slice(0, 50),
      })),
      markAllNotificationsRead: () => set((state) => ({
        notifications: state.notifications.map((notification) => ({ ...notification, read: true })),
      })),
      clearNotifications: () => set({ notifications: [] }),
      linkEntities: (from, to, type = 'related') => set((state) => {
        const duplicate = state.entityLinks.some((link) =>
          link.from.kind === from.kind && link.from.id === from.id
          && link.to.kind === to.kind && link.to.id === to.id
          && link.type === type);
        return duplicate ? state : { entityLinks: [...state.entityLinks, createLifeEntityLink(from, to, type)] };
      }),
      unlinkEntities: (linkId) => set((state) => ({
        entityLinks: state.entityLinks.filter((link) => link.id !== linkId),
      })),
      updateWorkProfile: (workProfile) => set({ workProfile }),
      startWorkShift: () => set((state) => {
        if (state.workShifts.some((shift) => !shift.endedAt)) return state;
        return {
          workShifts: [{
            id: createTaskId(),
            startedAt: Date.now(),
            unpaidBreakMinutes: state.workProfile.unpaidBreakMinutes,
          }, ...state.workShifts],
        };
      }),
      endWorkShift: () => set((state) => {
        const active = state.workShifts.find((shift) => !shift.endedAt);
        if (!active) return state;
        const endedAt = Date.now();
        const completed = {
          ...active,
          endedAt,
          recordedBreakMs: (active.recordedBreakMs ?? 0)
            + (active.breakStartedAt ? endedAt - active.breakStartedAt : 0),
          breakStartedAt: undefined,
        };
        return {
          workShifts: state.workShifts.map((shift) => shift.id === active.id
            ? { ...completed, expectedEarnings: shiftEarnings(completed, state.workProfile, endedAt) }
            : shift),
        };
      }),
      toggleWorkBreak: () => set((state) => {
        const active = state.workShifts.find((shift) => !shift.endedAt);
        if (!active) return state;
        const now = Date.now();
        return {
          workShifts: state.workShifts.map((shift) => {
            if (shift.id !== active.id) return shift;
            if (!shift.breakStartedAt) return { ...shift, breakStartedAt: now };
            return {
              ...shift,
              breakStartedAt: undefined,
              recordedBreakMs: (shift.recordedBreakMs ?? 0) + (now - shift.breakStartedAt),
            };
          }),
        };
      }),
      addWorkShift: (input) => set((state) => {
        const shift: WorkShift = {
          id: createTaskId(),
          startedAt: input.startedAt,
          endedAt: input.endedAt,
          unpaidBreakMinutes: Math.max(0, input.unpaidBreakMinutes),
          recordedBreakMs: 0,
          note: input.note,
        };
        const completed = {
          ...shift,
          expectedEarnings: shiftEarnings(shift, state.workProfile, input.endedAt),
        };
        return {
          workShifts: [completed, ...state.workShifts]
            .sort((a, b) => b.startedAt - a.startedAt),
        };
      }),
      updateWorkShift: (id, input) => set((state) => ({
        workShifts: state.workShifts
          .map((shift) => {
            if (shift.id !== id || !shift.endedAt) return shift;
            const updated: WorkShift = {
              ...shift,
              startedAt: input.startedAt,
              endedAt: input.endedAt,
              unpaidBreakMinutes: Math.max(0, input.unpaidBreakMinutes),
              recordedBreakMs: 0,
              breakStartedAt: undefined,
              note: input.note,
            };
            return {
              ...updated,
              expectedEarnings: shiftEarnings(updated, state.workProfile, input.endedAt),
            };
          })
          .sort((a, b) => b.startedAt - a.startedAt),
      })),
      deleteWorkShift: (id) => set((state) => ({
        workShifts: state.workShifts.filter((shift) => shift.id !== id || !shift.endedAt),
      })),
      setWorkPrivacyBlur: (workPrivacyBlur) => set({ workPrivacyBlur }),
      setAutoWeather: (autoWeather) => set({ autoWeather }),
      hydrateForToday: () => {
        const today = getLocalDateKey();
        const { checkInDate, mood, energy } = get();
        if (checkInDate !== today && (mood !== undefined || energy !== undefined)) {
          set({ mood: undefined, energy: undefined, checkInDate: today });
        }
      },
    }),
    {
      name: 'still-app-state-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        tasks: state.tasks,
        events: state.events,
        journalEntries: state.journalEntries,
        expenses: state.expenses,
        notifications: state.notifications,
        entityLinks: state.entityLinks,
        workProfile: state.workProfile,
        workShifts: state.workShifts,
        workPrivacyBlur: state.workPrivacyBlur,
        name: state.name,
        mood: state.mood,
        energy: state.energy,
        checkInDate: state.checkInDate,
        weather: state.weather,
        occasion: state.occasion,
        appearanceTone: state.appearanceTone,
        reduceMotion: state.reduceMotion,
        notificationsEnabled: state.notificationsEnabled,
        taskReminders: state.taskReminders,
        eventReminders: state.eventReminders,
        dailyCheckInReminder: state.dailyCheckInReminder,
        reminderTime: state.reminderTime,
        eventReminderMinutes: state.eventReminderMinutes,
        autoWeather: state.autoWeather,
      }),
    },
  ),
);
