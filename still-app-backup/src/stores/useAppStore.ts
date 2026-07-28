import { create } from 'zustand';

type AppState = {
  quickAddOpen: boolean;
  mood?: number;
  energy?: number;
  openQuickAdd: () => void;
  closeQuickAdd: () => void;
  setMood: (value: number) => void;
  setEnergy: (value: number) => void;
};

export const useAppStore = create<AppState>((set) => ({
  quickAddOpen: false,
  openQuickAdd: () => set({ quickAddOpen: true }),
  closeQuickAdd: () => set({ quickAddOpen: false }),
  setMood: (mood) => set({ mood }),
  setEnergy: (energy) => set({ energy }),
}));
