import type { Table } from 'dexie';
import type { LifeEntityLink } from '../../domain/lifeAreas';
import type { WorkShift } from '../../domain/work';
import type {
  AppNotification,
  JournalEntry,
  StillEvent,
  StillExpense,
  StillTask,
} from '../../stores/useAppStore';
import {
  defaultGranularSettings,
  isLegacyBundledAccountSettings,
  splitLegacyAccountSettings,
  type AccountSettings,
  type GeneralAccountSettings,
  type HealthSettings,
  type MoneySettings,
  type PermanentSettingsRecord,
  type WorkSettings,
} from '../accountSettings';
import { stillDb, withCheckInSyncMetadata } from '../localDb';
import type { CheckInRecord } from '../records';
import {
  syncOutboxKey,
  syncOutboxRecordForDirtyRow,
  type SyncOutboxSource,
} from '../syncOutboxCore';
import { activeRecords, addSyncMetadata, createMutationId, reconcileCollection } from './reconcile';
import type { CollectionChanges } from './recordChanges';
import {
  LOCAL_DEVICE_USER_ID,
  PERMANENT_DATA_SCHEMA_VERSION,
  type PermanentDataCache,
  type PermanentDataSnapshot,
  type StillRepository,
  type SyncMetadata,
  type SyncedCheckInRecord,
  type SyncedRecord,
  type SyncedSettingsRecord,
} from './types';

const BOOTSTRAP_META_KEY = `permanent-data-v${PERMANENT_DATA_SCHEMA_VERSION}`;

type RepositoryEntity = {
  id: string;
  updatedAt?: number;
  createdAt?: number;
};

async function syncOutboxForRows(
  source: SyncOutboxSource,
  rows: Array<Record<string, unknown>>,
  idKey: 'id' | 'date',
) {
  const dirtyEntries = [];
  const cleanKeys: string[] = [];

  for (const row of rows) {
    const recordId = String(row[idKey] ?? '');
    if (!recordId) continue;
    const entry = syncOutboxRecordForDirtyRow(source, row, idKey);
    if (entry) dirtyEntries.push(entry);
    else cleanKeys.push(syncOutboxKey(source, recordId));
  }

  if (dirtyEntries.length) await stillDb.syncOutbox.bulkPut(dirtyEntries);
  if (cleanKeys.length) await stillDb.syncOutbox.bulkDelete(cleanKeys);
}

async function seedTable<T extends RepositoryEntity>(
  source: SyncOutboxSource,
  table: Table<SyncedRecord<T>, string>,
  records: T[],
) {
  if (!records.length || await table.count() > 0) return;
  const seeded = reconcileCollection([], records);
  await table.bulkPut(seeded);
  await syncOutboxForRows(
    source,
    seeded as unknown as Array<Record<string, unknown>>,
    'id',
  );
}

async function seedLocalTable<T extends { id: string }>(
  table: Table<T, string>,
  records: T[],
) {
  if (!records.length || await table.count() > 0) return;
  await table.bulkPut(records);
}

async function persistTableChanges<T extends RepositoryEntity>(
  source: SyncOutboxSource,
  table: Table<SyncedRecord<T>, string>,
  changes: CollectionChanges<T>,
) {
  if (!changes.upserts.length && !changes.deletedIds.length) return;

  const ids = [...new Set([
    ...changes.upserts.map((record) => record.id),
    ...changes.deletedIds,
  ])];

  await stillDb.transaction('rw', [table, stillDb.syncOutbox], async () => {
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

    const changedRows = [...upserts, ...tombstones];
    if (!changedRows.length) return;
    await table.bulkPut(changedRows);
    await syncOutboxForRows(
      source,
      changedRows as unknown as Array<Record<string, unknown>>,
      'id',
    );
  });
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

function stripSettingsMetadata<T extends PermanentSettingsRecord | AccountSettings>(
  record: T & SyncMetadata,
): T {
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
  return settings as T;
}

function settingsRecordEqual(left: PermanentSettingsRecord, right: PermanentSettingsRecord) {
  const { updatedAt: _leftUpdatedAt, ...leftComparable } = left;
  const { updatedAt: _rightUpdatedAt, ...rightComparable } = right;
  return JSON.stringify(leftComparable) === JSON.stringify(rightComparable);
}

function defaultSettingsRecord(id: PermanentSettingsRecord['id']) {
  const defaults = defaultGranularSettings(0);
  if (id === 'account') return defaults.accountSettings;
  if (id === 'work') return defaults.workSettings;
  if (id === 'money') return defaults.moneySettings;
  return defaults.healthSettings;
}

function isDefaultSettingsRecord(settings: PermanentSettingsRecord) {
  return settingsRecordEqual(settings, defaultSettingsRecord(settings.id));
}

function isLocalPlaceholder(record: SyncedSettingsRecord) {
  return record.syncCounter === 0
    && record.dirty === false
    && record.serverRevision === undefined;
}

function createSettingsPlaceholder(
  settings: PermanentSettingsRecord,
  userId = LOCAL_DEVICE_USER_ID,
): SyncedSettingsRecord {
  return {
    ...settings,
    userId,
    schemaVersion: PERMANENT_DATA_SCHEMA_VERSION,
    deletedAt: undefined,
    syncCounter: 0,
    mutationId: `placeholder:${settings.id}`,
    serverRevision: undefined,
    dirty: false,
  } as SyncedSettingsRecord;
}

async function putSettingsRecordInTransaction(record: SyncedSettingsRecord) {
  await stillDb.accountSettings.put(record);
  await syncOutboxForRows(
    'accountSettings',
    [record as unknown as Record<string, unknown>],
    'id',
  );
}

async function seedSettingsRecordInTransaction(
  settings: PermanentSettingsRecord,
  userId = LOCAL_DEVICE_USER_ID,
) {
  const existing = await stillDb.accountSettings.get(settings.id);
  if (existing) return;
  const seeded = isDefaultSettingsRecord(settings)
    ? createSettingsPlaceholder(settings, userId)
    : addSyncMetadata(settings, undefined, userId) as unknown as SyncedSettingsRecord;
  await putSettingsRecordInTransaction(seeded);
}

async function persistSettingsRecord<T extends PermanentSettingsRecord>(settings: T) {
  await stillDb.transaction('rw', [stillDb.accountSettings, stillDb.syncOutbox], async () => {
    const existing = await stillDb.accountSettings.get(settings.id);
    if (existing) {
      const existingValue = stripSettingsMetadata(existing as SyncedSettingsRecord) as PermanentSettingsRecord;
      if (!isLegacyBundledAccountSettings(existingValue as unknown as Record<string, unknown>)
        && settingsRecordEqual(settings, existingValue)) return;
    }
    const next = addSyncMetadata(settings, existing) as unknown as SyncedSettingsRecord;
    await putSettingsRecordInTransaction(next);
  });
}

async function migrateLegacyDomainSettingInTransaction(
  existing: SyncedSettingsRecord | undefined,
  settings: WorkSettings | MoneySettings | HealthSettings,
  userId: string,
) {
  if (existing && !isLocalPlaceholder(existing)) return;
  const migrated = addSyncMetadata(settings, existing, userId) as unknown as SyncedSettingsRecord;
  await putSettingsRecordInTransaction(migrated);
}

async function ensureGranularSettingsRecords(cache?: Pick<
  PermanentDataCache,
  'accountSettings' | 'workSettings' | 'moneySettings' | 'healthSettings'
>) {
  const fallback = cache ?? defaultGranularSettings();

  await stillDb.transaction('rw', [stillDb.accountSettings, stillDb.syncOutbox], async () => {
    const rows = await stillDb.accountSettings.toArray();
    const byId = new Map(rows.map((row) => [row.id, row] as const));
    const existingAccount = byId.get('account');

    if (existingAccount) {
      const accountValue = stripSettingsMetadata(existingAccount as SyncedSettingsRecord);
      if (isLegacyBundledAccountSettings(accountValue as unknown as Record<string, unknown>)) {
        const source = splitLegacyAccountSettings(accountValue as AccountSettings);
        await migrateLegacyDomainSettingInTransaction(byId.get('work'), source.workSettings, existingAccount.userId);
        await migrateLegacyDomainSettingInTransaction(byId.get('money'), source.moneySettings, existingAccount.userId);
        await migrateLegacyDomainSettingInTransaction(byId.get('health'), source.healthSettings, existingAccount.userId);

        const sanitizedAccount = addSyncMetadata({
          ...source.accountSettings,
          updatedAt: Date.now(),
        }, existingAccount) as unknown as SyncedSettingsRecord;
        await putSettingsRecordInTransaction(sanitizedAccount);
        return;
      }
    } else {
      await seedSettingsRecordInTransaction(fallback.accountSettings);
    }

    if (!byId.has('work')) await seedSettingsRecordInTransaction(fallback.workSettings);
    if (!byId.has('money')) await seedSettingsRecordInTransaction(fallback.moneySettings);
    if (!byId.has('health')) await seedSettingsRecordInTransaction(fallback.healthSettings);
  });
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
        stillDb.notifications,
        stillDb.entityLinks,
        stillDb.workShifts,
        stillDb.repositoryMeta,
        stillDb.syncOutbox,
      ],
      async () => {
        const alreadyBootstrapped = await stillDb.repositoryMeta.get(BOOTSTRAP_META_KEY);

        if (!alreadyBootstrapped) {
          await seedTable('tasks', stillDb.tasks, cache.tasks);
          await seedTable('events', stillDb.events, cache.events);
          await seedTable('journalEntries', stillDb.journalEntries, cache.journalEntries);
          await seedTable('expenses', stillDb.expenses, cache.expenses);
          await seedLocalTable(stillDb.notifications, cache.notifications);
          await seedTable('entityLinks', stillDb.entityLinks, cache.entityLinks);
          await seedTable('workShifts', stillDb.workShifts, cache.workShifts);

          await stillDb.repositoryMeta.put({
            key: BOOTSTRAP_META_KEY,
            value: this.provider,
            updatedAt: Date.now(),
          });
        }
      },
    );

    await ensureGranularSettingsRecords(cache);
    return this.load();
  }

  async load(): Promise<PermanentDataSnapshot> {
    await ensureGranularSettingsRecords();

    const [
      tasks,
      events,
      journalEntries,
      expenses,
      notifications,
      entityLinks,
      workShifts,
      checkIns,
      storedAccountSettings,
      storedWorkSettings,
      storedMoneySettings,
      storedHealthSettings,
    ] = await Promise.all([
      stillDb.tasks.toArray(),
      stillDb.events.toArray(),
      stillDb.journalEntries.toArray(),
      stillDb.expenses.toArray(),
      stillDb.notifications.orderBy('createdAt').reverse().toArray(),
      stillDb.entityLinks.toArray(),
      stillDb.workShifts.toArray(),
      this.listCheckIns(),
      stillDb.accountSettings.get('account'),
      stillDb.accountSettings.get('work'),
      stillDb.accountSettings.get('money'),
      stillDb.accountSettings.get('health'),
    ]);

    if (!storedAccountSettings || !storedWorkSettings || !storedMoneySettings || !storedHealthSettings) {
      throw new Error('Still settings were not initialized.');
    }

    return {
      tasks: activeRecords(tasks),
      events: activeRecords(events),
      journalEntries: activeRecords(journalEntries),
      expenses: activeRecords(expenses),
      notifications,
      entityLinks: activeRecords(entityLinks),
      workShifts: activeRecords(workShifts),
      accountSettings: stripSettingsMetadata(storedAccountSettings) as GeneralAccountSettings,
      workSettings: stripSettingsMetadata(storedWorkSettings) as WorkSettings,
      moneySettings: stripSettingsMetadata(storedMoneySettings) as MoneySettings,
      healthSettings: stripSettingsMetadata(storedHealthSettings) as HealthSettings,
      checkIns,
    };
  }

  persistTasks(changes: CollectionChanges<StillTask>) { return persistTableChanges('tasks', stillDb.tasks, changes); }
  persistEvents(changes: CollectionChanges<StillEvent>) { return persistTableChanges('events', stillDb.events, changes); }
  persistJournalEntries(changes: CollectionChanges<JournalEntry>) { return persistTableChanges('journalEntries', stillDb.journalEntries, changes); }
  persistExpenses(changes: CollectionChanges<StillExpense>) { return persistTableChanges('expenses', stillDb.expenses, changes); }
  async persistNotifications(notifications: AppNotification[]) {
    await stillDb.transaction('rw', stillDb.notifications, async () => {
      await stillDb.notifications.clear();
      if (notifications.length) await stillDb.notifications.bulkPut(notifications);
    });
  }
  persistEntityLinks(changes: CollectionChanges<LifeEntityLink>) { return persistTableChanges('entityLinks', stillDb.entityLinks, changes); }
  persistWorkShifts(changes: CollectionChanges<WorkShift>) { return persistTableChanges('workShifts', stillDb.workShifts, changes); }
  persistAccountSettings(settings: GeneralAccountSettings) { return persistSettingsRecord(settings); }
  persistWorkSettings(settings: WorkSettings) { return persistSettingsRecord(settings); }
  persistMoneySettings(settings: MoneySettings) { return persistSettingsRecord(settings); }
  persistHealthSettings(settings: HealthSettings) { return persistSettingsRecord(settings); }

  async listCheckIns() {
    const records = await stillDb.checkIns.orderBy('date').reverse().toArray();
    return records.filter((record) => !record.deletedAt).map(stripCheckInMetadata);
  }

  async saveCheckIn(record: CheckInRecord) {
    await stillDb.transaction('rw', [stillDb.checkIns, stillDb.syncOutbox], async () => {
      const existing = await stillDb.checkIns.get(record.date);
      const mergedRecord: CheckInRecord = existing
        ? { ...stripCheckInMetadata(existing), ...record }
        : record;
      const syncedRecord = withCheckInSyncMetadata(mergedRecord);
      const next: SyncedCheckInRecord = {
        ...syncedRecord,
        userId: existing?.userId ?? syncedRecord.userId,
        deletedAt: undefined,
        syncCounter: (existing?.syncCounter ?? 0) + 1,
        mutationId: createMutationId(),
        serverRevision: existing?.serverRevision,
        dirty: true,
      };
      await stillDb.checkIns.put(next);
      await syncOutboxForRows(
        'checkIns',
        [next as unknown as Record<string, unknown>],
        'date',
      );
    });
  }

  async deleteCheckIn(date: string) {
    await stillDb.transaction('rw', [stillDb.checkIns, stillDb.syncOutbox], async () => {
      const existing = await stillDb.checkIns.get(date);
      if (!existing) return;

      const deletedAt = Date.now();
      const next: SyncedCheckInRecord = {
        ...existing,
        updatedAt: deletedAt,
        deletedAt,
        syncCounter: existing.syncCounter + 1,
        mutationId: createMutationId(),
        dirty: true,
      };
      await stillDb.checkIns.put(next);
      await syncOutboxForRows(
        'checkIns',
        [next as unknown as Record<string, unknown>],
        'date',
      );
    });
  }
}

export const localStillRepository = new LocalStillRepository();
