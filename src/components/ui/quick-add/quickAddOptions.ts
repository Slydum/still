import type { JournalMood } from '../../../stores/useAppStore';

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
