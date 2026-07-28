import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getLocalDateKey, type OccasionKey, type WeatherKey } from '../theme/stillContext';

type AppState = {
  quickAddOpen: boolean;
  mood?: number;
  energy?: number;
  checkInDate?: string;
  weather?: WeatherKey;
  occasion?: OccasionKey;
  openQuickAdd: () => void;
  closeQuickAdd: () => void;
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
      openQuickAdd: () => set({ quickAddOpen: true }),
      closeQuickAdd: () => set({ quickAddOpen: false }),
      setMood: (mood) => set({ mood, checkInDate: getLocalDateKey() }),
      setEnergy: (energy) => set({ energy, checkInDate: getLocalDateKey() }),
      setWeather: (weather) => set({ weather }),
      setOccasion: (occasion) => set({ occasion }),
      hydrateForToday: () => {
        const today = getLocalDateKey();
        if (get().checkInDate && get().checkInDate !== today) {
          set({ mood: undefined, energy: undefined, checkInDate: today });
        }
      },
    }),
    {
      name: 'still-app-state-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        mood: state.mood,
        energy: state.energy,
        checkInDate: state.checkInDate,
        weather: state.weather,
        occasion: state.occasion,
      }),
    },
  ),
);
