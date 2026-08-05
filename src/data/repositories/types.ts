import type { LifeEntityLink } from '../../domain/lifeAreas';
import type { WorkShift } from '../../domain/work';
import type {
  JournalEntry,
  StillEvent,
  StillExpense,
  StillTask,
} from '../../stores/useAppStore';
import type { CheckInRecord } from '../records';

export const PERMANENT_DATA_SCHEMA_VERSION = 1;
export const LOCAL_DEVICE_USER_ID = 'local-device';

export type RepositoryProvider = 'local' | 'supabase';

export type SyncMetadata = {
  userId: string;
  schemaVersion: number;
  updatedAt: number;
  deletedAt?: number;
};

export type SyncedRecord<T extends { id: string }> = T & SyncMetadata;
export type SyncedCheckInRecord = CheckInRecord & SyncMetadata;

export type PermanentDataCache = {
  tasks: StillTask[];
  events: StillEvent[];
  journalEntries: JournalEntry[];
  expenses: StillExpense[];
  entityLinks: LifeEntityLink[];
  workShifts: WorkShift[];
};

export type PermanentDataSnapshot = PermanentDataCache & {
  checkIns: CheckInRecord[];
};

export interface StillRepository {
  readonly provider: RepositoryProvider;
  readonly schemaVersion: number;

  bootstrap(cache: PermanentDataCache): Promise<PermanentDataSnapshot>;
  load(): Promise<PermanentDataSnapshot>;

  syncTasks(records: StillTask[]): Promise<void>;
  syncEvents(records: StillEvent[]): Promise<void>;
  syncJournalEntries(records: JournalEntry[]): Promise<void>;
  syncExpenses(records: StillExpense[]): Promise<void>;
  syncEntityLinks(records: LifeEntityLink[]): Promise<void>;
  syncWorkShifts(records: WorkShift[]): Promise<void>;

  listCheckIns(): Promise<CheckInRecord[]>;
  saveCheckIn(record: CheckInRecord): Promise<void>;
  deleteCheckIn(date: string): Promise<void>;
}
