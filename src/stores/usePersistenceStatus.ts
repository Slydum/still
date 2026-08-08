import { create } from 'zustand';

export type LocalPersistencePhase = 'idle' | 'saving' | 'saved' | 'error';

type PersistenceStatusState = {
  phase: LocalPersistencePhase;
  savedAt?: number;
  error?: string;
  failedAt?: number;
  markSaving: () => void;
  markSaved: () => void;
  setFailure: (error: unknown) => void;
  clearFailure: () => void;
};

function persistenceErrorMessage(error: unknown) {
  const detail = error instanceof Error && error.message ? ` ${error.message}` : '';
  return `Still could not save your latest changes on this device.${detail}`;
}

export const usePersistenceStatus = create<PersistenceStatusState>((set) => ({
  phase: 'idle',
  savedAt: undefined,
  error: undefined,
  failedAt: undefined,
  markSaving: () => set({ phase: 'saving', error: undefined, failedAt: undefined }),
  markSaved: () => set({ phase: 'saved', savedAt: Date.now(), error: undefined, failedAt: undefined }),
  setFailure: (error) => set({
    phase: 'error',
    error: persistenceErrorMessage(error),
    failedAt: Date.now(),
  }),
  clearFailure: () => set((state) => ({
    phase: state.phase === 'error' ? 'idle' : state.phase,
    error: undefined,
    failedAt: undefined,
  })),
}));
