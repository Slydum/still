import type { Table } from 'dexie';
import type { LifeEntityLink } from '../../domain/lifeAreas';
import type { WorkShift } from '../../domain/work';
import type {
  JournalEntry,
  StillEvent,
  StillExpense,
  StillTask,
} from '../../stores/useAppStore';
import type { AccountSettings } from '../accountSettings';
import { stillDb, withCheckInSyncMetadata } from '../localDb';
import type { CheckInRecord } from '../records';
import { activeRecords, addSyncMetadata, createMutationId, reconcileCollection } from './reconcile';
import type { CollectionChanges } from './recordChanges';
import {
  PERMANENT_DATA_SCHEMA_VERSION,
  type PermanentDataCache,
  type PermanentDataSnapshot,
  type StillRepository,
  type SyncedAccountSettings,
  type SyncedCheckInRecord,
  type SyncedRecord,
} from './types';

const BOOTSTRAP_META_KEY = `permanent-data-v${PERMANENT_DATA_SCHEMA_VERSION}`;

type RepositoryEntity = {
  id: string;
  updatedAt?: number;
  createdAt?: number;
};

async function seedTable<T extends RepositoryEntity>(
  table: Table<SyncedRecord<T>, string>,
  records: T[],
) {
  if (!records.length || await table.count() > 0) return;
  await table.bulkPut(reconcileCollection([], records));
}

async function persistTableChanges<T extends RepositoryEntity>(
  table: Table<SyncedRecord<T>, string>,
  changes: CollectionChanges<T>,
) {
  if (!changes.upserts.length && !changes.deletedIds.length) return;

  const ids = [...new Set([
    ...changes.upserts.map((record) => record.id),
    ...changes.deletedIds,
  ])];
  const existingRows = await table.bulkGet(ids);
  const existingById = new Map(
    ids.flatMap((id, index) => {
      const record = existingRows[index];
      return record ? [[id, record] as const] : [];
    }),
  );

  const upserts = changes.upserts.map((record) => addSyncMetadata(record, existingById.get(record.id)));

  const now = Date.now();
  const tombstones = changes.deletedIds.flatMap((id) => {
    const existing = existingById.get(id);
    if (!existing) return [];
    if (existing.deletedAt) return [existing];

    return [{
      ...existing,
      updatedAt: now,
      deletedAt: now,
      syncCounter: existing.syncCounter + 1,
      mutationId: createMutationId(),
      dirty: true,
    }];
  });

  await table.bulkPut([...upserts, ...tombstones]);
}

function stripCheckInMetadata(record: SyncedCheckInRecord): CheckInRecord {
  const {
    userId: _userId,
    schemaVersion: _schemaVersion,
    deletedAt: _deletedAt,
    syncCounter: _syncCounter,
    mutationId: _mutationId,
    serverRevision: _serverRevision,
    dirty: _dirty,
    ...checkIn
  } = record;
  return checkIn;
}

function stripSettingsMetadata(record: SyncedAccountSettings): AccountSettings {
  const {
    userId: _userId,
    schemaVersion: _schemaVersion,
    deletedAt: _deletedAt,
    syncCounter: _syncCounter,
    mutationId: _mutationId,
    serverRevision: _serverRevision,
    dirty: _dirty,
    ...settings
  } = record;
  return settings;
}

export class LocalStillRepository implements StillRepository {
  readonly provider = 'local' as const;
  readonly schemaVersion = PERMANENT_DATA_SCHEMA_VERSION;

  async bootstrap(cache: PermanentDataCache): Promise<PermanentDataSnapshot> {
    await stillDb.transaction(
      'rw',
      [
        stillDb.tasks,
        stillDb.events,
        stillDb.journalEntries,
        stillDb.expenses,
        stillDb.entityLinks,
        stillDb.workShifts,
        stillDb.accountSettings,
        stillDb.repositoryMeta,
      ],
      async () => {
        const alreadyBootstrapped = await stillDb.repositoryMeta.get(BOOTSTRAP_META_KEY);

        if (!alreadyBootstrapped) {
          await seedTable(stillDb.tasks, cache.tasks);
          await seedTable(stillDb.events, cache.events);
          await seedTable(stillDb.journalEntries, cache.journalEntries);
          await seedTable(stillDb.expenses, cache.expenses);
          await seedTable(stillDb.entityLinks, cache.entityLinks);
          await seedTable(stillDb.workShifts, cache.workShifts);

          await stillDb.repositoryMeta.put({
            key: BOOTSTRAP_META_KEY,
            value: this.provider,
            updatedAt: Date.now(),
          });
        }

        if (await stillDb.accountSettings.count() === 0) {
          await stillDb.accountSettings.put(addSyncMetadata(cache.accountSettings));
        }
      },
    );

    return this.load();
  }

  async load(): Promise<PermanentDataSnapshot> {
    const [tasks, events, journalEntries, expenses, entityLinks, workShifts, checkIns, storedSettings] = await Promise.all([
      stillDb.tasks.toArray(),
      stillDb.events.toArray(),
      stillDb.journalEntries.toArray(),
      stillDb.expenses.toArray(),
      stillDb.entityLinks.toArray(),
      stillDb.workShifts.toArray(),
      this.listCheckIns(),
      stillDb.accountSettings.get('account'),
    ]);

    if (!storedSettings) throw new Error('Still account settings were not initialized.');

    return {
      tasks: activeRecords(tasks),
      events: activeRecords(events),
      journalEntries: activeRecords(journalEntries),
      expenses: activeRecords(expenses),
      entityLinks: activeRecords(entityLinks),
      workShifts: activeRecords(workShifts),
      accountSettings: stripSettingsMetadata(storedSettings),
      checkIns,
    };
  }

  persistTasks(changes: CollectionChanges<StillTask>) { return persistTableChanges(stillDb.tasks, changes); }
  persistEvents(changes: CollectionChanges<StillEvent>) { return persistTableChanges(stillDb.events, changes); }
  persistJournalEntries(changes: CollectionChanges<JournalEntry>) { return persistTableChanges(stillDb.journalEntries, changes); }
  persistExpenses(changes: CollectionChanges<StillExpense>) { return persistTableChanges(stillDb.expenses, changes); }
  persistEntityLinks(changes: CollectionChanges<LifeEntityLink>) { return persistTableChanges(stillDb.entityLinks, changes); }
  persistWorkShifts(changes: CollectionChanges<WorkShift>) { return persistTableChanges(stillDb.workShifts, changes); }

  async persistAccountSettings(settings: AccountSettings) {
    const existing = await stillDb.accountSettings.get('account');
    await stillDb.accountSettings.put(addSyncMetadata(settings, existing));
  }

  async listCheckIns() {
    const records = await stillDb.checkIns.orderBy('date').reverse().toArray();
    return records.filter((record) => !record.deletedAt).map(stripCheckInMetadata);
  }

  async saveCheckIn(record: CheckInRecord) {
    const existing = await stillDb.checkIns.get(record.date);
    const syncedRecord = withCheckInSyncMetadata(record);
    await stillDb.checkIns.put({
      ...syncedRecord,
      userId: existing?.userId ?? syncedRecord.userId,
      deletedAt: undefined,
      syncCounter: (existing?.syncCounter ?? 0) + 1,
      mutationId: createMutationId(),
      serverRevision: existing?.serverRevision,
      dirty: true,
    });
  }

  async deleteCheckIn(date: string) {
    const existing = await stillDb.checkIns.get(date);
    if (!existing) return;

    const deletedAt = Date.now();
    await stillDb.checkIns.put({
      ...existing,
      updatedAt: deletedAt,
      deletedAt,
      syncCounter: existing.syncCounter + 1,
      mutationId: createMutationId(),
      dirty: true,
    });
  }
}

export const localStillRepository = new LocalStillRepository();