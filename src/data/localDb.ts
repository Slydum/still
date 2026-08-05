import Dexie, { type Table } from 'dexie';
import type { LifeEntityLink } from '../domain/lifeAreas';
import type { WorkShift } from '../domain/work';
import type {
  JournalEntry,
  StillEvent,
  StillExpense,
  StillTask,
} from '../stores/useAppStore';
import {
  CHECK_IN_SCALE_VERSION,
  createCheckInSnapshot,
} from '../features/check-ins/checkInScale';
import type { CheckInRecord, DailyQuoteRecord } from './records';
import {
  LOCAL_DEVICE_USER_ID,
  PERMANENT_DATA_SCHEMA_VERSION,
  type SyncMetadata,
  type SyncedCheckInRecord,
  type SyncedRecord,
} from './repositories/types';

export type RepositoryMetaRecord = {
  key: string;
  value: string;
  updatedAt: number;
};

function withCheckInSnapshot(record: CheckInRecord): CheckInRecord {
  const snapshot = createCheckInSnapshot(record.mood, record.energy);
  if (!snapshot.answerSnapshot) return record;

  return {
    ...record,
    answerSnapshot: snapshot.answerSnapshot,
    scaleVersion: CHECK_IN_SCALE_VERSION,
  };
}

function withCheckInSyncMetadata(record: CheckInRecord): SyncedCheckInRecord {
  const snapshotted = withCheckInSnapshot(record);
  const existing = record as CheckInRecord & Partial<SyncMetadata>;
  return {
    ...snapshotted,
    userId: existing.userId ?? LOCAL_DEVICE_USER_ID,
    schemaVersion: PERMANENT_DATA_SCHEMA_VERSION,
    updatedAt: record.updatedAt,
    deletedAt: existing.deletedAt,
  };
}

export class StillLocalDatabase extends Dexie {
  dailyQuotes!: Table<DailyQuoteRecord, string>;
  checkIns!: Table<SyncedCheckInRecord, string>;
  tasks!: Table<SyncedRecord<StillTask>, string>;
  events!: Table<SyncedRecord<StillEvent>, string>;
  journalEntries!: Table<SyncedRecord<JournalEntry>, string>;
  expenses!: Table<SyncedRecord<StillExpense>, string>;
  entityLinks!: Table<SyncedRecord<LifeEntityLink>, string>;
  workShifts!: Table<SyncedRecord<WorkShift & { id: string }>, string>;
  repositoryMeta!: Table<RepositoryMetaRecord, string>;

  constructor() {
    super('still-local');
    this.version(1).stores({
      dailyQuotes: 'date, quoteId, createdAt',
      checkIns: 'date, updatedAt',
    });
    this.version(2).stores({
      dailyQuotes: 'date, quoteId, createdAt',
      checkIns: 'date, updatedAt, scaleVersion',
    }).upgrade(async (transaction) => {
      await transaction.table<CheckInRecord>('checkIns').toCollection().modify((record) => {
        const migrated = withCheckInSnapshot(record);
        record.answerSnapshot = migrated.answerSnapshot;
        record.scaleVersion = migrated.scaleVersion;
      });
    });
    this.version(3).stores({
      dailyQuotes: 'date, quoteId, createdAt',
      checkIns: 'date, updatedAt, scaleVersion, userId, deletedAt',
      tasks: 'id, updatedAt, userId, deletedAt',
      events: 'id, updatedAt, userId, deletedAt',
      journalEntries: 'id, updatedAt, userId, deletedAt',
      expenses: 'id, updatedAt, userId, deletedAt',
      entityLinks: 'id, updatedAt, userId, deletedAt',
      workShifts: 'id, updatedAt, userId, deletedAt',
      repositoryMeta: 'key, updatedAt',
    }).upgrade(async (transaction) => {
      await transaction.table<CheckInRecord>('checkIns').toCollection().modify((record) => {
        const migrated = withCheckInSyncMetadata(record);
        Object.assign(record, migrated);
      });
    });
  }
}

export const stillDb = new StillLocalDatabase();
export { withCheckInSnapshot, withCheckInSyncMetadata };
