import { useEffect } from 'react';
import { accountSettingsFromState, accountSettingsStatePatch } from '../data/accountSettings';
import { stillRepository, type PermanentDataCache } from '../data/repositories';
import {
  diffCollectionChanges,
  hasCollectionChanges,
  type CollectionChanges,
  type IdentifiedVersionedRecord,
} from '../data/repositories/recordChanges';
import { useAppStore } from '../stores/useAppStore';
import { usePersistenceStatus } from '../stores/usePersistenceStatus';

let bootstrapPromise: ReturnType<typeof stillRepository.bootstrap> | undefined;

function accountSettingsFromStore() {
  const state = useAppStore.getState();
  return accountSettingsFromState({
    name: state.name,
    appearanceTone: state.appearanceTone,
    reduceMotion: state.reduceMotion,
    taskReminders: state.taskReminders,
    eventReminders: state.eventReminders,
    dailyCheckInReminder: state.dailyCheckInReminder,
    reminderTime: state.reminderTime,
    eventReminderMinutes: state.eventReminderMinutes,
    workProfile: state.workProfile,
    workPrivacyBlur: state.workPrivacyBlur,
  });
}

function cacheFromStore(): PermanentDataCache {
  const state = useAppStore.getState();
  return {
    tasks: state.tasks,
    events: state.events,
    journalEntries: state.journalEntries,
    expenses: state.expenses,
    entityLinks: state.entityLinks,
    workShifts: state.workShifts,
    accountSettings: accountSettingsFromStore(),
  };
}

function reportRepositoryError(error: unknown) {
  usePersistenceStatus.getState().setFailure(error);
  console.error('Still could not synchronize its permanent data repository:', error);
}

function reportRepositorySuccess() {
  usePersistenceStatus.getState().clearFailure();
}

export function initializePermanentDataRepository() {
  bootstrapPromise ??= stillRepository.bootstrap(cacheFromStore())
    .then((snapshot) => {
      reportRepositorySuccess();
      return snapshot;
    })
    .catch((error) => {
      reportRepositoryError(error);
      bootstrapPromise = undefined;
      throw error;
    });
  return bootstrapPromise;
}

export function usePermanentDataRepository() {
  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    let writeQueue = Promise.resolve();

    const enqueue = (write: () => Promise<void>) => {
      writeQueue = writeQueue
        .then(async () => {
          await write();
          reportRepositorySuccess();
        })
        .catch(reportRepositoryError);
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
        ...accountSettingsStatePatch(snapshot.accountSettings),
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

        const accountSettingsChanged =
          state.name !== previousState.name
          || state.appearanceTone !== previousState.appearanceTone
          || state.reduceMotion !== previousState.reduceMotion
          || state.taskReminders !== previousState.taskReminders
          || state.eventReminders !== previousState.eventReminders
          || state.dailyCheckInReminder !== previousState.dailyCheckInReminder
          || state.reminderTime !== previousState.reminderTime
          || state.eventReminderMinutes !== previousState.eventReminderMinutes
          || state.workProfile !== previousState.workProfile
          || state.workPrivacyBlur !== previousState.workPrivacyBlur;

        if (accountSettingsChanged) {
          enqueue(() => stillRepository.persistAccountSettings(accountSettingsFromStore()));
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
