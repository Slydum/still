import type { LifeEntityLink } from '../../domain/lifeAreas';
import type { WorkShift } from '../../domain/work';
import type {
  JournalEntry,
  StillEvent,
  StillExpense,
  StillTask,
} from '../../stores/useAppStore';
import type {
  AccountSettings,
  GeneralAccountSettings,
  HealthSettings,
  MoneySettings,
  PermanentSettingsRecord,
  WorkSettings,
} from '../accountSettings';
import type { CheckInRecord } from '../records';
import type { CollectionChanges } from './recordChanges';

export const PERMANENT_DATA_SCHEMA_VERSION = 2;
export const LOCAL_DEVICE_USER_ID = 'local-device';

export type RepositoryProvider = 'local' | 'supabase';

export type SyncMetadata = {
  userId: string;
  schemaVersion: number;
  updatedAt: number;
  deletedAt?: number;
  syncCounter: number;
  mutationId: string;
  serverRevision?: number;
  dirty: boolean;
};

export type SyncedRecord<T extends { id: string }> = T & SyncMetadata;
export type SyncedCheckInRecord = CheckInRecord & SyncMetadata;
export type PersistedSettingsRecord = PermanentSettingsRecord | AccountSettings;
export type SyncedSettingsRecord = SyncedRecord<PersistedSettingsRecord>;

export type PermanentDataCache = {
  tasks: StillTask[];
  events: StillEvent[];
  journalEntries: JournalEntry[];
  expenses: StillExpense[];
  entityLinks: LifeEntityLink[];
  workShifts: WorkShift[];
  accountSettings: GeneralAccountSettings;
  workSettings: WorkSettings;
  moneySettings: MoneySettings;
  healthSettings: HealthSettings;
};

export type PermanentDataSnapshot = PermanentDataCache & {
  checkIns: CheckInRecord[];
};

export interface StillRepository {
  readonly provider: RepositoryProvider;
  readonly schemaVersion: number;

  bootstrap(cache: PermanentDataCache): Promise<PermanentDataSnapshot>;
  load(): Promise<PermanentDataSnapshot>;

  persistTasks(changes: CollectionChanges<StillTask>): Promise<void>;
  persistEvents(changes: CollectionChanges<StillEvent>): Promise<void>;
  persistJournalEntries(changes: CollectionChanges<JournalEntry>): Promise<void>;
  persistExpenses(changes: CollectionChanges<StillExpense>): Promise<void>;
  persistEntityLinks(changes: CollectionChanges<LifeEntityLink>): Promise<void>;
  persistWorkShifts(changes: CollectionChanges<WorkShift>): Promise<void>;
  persistAccountSettings(settings: GeneralAccountSettings): Promise<void>;
  persistWorkSettings(settings: WorkSettings): Promise<void>;
  persistMoneySettings(settings: MoneySettings): Promise<void>;
  persistHealthSettings(settings: HealthSettings): Promise<void>;

  listCheckIns(): Promise<CheckInRecord[]>;
  saveCheckIn(record: CheckInRecord): Promise<void>;
  deleteCheckIn(date: string): Promise<void>;
}

export type { CollectionChanges } from './recordChanges';
