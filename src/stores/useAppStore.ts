import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getLocalDateKey, type OccasionKey, type WeatherKey } from '../theme/stillContext';

type AppState = {
  quickAddOpen: boolean;
  name: string;
  mood?: number;
  energy?: number;
  checkInDate?: string;
  weather?: WeatherKey;
  occasion?: OccasionKey;
  openQuickAdd: () => void;
  closeQuickAdd: () => void;
  setName: (value: string) => void;
  setMood: (value: number) => void;
  setEnergy: (value: number) => void;
  setWeather: (value?: WeatherKey) => void;
  setOccasion: (value?: OccasionKey) => void;
  hydrateForToday: () => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      quickAddOpen: false,
      name: 'Tien',
      openQuickAdd: () => set({ quickAddOpen: true }),
      closeQuickAdd: () => set({ quickAddOpen: false }),
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
