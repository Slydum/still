import { useEffect } from 'react';
import {
  accountSettingsStatePatch,
  generalAccountSettingsFromState,
  healthSettingsFromState,
  moneySettingsFromState,
  workSettingsFromState,
  type AccountSettingsSource,
} from '../data/accountSettings';
import { refreshCloudSyncStatus } from '../data/cloudSyncStatus';
import { stillRepository, type PermanentDataCache } from '../data/repositories';
import {
  diffCollectionChanges,
  hasCollectionChanges,
  type CollectionChanges,
  type IdentifiedVersionedRecord,
} from '../data/repositories/recordChanges';
import { enqueueRepositoryWrite } from '../data/repositoryWriteQueue';
import {
  DEFAULT_HEALTH_SIGNAL_PREFERENCES,
  EMPTY_HEALTH_ROUTINES,
  type HealthSettingsState,
} from '../domain/health';
import {
  EMPTY_MONEY_ACCOUNTS,
  EMPTY_MONEY_BILLS,
  EMPTY_MONEY_SAVINGS_GOALS,
  type MoneySettingsState,
} from '../domain/money';
import { useAppStore } from '../stores/useAppStore';
import { usePersistenceStatus } from '../stores/usePersistenceStatus';
import { getLocalDateKey } from '../theme/stillContext';

let bootstrapPromise: ReturnType<typeof stillRepository.bootstrap> | undefined;
// Hydration and cloud acknowledgements update the view model, not user intent.
// Suppress the store subscriber so those snapshots do not become fresh dirty writes.
let applyingRepositorySnapshot = false;

type StoreWithLifeSettings = ReturnType<typeof useAppStore.getState>
  & Partial<MoneySettingsState>
  & Partial<HealthSettingsState>;

function settingsSourceFromStore(): AccountSettingsSource {
  const state = useAppStore.getState() as StoreWithLifeSettings;
  return {
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
    moneyAccounts: state.moneyAccounts ?? EMPTY_MONEY_ACCOUNTS,
    moneyBills: state.moneyBills ?? EMPTY_MONEY_BILLS,
    moneySavingsGoals: state.moneySavingsGoals ?? EMPTY_MONEY_SAVINGS_GOALS,
    moneyPrivacyHidden: state.moneyPrivacyHidden ?? true,
    healthRoutines: state.healthRoutines ?? EMPTY_HEALTH_ROUTINES,
    healthSignalPreferences: state.healthSignalPreferences ?? DEFAULT_HEALTH_SIGNAL_PREFERENCES,
  };
}

function cacheFromStore(): PermanentDataCache {
  const state = useAppStore.getState();
  const source = settingsSourceFromStore();
  const now = Date.now();
  return {
    tasks: state.tasks,
    events: state.events,
    journalEntries: state.journalEntries,
    expenses: state.expenses,
    notifications: state.notifications,
    entityLinks: state.entityLinks,
    workShifts: state.workShifts,
    accountSettings: generalAccountSettingsFromState(source, now),
    workSettings: workSettingsFromState(source, now),
    moneySettings: moneySettingsFromState(source, now),
    healthSettings: healthSettingsFromState(source, now),
  };
}

export function applyPermanentDataSnapshot(snapshot: PermanentDataCache & { checkIns?: Array<{
  date: string;
  mood?: number;
  energy?: number;
}> }) {
  applyingRepositorySnapshot = true;
  try {
    const today = getLocalDateKey();
    const todayCheckIn = snapshot.checkIns?.find((record) => record.date === today);
    useAppStore.setState({
      tasks: snapshot.tasks,
      events: snapshot.events,
      journalEntries: snapshot.journalEntries,
      expenses: snapshot.expenses,
      notifications: snapshot.notifications,
      entityLinks: snapshot.entityLinks,
      workShifts: snapshot.workShifts,
      mood: todayCheckIn?.mood,
      energy: todayCheckIn?.energy,
      checkInDate: today,
      ...accountSettingsStatePatch(
        snapshot.accountSettings,
        snapshot.workSettings,
        snapshot.moneySettings,
        snapshot.healthSettings,
      ),
    });
  } finally {
    applyingRepositorySnapshot = false;
  }
}

function reportRepositoryError(error: unknown) {
  usePersistenceStatus.getState().setFailure(error);
  console.error('Still could not synchronize its permanent data repository:', error);
}

function reportRepositorySuccess() {
  usePersistenceStatus.getState().markSaved();
  void refreshCloudSyncStatus().catch((error) => {
    console.warn('Still could not refresh cloud sync status after a local save:', error);
  });
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
    let pendingWrites = 0;

    const enqueue = (write: () => Promise<void>) => {
      pendingWrites += 1;
      usePersistenceStatus.getState().markSaving();
      enqueueRepositoryWrite(write, {
        onSuccess: () => {
          pendingWrites = Math.max(0, pendingWrites - 1);
          if (pendingWrites === 0) reportRepositorySuccess();
        },
        onError: (error) => {
          pendingWrites = Math.max(0, pendingWrites - 1);
          reportRepositoryError(error);
        },
      });
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

      applyPermanentDataSnapshot(snapshot);

      unsubscribe = useAppStore.subscribe((state, previousState) => {
        if (applyingRepositorySnapshot) return;

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
        if (state.notifications !== previousState.notifications) {
          enqueue(() => stillRepository.persistNotifications(state.notifications));
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

        const lifeSettings = state as StoreWithLifeSettings;
        const previousLifeSettings = previousState as StoreWithLifeSettings;
        const source = () => settingsSourceFromStore();

        const accountSettingsChanged =
          state.name !== previousState.name
          || state.appearanceTone !== previousState.appearanceTone
          || state.reduceMotion !== previousState.reduceMotion
          || state.taskReminders !== previousState.taskReminders
          || state.eventReminders !== previousState.eventReminders
          || state.dailyCheckInReminder !== previousState.dailyCheckInReminder
          || state.reminderTime !== previousState.reminderTime
          || state.eventReminderMinutes !== previousState.eventReminderMinutes;
        if (accountSettingsChanged) {
          enqueue(() => stillRepository.persistAccountSettings(generalAccountSettingsFromState(source())));
        }

        const workSettingsChanged =
          state.workProfile !== previousState.workProfile
          || state.workPrivacyBlur !== previousState.workPrivacyBlur;
        if (workSettingsChanged) {
          enqueue(() => stillRepository.persistWorkSettings(workSettingsFromState(source())));
        }

        const moneySettingsChanged =
          lifeSettings.moneyAccounts !== previousLifeSettings.moneyAccounts
          || lifeSettings.moneyBills !== previousLifeSettings.moneyBills
          || lifeSettings.moneySavingsGoals !== previousLifeSettings.moneySavingsGoals
          || lifeSettings.moneyPrivacyHidden !== previousLifeSettings.moneyPrivacyHidden;
        if (moneySettingsChanged) {
          enqueue(() => stillRepository.persistMoneySettings(moneySettingsFromState(source())));
        }

        const healthSettingsChanged =
          lifeSettings.healthRoutines !== previousLifeSettings.healthRoutines
          || lifeSettings.healthSignalPreferences !== previousLifeSettings.healthSignalPreferences;
        if (healthSettingsChanged) {
          enqueue(() => stillRepository.persistHealthSettings(healthSettingsFromState(source())));
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
