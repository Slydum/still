import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getLocalDateKey, type OccasionKey, type WeatherKey } from '../theme/stillContext';

export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskRepeat = 'none' | 'daily' | 'weekly' | 'monthly';
export type EventCategory = 'personal' | 'work' | 'health' | 'love' | 'money';
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
};

export type TaskInput = Pick<
  StillTask,
  'title' | 'note' | 'dueDate' | 'priority' | 'repeat'
>;

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
>;

type QuickAddMode = 'menu' | 'task' | 'event';

type AppState = {
  quickAddOpen: boolean;
  quickAddMode: QuickAddMode;
  editingTaskId?: string;
  editingEventId?: string;
  eventDraftDate?: string;
  tasks: StillTask[];
  events: StillEvent[];
  name: string;
  mood?: number;
  energy?: number;
  checkInDate?: string;
  weather?: WeatherKey;
  occasion?: OccasionKey;
  openQuickAdd: () => void;
  openTaskEditor: (taskId?: string) => void;
  openEventEditor: (eventId?: string, initialDate?: string) => void;
  closeQuickAdd: () => void;
  addTask: (input: TaskInput) => void;
  updateTask: (id: string, input: TaskInput) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  addEvent: (input: EventInput) => void;
  updateEvent: (id: string, input: EventInput) => void;
  deleteEvent: (id: string) => void;
  setName: (value: string) => void;
  setMood: (value: number) => void;
  setEnergy: (value: number) => void;
  setWeather: (value?: WeatherKey) => void;
  setOccasion: (value?: OccasionKey) => void;
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
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      quickAddOpen: false,
      quickAddMode: 'menu',
      editingTaskId: undefined,
      editingEventId: undefined,
      eventDraftDate: undefined,
      tasks: [],
      events: [],
      name: 'Tien',
      openQuickAdd: () => set({
        quickAddOpen: true,
        quickAddMode: 'menu',
        editingTaskId: undefined,
        editingEventId: undefined,
        eventDraftDate: undefined,
      }),
      openTaskEditor: (editingTaskId) => set({
        quickAddOpen: true,
        quickAddMode: 'task',
        editingTaskId,
        editingEventId: undefined,
        eventDraftDate: undefined,
      }),
      openEventEditor: (editingEventId, eventDraftDate) => set({
        quickAddOpen: true,
        quickAddMode: 'event',
        editingTaskId: undefined,
        editingEventId,
        eventDraftDate,
      }),
      closeQuickAdd: () => set({
        quickAddOpen: false,
        quickAddMode: 'menu',
        editingTaskId: undefined,
        editingEventId: undefined,
        eventDraftDate: undefined,
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
      setWeather: (weather) => set({ weather }),
      setOccasion: (occasion) => set({ occasion }),
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
        name: state.name,
        mood: state.mood,
        energy: state.energy,
        checkInDate: state.checkInDate,
        weather: state.weather,
        occasion: state.occasion,
      }),
    },
  ),
);
