import { useEffect } from 'react';
import { stillRepository, type PermanentDataCache } from '../data/repositories';
import {
  diffCollectionChanges,
  hasCollectionChanges,
  type CollectionChanges,
  type IdentifiedVersionedRecord,
} from '../data/repositories/recordChanges';
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

export function initializePermanentDataRepository() {
  bootstrapPromise ??= stillRepository.bootstrap(cacheFromStore());
  return bootstrapPromise;
}

export function usePermanentDataRepository() {
  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    let writeQueue = Promise.resolve();

    const enqueue = (write: () => Promise<void>) => {
      writeQueue = writeQueue.then(write).catch(reportRepositoryError);
    };

    const persistCollection = <T extends IdentifiedVersionedRecord>(
      previous: T[],
      next: T[],
      persist: (changes: CollectionChanges<T>) => Promise<void>,
    ) => {
      const changes = diffCollectionChanges(previous, next);
      if (hasCollectionChanges(changes)) enqueue(() => persist(changes));
    };

    const start = async () => {
      const snapshot = await initializePermanentDataRepository();
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
          persistCollection(previousState.tasks, state.tasks, (changes) => stillRepository.persistTasks(changes));
        }
        if (state.events !== previousState.events) {
          persistCollection(previousState.events, state.events, (changes) => stillRepository.persistEvents(changes));
        }
        if (state.journalEntries !== previousState.journalEntries) {
          persistCollection(
            previousState.journalEntries,
            state.journalEntries,
            (changes) => stillRepository.persistJournalEntries(changes),
          );
        }
        if (state.expenses !== previousState.expenses) {
          persistCollection(previousState.expenses, state.expenses, (changes) => stillRepository.persistExpenses(changes));
        }
        if (state.entityLinks !== previousState.entityLinks) {
          persistCollection(
            previousState.entityLinks,
            state.entityLinks,
            (changes) => stillRepository.persistEntityLinks(changes),
          );
        }
        if (state.workShifts !== previousState.workShifts) {
          persistCollection(
            previousState.workShifts,
            state.workShifts,
            (changes) => stillRepository.persistWorkShifts(changes),
          );
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
