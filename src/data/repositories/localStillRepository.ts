import type { Table } from 'dexie';
import type { LifeEntityLink } from '../../domain/lifeAreas';
import type { WorkShift } from '../../domain/work';
import type {
  JournalEntry,
  StillEvent,
  StillExpense,
  StillTask,
} from '../../stores/useAppStore';
import { stillDb, withCheckInSyncMetadata } from '../localDb';
import type { CheckInRecord } from '../records';
import { activeRecords, reconcileCollection } from './reconcile';
import {
  PERMANENT_DATA_SCHEMA_VERSION,
  type PermanentDataCache,
  type PermanentDataSnapshot,
  type StillRepository,
  type SyncedRecord,
} from './types';

const BOOTSTRAP_META_KEY = `permanent-data-v${PERMANENT_DATA_SCHEMA_VERSION}`;

type RepositoryEntity = {
  id: string;
  updatedAt?: number;
  createdAt?: number;
};

async function syncTable<T extends RepositoryEntity>(
  table: Table<SyncedRecord<T>, string>,
  records: T[],
) {
  const existing = await table.toArray();
  const reconciled = reconcileCollection(existing, records);
  await table.bulkPut(reconciled);
}

async function seedTable<T extends RepositoryEntity>(
  table: Table<SyncedRecord<T>, string>,
  records: T[],
) {
  if (!records.length || await table.count() > 0) return;
  await table.bulkPut(reconcileCollection([], records));
}

function stripCheckInMetadata(record: Awaited<ReturnType<typeof stillDb.checkIns.get>> extends infer Row ? NonNullable<Row> : never): CheckInRecord {
  const {
    userId: _userId,
    schemaVersion: _schemaVersion,
    deletedAt: _deletedAt,
    ...checkIn
  } = record;
  return checkIn;
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
        stillDb.repositoryMeta,
      ],
      async () => {
        const alreadyBootstrapped = await stillDb.repositoryMeta.get(BOOTSTRAP_META_KEY);
        if (alreadyBootstrapped) return;

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
      },
    );

    return this.load();
  }

  async load(): Promise<PermanentDataSnapshot> {
    const [
      tasks,
      events,
      journalEntries,
      expenses,
      entityLinks,
      workShifts,
      checkIns,
    ] = await Promise.all([
      stillDb.tasks.toArray(),
      stillDb.events.toArray(),
      stillDb.journalEntries.toArray(),
      stillDb.expenses.toArray(),
      stillDb.entityLinks.toArray(),
      stillDb.workShifts.toArray(),
      this.listCheckIns(),
    ]);

    return {
      tasks: activeRecords(tasks),
      events: activeRecords(events),
      journalEntries: activeRecords(journalEntries),
      expenses: activeRecords(expenses),
      entityLinks: activeRecords(entityLinks),
      workShifts: activeRecords(workShifts),
      checkIns,
    };
  }

  syncTasks(records: StillTask[]) {
    return syncTable(stillDb.tasks, records);
  }

  syncEvents(records: StillEvent[]) {
    return syncTable(stillDb.events, records);
  }

  syncJournalEntries(records: JournalEntry[]) {
    return syncTable(stillDb.journalEntries, records);
  }

  syncExpenses(records: StillExpense[]) {
    return syncTable(stillDb.expenses, records);
  }

  syncEntityLinks(records: LifeEntityLink[]) {
    return syncTable(stillDb.entityLinks, records);
  }

  syncWorkShifts(records: WorkShift[]) {
    return syncTable(stillDb.workShifts, records);
  }

  async listCheckIns() {
    const records = await stillDb.checkIns.orderBy('date').reverse().toArray();
    return records.filter((record) => !record.deletedAt).map(stripCheckInMetadata);
  }

  async saveCheckIn(record: CheckInRecord) {
    const existing = await stillDb.checkIns.get(record.date);
    await stillDb.checkIns.put({
      ...withCheckInSyncMetadata(record),
      userId: existing?.userId ?? withCheckInSyncMetadata(record).userId,
      deletedAt: undefined,
    });
  }

  async deleteCheckIn(date: string) {
    const existing = await stillDb.checkIns.get(date);
    if (!existing) return;

    const deletedAt = Date.now();
    await stillDb.checkIns.put({
      ...existing,
      updatedAt: Math.max(existing.updatedAt, deletedAt),
      deletedAt,
    });
  }
}

export const localStillRepository = new LocalStillRepository();
