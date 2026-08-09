export type HealthRoutineCadence = 'daily' | 'weekly';
export type HealthNoteKind = 'note' | 'symptom' | 'appointment' | 'medication' | 'question';

export type HealthRoutine = {
  id: string;
  title: string;
  cadence: HealthRoutineCadence;
  note?: string;
  lastCompletedDate?: string;
  createdAt: number;
  updatedAt: number;
};

export type HealthRoutineInput = Pick<HealthRoutine, 'title' | 'cadence' | 'note'>;

export type HealthSignalPreferences = {
  sleep: boolean;
  hydration: boolean;
  movement: boolean;
};

export type HealthSettingsState = {
  healthRoutines: HealthRoutine[];
  healthSignalPreferences: HealthSignalPreferences;
};

export const EMPTY_HEALTH_ROUTINES: HealthRoutine[] = [];
export const DEFAULT_HEALTH_SIGNAL_PREFERENCES: HealthSignalPreferences = {
  sleep: true,
  hydration: false,
  movement: false,
};

export const HEALTH_NOTE_LABELS: Record<HealthNoteKind, string> = {
  note: 'Health note',
  symptom: 'Symptom note',
  appointment: 'Appointment note',
  medication: 'Medication note',
  question: 'Question to remember',
};

export function createHealthRecordId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function weekStartKey(value: string) {
  const date = new Date(`${value}T12:00:00`);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return dateKey(date);
}

export function routineCompletedForDate(routine: HealthRoutine, value: string) {
  if (!routine.lastCompletedDate) return false;
  if (routine.cadence === 'daily') return routine.lastCompletedDate === value;
  return weekStartKey(routine.lastCompletedDate) === weekStartKey(value);
}

export function routineCadenceLabel(cadence: HealthRoutineCadence) {
  return cadence === 'daily' ? 'Daily' : 'Weekly';
}

export function healthNoteKind(tags: string[]): HealthNoteKind {
  if (tags.includes('health-symptom')) return 'symptom';
  if (tags.includes('health-appointment')) return 'appointment';
  if (tags.includes('health-medication')) return 'medication';
  if (tags.includes('health-question')) return 'question';
  return 'note';
}

export function healthNoteTags(kind: HealthNoteKind) {
  return ['health-note', `health-${kind}`];
}

export function normalizeOptionalHealthNumber(value: number | undefined, maximum: number) {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.min(maximum, Math.max(0, value));
}
