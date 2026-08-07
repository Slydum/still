import { create } from 'zustand';

type PersistenceStatusState = {
  error?: string;
  failedAt?: number;
  setFailure: (error: unknown) => void;
  clearFailure: () => void;
};

function persistenceErrorMessage(error: unknown) {
  const detail = error instanceof Error && error.message ? ` ${error.message}` : '';
  return `Still could not save your latest changes on this device.${detail}`;
}

export const usePersistenceStatus = create<PersistenceStatusState>((set) => ({
  error: undefined,
  failedAt: undefined,
  setFailure: (error) => set({ error: persistenceErrorMessage(error), failedAt: Date.now() }),
  clearFailure: () => set({ error: undefined, failedAt: undefined }),
}));
