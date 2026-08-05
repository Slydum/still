import { useEffect } from 'react';
import { stillRepository, type PermanentDataCache } from '../data/repositories';
import { useAppStore } from '../stores/useAppStore';

let bootstrapPromise: ReturnType<typeof stillRepository.bootstrap> | undefined;

function cacheFromStore(): PermanentDataCache {
  const state = useAppStore.getState();
  return {
    tasks: state.tasks,
    events: state.events,
    journalEntries: state.journalEntries,
    expenses: state.expenses,
    entityLinks: state.entityLinks,
    workShifts: state.workShifts,
  };
}

function reportRepositoryError(error: unknown) {
  console.error('Still could not synchronize its permanent data repository:', error);
}

export function usePermanentDataRepository() {
  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    let writeQueue = Promise.resolve();

    const enqueue = (write: () => Promise<void>) => {
      writeQueue = writeQueue.then(write).catch(reportRepositoryError);
    };

    const start = async () => {
      bootstrapPromise ??= stillRepository.bootstrap(cacheFromStore());
      const snapshot = await bootstrapPromise;
      if (disposed) return;

      useAppStore.setState({
        tasks: snapshot.tasks,
        events: snapshot.events,
        journalEntries: snapshot.journalEntries,
        expenses: snapshot.expenses,
        entityLinks: snapshot.entityLinks,
        workShifts: snapshot.workShifts,
      });

      unsubscribe = useAppStore.subscribe((state, previousState) => {
        if (state.tasks !== previousState.tasks) {
          enqueue(() => stillRepository.syncTasks(state.tasks));
        }
        if (state.events !== previousState.events) {
          enqueue(() => stillRepository.syncEvents(state.events));
        }
        if (state.journalEntries !== previousState.journalEntries) {
          enqueue(() => stillRepository.syncJournalEntries(state.journalEntries));
        }
        if (state.expenses !== previousState.expenses) {
          enqueue(() => stillRepository.syncExpenses(state.expenses));
        }
        if (state.entityLinks !== previousState.entityLinks) {
          enqueue(() => stillRepository.syncEntityLinks(state.entityLinks));
        }
        if (state.workShifts !== previousState.workShifts) {
          enqueue(() => stillRepository.syncWorkShifts(state.workShifts));
        }
      });
    };

    void start().catch(reportRepositoryError);

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, []);
}
