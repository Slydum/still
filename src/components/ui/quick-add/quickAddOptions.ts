import { isLifeAreaId, type LifeAreaId } from '../../../domain/lifeAreas';
import type {
  EventCategory,
  EventRepeat,
  JournalMood,
  TaskPriority,
  TaskRepeat,
} from '../../../stores/useAppStore';

export const journalMoods: Array<{ value: JournalMood; emoji: string; label: string }> = [
  { value: 1, emoji: '🌧️', label: 'Heavy' },
  { value: 2, emoji: '🌫️', label: 'Low' },
  { value: 3, emoji: '🌿', label: 'Steady' },
  { value: 4, emoji: '🌤️', label: 'Good' },
  { value: 5, emoji: '✨', label: 'Bright' },
];

export const energyLevels: Array<{ value: number; emoji: string; label: string }> = [
  { value: 1, emoji: '🪫', label: 'Empty' },
  { value: 2, emoji: '🕯️', label: 'Low' },
  { value: 3, emoji: '🌿', label: 'Steady' },
  { value: 4, emoji: '🌤️', label: 'Ready' },
  { value: 5, emoji: '⚡', label: 'Bright' },
];

type TaskDisclosureState = {
  note?: string;
  dueDate?: string;
  repeat: TaskRepeat;
  priority: TaskPriority;
};

type EventDisclosureState = {
  note?: string;
  repeat: EventRepeat;
  category: EventCategory;
  startDate: string;
  endDate: string;
};

export function shouldOpenTaskMoreOptions(task?: TaskDisclosureState) {
  return Boolean(task && (
    task.note
    || task.dueDate
    || task.repeat !== 'none'
    || task.priority !== 'medium'
  ));
}

export function shouldOpenEventMoreOptions(event?: EventDisclosureState) {
  return Boolean(event && (
    event.note
    || event.repeat !== 'none'
    || event.category !== 'personal'
    || event.endDate !== event.startDate
  ));
}

const dedicatedLifeAreaRoutes: Partial<Record<string, LifeAreaId>> = {
  '/work': 'work',
  '/health': 'health',
  '/money': 'money',
};

export function lifeAreaIdFromPath(pathname: string): LifeAreaId | undefined {
  const dedicated = dedicatedLifeAreaRoutes[pathname];
  if (dedicated) return dedicated;

  if (!pathname.startsWith('/life/')) return undefined;
  const routeAreaId = pathname.split('/')[2];
  return isLifeAreaId(routeAreaId) ? routeAreaId : undefined;
}
