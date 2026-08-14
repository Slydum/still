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

async function seedTable<T extends RepositoryEntity>(
  table: Table<SyncedRecord<T>, string>,
  records: T[],
) {
  if (!records.length || await table.count() > 0) return;
  await table.bulkPut(reconcileCollection([], records));
}

async function seedLocalTable<T extends { id: string }>(
  table: Table<T, string>,
  records: T[],
) {
  if (!records.length || await table.count() > 0) return;
  await table.bulkPut(records);
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

async function seedSettingsRecord(
  settings: PermanentSettingsRecord,
  userId = LOCAL_DEVICE_USER_ID,
) {
  const existing = await stillDb.accountSettings.get(settings.id);
  if (existing) return;
  const seeded = isDefaultSettingsRecord(settings)
    ? createSettingsPlaceholder(settings, userId)
    : addSyncMetadata(settings, undefined, userId) as unknown as SyncedSettingsRecord;
  await stillDb.accountSettings.put(seeded);
}

async function persistSettingsRecord<T extends PermanentSettingsRecord>(settings: T) {
  const existing = await stillDb.accountSettings.get(settings.id);
  if (existing) {
    const existingValue = stripSettingsMetadata(existing as SyncedSettingsRecord) as PermanentSettingsRecord;
    if (!isLegacyBundledAccountSettings(existingValue as unknown as Record<string, unknown>)
      && settingsRecordEqual(settings, existingValue)) return;
  }
  const next = addSyncMetadata(settings, existing) as unknown as SyncedSettingsRecord;
  await stillDb.accountSettings.put(next);
}

async function migrateLegacyDomainSetting(
  existing: SyncedSettingsRecord | undefined,
  settings: WorkSettings | MoneySettings | HealthSettings,
  userId: string,
) {
  if (existing && !isLocalPlaceholder(existing)) return;
  const migrated = addSyncMetadata(settings, existing, userId) as unknown as SyncedSettingsRecord;
  await stillDb.accountSettings.put(migrated);
}

async function ensureGranularSettingsRecords(cache?: Pick<
  PermanentDataCache,
  'accountSettings' | 'workSettings' | 'moneySettings' | 'healthSettings'
>) {
  const fallback = cache ?? defaultGranularSettings();
  const rows = await stillDb.accountSettings.toArray();
  const byId = new Map(rows.map((row) => [row.id, row] as const));
  const existingAccount = byId.get('account');

  if (existingAccount) {
    const accountValue = stripSettingsMetadata(existingAccount as SyncedSettingsRecord);
    if (isLegacyBundledAccountSettings(accountValue as unknown as Record<string, unknown>)) {
      const source = splitLegacyAccountSettings(accountValue as AccountSettings);
      await migrateLegacyDomainSetting(byId.get('work'), source.workSettings, existingAccount.userId);
      await migrateLegacyDomainSetting(byId.get('money'), source.moneySettings, existingAccount.userId);
      await migrateLegacyDomainSetting(byId.get('health'), source.healthSettings, existingAccount.userId);

      const sanitizedAccount = addSyncMetadata({
        ...source.accountSettings,
        updatedAt: Date.now(),
      }, existingAccount) as unknown as SyncedSettingsRecord;
      await stillDb.accountSettings.put(sanitizedAccount);
      return;
    }
  } else {
    await seedSettingsRecord(fallback.accountSettings);
  }

  if (!byId.has('work')) await seedSettingsRecord(fallback.workSettings);
  if (!byId.has('money')) await seedSettingsRecord(fallback.moneySettings);
  if (!byId.has('health')) await seedSettingsRecord(fallback.healthSettings);
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
          await seedLocalTable(stillDb.notifications, cache.notifications);
          await seedTable(stillDb.entityLinks, cache.entityLinks);
          await seedTable(stillDb.workShifts, cache.workShifts);
          await ensureGranularSettingsRecords(cache);

          await stillDb.repositoryMeta.put({
            key: BOOTSTRAP_META_KEY,
            value: this.provider,
            updatedAt: Date.now(),
          });
        } else {
          await ensureGranularSettingsRecords(cache);
        }
      },
    );

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

  persistTasks(changes: CollectionChanges<StillTask>) { return persistTableChanges(stillDb.tasks, changes); }
  persistEvents(changes: CollectionChanges<StillEvent>) { return persistTableChanges(stillDb.events, changes); }
  persistJournalEntries(changes: CollectionChanges<JournalEntry>) { return persistTableChanges(stillDb.journalEntries, changes); }
  persistExpenses(changes: CollectionChanges<StillExpense>) { return persistTableChanges(stillDb.expenses, changes); }
  async persistNotifications(notifications: AppNotification[]) {
    await stillDb.transaction('rw', stillDb.notifications, async () => {
      await stillDb.notifications.clear();
      if (notifications.length) await stillDb.notifications.bulkPut(notifications);
    });
  }
  persistEntityLinks(changes: CollectionChanges<LifeEntityLink>) { return persistTableChanges(stillDb.entityLinks, changes); }
  persistWorkShifts(changes: CollectionChanges<WorkShift>) { return persistTableChanges(stillDb.workShifts, changes); }
  persistAccountSettings(settings: GeneralAccountSettings) { return persistSettingsRecord(settings); }
  persistWorkSettings(settings: WorkSettings) { return persistSettingsRecord(settings); }
  persistMoneySettings(settings: MoneySettings) { return persistSettingsRecord(settings); }
  persistHealthSettings(settings: HealthSettings) { return persistSettingsRecord(settings); }

  async listCheckIns() {
    const records = await stillDb.checkIns.orderBy('date').reverse().toArray();
    return records.filter((record) => !record.deletedAt).map(stripCheckInMetadata);
  }

  async saveCheckIn(record: CheckInRecord) {
    const existing = await stillDb.checkIns.get(record.date);
    const mergedRecord: CheckInRecord = existing
      ? { ...stripCheckInMetadata(existing), ...record }
      : record;
    const syncedRecord = withCheckInSyncMetadata(mergedRecord);
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
