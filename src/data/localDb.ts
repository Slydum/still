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

function legacyMutationId(key: string, updatedAt: number) {
  return `legacy:${key}:${updatedAt}`;
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
    syncCounter: existing.syncCounter ?? 1,
    mutationId: existing.mutationId ?? legacyMutationId(record.date, record.updatedAt),
    serverRevision: existing.serverRevision,
    dirty: existing.dirty ?? true,
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
    this.version(4).stores({
      dailyQuotes: 'date, quoteId, createdAt',
      checkIns: 'date, updatedAt, scaleVersion, userId, deletedAt, syncCounter, serverRevision',
      tasks: 'id, updatedAt, userId, deletedAt, syncCounter, serverRevision',
      events: 'id, updatedAt, userId, deletedAt, syncCounter, serverRevision',
      journalEntries: 'id, updatedAt, userId, deletedAt, syncCounter, serverRevision',
      expenses: 'id, updatedAt, userId, deletedAt, syncCounter, serverRevision',
      entityLinks: 'id, updatedAt, userId, deletedAt, syncCounter, serverRevision',
      workShifts: 'id, updatedAt, userId, deletedAt, syncCounter, serverRevision',
      repositoryMeta: 'key, updatedAt',
    }).upgrade(async (transaction) => {
      const migrateTable = async (name: string, key: 'id' | 'date') => {
        await transaction.table<Record<string, unknown>>(name).toCollection().modify((record) => {
          const updatedAt = Number(record.updatedAt) || Date.now();
          const recordKey = String(record[key] ?? name);
          record.syncCounter = Number(record.syncCounter) || 1;
          record.mutationId = String(record.mutationId || legacyMutationId(recordKey, updatedAt));
          record.dirty = record.dirty === false ? false : true;
        });
      };

      await migrateTable('checkIns', 'date');
      await migrateTable('tasks', 'id');
      await migrateTable('events', 'id');
      await migrateTable('journalEntries', 'id');
      await migrateTable('expenses', 'id');
      await migrateTable('entityLinks', 'id');
      await migrateTable('workShifts', 'id');
    });
  }
}

export const stillDb = new StillLocalDatabase();
export { withCheckInSnapshot, withCheckInSyncMetadata };
