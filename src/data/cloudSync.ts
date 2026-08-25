import type { Table } from 'dexie';
import {
  assertCloudUserCompatibility,
  chunkRows,
  collectKeysetPaginatedRows,
  createSingleFlight,
  mergeByKey,
  runPullBoundSyncCycle,
} from './cloudSyncCore';
import {
  markCloudSyncFailure,
  markCloudSyncing,
  recordCloudSyncSuccess,
} from './cloudSyncStatus';
import { stillDb } from './localDb';
import { localStillRepository } from './repositories/localStillRepository';
import type { PermanentDataSnapshot } from './repositories/types';
import { flushRepositoryWrites } from './repositoryWriteQueue';
import {
  createSyncOutboxRecord,
  SYNC_OUTBOX_SOURCES,
  syncOutboxKey,
  type SyncOutboxSource,
} from './syncOutboxCore';
import { getCloudSession, getSupabaseClient } from './supabaseClient';

const CLOUD_USER_META_KEY = 'supabase-user-id-v1';
const SYNC_CURSOR_META_KEY = 'supabase-sync-cursor-v2';
const SYNC_BATCH_SIZE = 250;
const PULL_PAGE_SIZE = 500;
const LOCAL_TOMBSTONE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

type StillRecordType =
  | 'task'
  | 'event'
  | 'journal_entry'
  | 'expense'
  | 'entity_link'
  | 'work_shift'
  | 'check_in'
  | 'settings'
  | 'work_settings'
  | 'money_settings'
  | 'health_settings';

type RpcRecord = {
  record_type: StillRecordType;
  record_id: string;
  schema_version: number;
  payload: Record<string, unknown>;
  updated_at: number;
  deleted_at: number | null;
  sync_counter: number;
  mutation_id: string;
};

type RemoteRecord = RpcRecord & {
  user_id: string;
  server_revision: number;
  created_at: string;
  modified_at: string;
};

type LocalSyncFields = {
  userId: string;
  schemaVersion: number;
  updatedAt: number;
  deletedAt?: number;
  syncCounter: number;
  mutationId: string;
  serverRevision?: number;
  dirty: boolean;
};

type LocalSyncedRecord = Record<string, unknown> & LocalSyncFields & { id: string };
type LocalSyncedCheckIn = Record<string, unknown> & LocalSyncFields & { date: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toRpcRecords(
  recordType: StillRecordType,
  records: Array<Record<string, unknown>>,
  idKey: 'id' | 'date',
): RpcRecord[] {
  return records.flatMap((record) => {
    if (record.dirty !== true) return [];
    const recordId = String(record[idKey] ?? '');
    const updatedAt = Number(record.updatedAt);
    const syncCounter = Number(record.syncCounter);
    const mutationId = String(record.mutationId ?? '');
    if (!recordId || !Number.isFinite(updatedAt) || !Number.isFinite(syncCounter) || !mutationId) return [];

    const {
      userId: _userId,
      schemaVersion: _schemaVersion,
      deletedAt: _deletedAt,
      syncCounter: _syncCounter,
      mutationId: _mutationId,
      serverRevision: _serverRevision,
      dirty: _dirty,
      ...payload
    } = record;

    return [{
      record_type: recordType,
      record_id: recordId,
      schema_version: Number(record.schemaVersion) || 1,
      payload,
      updated_at: updatedAt,
      deleted_at: typeof record.deletedAt === 'number' ? record.deletedAt : null,
      sync_counter: syncCounter,
      mutation_id: mutationId,
    }];
  });
}

function settingsRecordType(id: string): StillRecordType | undefined {
  if (id === 'account') return 'settings';
  if (id === 'work') return 'work_settings';
  if (id === 'money') return 'money_settings';
  if (id === 'health') return 'health_settings';
  return undefined;
}

function outboxRecordType(source: SyncOutboxSource, recordId: string): StillRecordType | undefined {
  if (source === 'tasks') return 'task';
  if (source === 'events') return 'event';
  if (source === 'journalEntries') return 'journal_entry';
  if (source === 'expenses') return 'expense';
  if (source === 'entityLinks') return 'entity_link';
  if (source === 'workShifts') return 'work_shift';
  if (source === 'checkIns') return 'check_in';
  return settingsRecordType(recordId);
}

function outboxIdKey(source: SyncOutboxSource): 'id' | 'date' {
  return source === 'checkIns' ? 'date' : 'id';
}

function outboxTable(source: SyncOutboxSource): Table<any, string> {
  if (source === 'tasks') return stillDb.tasks;
  if (source === 'events') return stillDb.events;
  if (source === 'journalEntries') return stillDb.journalEntries;
  if (source === 'expenses') return stillDb.expenses;
  if (source === 'entityLinks') return stillDb.entityLinks;
  if (source === 'workShifts') return stillDb.workShifts;
  if (source === 'checkIns') return stillDb.checkIns;
  return stillDb.accountSettings;
}

function outboxSourceForRecordType(recordType: StillRecordType): SyncOutboxSource {
  if (recordType === 'task') return 'tasks';
  if (recordType === 'event') return 'events';
  if (recordType === 'journal_entry') return 'journalEntries';
  if (recordType === 'expense') return 'expenses';
  if (recordType === 'entity_link') return 'entityLinks';
  if (recordType === 'work_shift') return 'workShifts';
  if (recordType === 'check_in') return 'checkIns';
  return 'accountSettings';
}

async function readDirtyRows(): Promise<RpcRecord[]> {
  return stillDb.transaction(
    'r',
    [
      stillDb.syncOutbox,
      stillDb.tasks,
      stillDb.events,
      stillDb.journalEntries,
      stillDb.expenses,
      stillDb.entityLinks,
      stillDb.workShifts,
      stillDb.checkIns,
      stillDb.accountSettings,
    ],
    async () => {
      const entries = await stillDb.syncOutbox.orderBy('enqueuedAt').toArray();
      if (!entries.length) return [];

      const rowsByOutboxKey = new Map<string, RpcRecord>();

      for (const source of SYNC_OUTBOX_SOURCES) {
        const sourceEntries = entries.filter((entry) => entry.source === source);
        if (!sourceEntries.length) continue;
        const records = await outboxTable(source).bulkGet(sourceEntries.map((entry) => entry.recordId));

        sourceEntries.forEach((entry, index) => {
          const record = records[index] as Record<string, unknown> | undefined;
          if (!record || record.dirty !== true) return;
          const recordType = outboxRecordType(source, entry.recordId);
          if (!recordType) return;
          const rpcRecord = toRpcRecords(recordType, [record], outboxIdKey(source))[0];
          if (rpcRecord) rowsByOutboxKey.set(entry.key, rpcRecord);
        });
      }

      return entries.flatMap((entry) => {
        const row = rowsByOutboxKey.get(entry.key);
        return row ? [row] : [];
      });
    },
  );
}

async function pushRows(rows: RpcRecord[]): Promise<RemoteRecord[]> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Cloud sync could not load on this device.');

  const authoritative: RemoteRecord[] = [];
  for (const batch of chunkRows(rows, SYNC_BATCH_SIZE)) {
    const { data, error } = await supabase.rpc('sync_still_records', { p_records: batch });
    if (error) throw new Error(error.message);
    authoritative.push(...((data ?? []) as RemoteRecord[]));
  }
  return authoritative;
}

async function readPullCursor() {
  const cursor = await stillDb.repositoryMeta.get(SYNC_CURSOR_META_KEY);
  const value = Number(cursor?.value ?? 0);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

async function pullRows(cursor: number) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Cloud sync could not load on this device.');

  return collectKeysetPaginatedRows(async (afterCursor, pageSize) => {
    const { data, error } = await supabase
      .from('still_records')
      .select('*')
      .gt('server_revision', afterCursor)
      .order('server_revision', { ascending: true })
      .limit(pageSize);

    if (error) throw new Error(error.message);
    return (data ?? []) as RemoteRecord[];
  }, PULL_PAGE_SIZE, cursor, (row) => row.server_revision);
}

function remoteEntityRecord(row: RemoteRecord, userId: string): LocalSyncedRecord {
  const payload = isObject(row.payload) ? row.payload : {};
  return {
    ...payload,
    id: row.record_id,
    userId,
    schemaVersion: row.schema_version,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? undefined,
    syncCounter: row.sync_counter,
    mutationId: row.mutation_id,
    serverRevision: row.server_revision,
    dirty: false,
  };
}

function remoteCheckInRecord(row: RemoteRecord, userId: string): LocalSyncedCheckIn {
  const payload = isObject(row.payload) ? row.payload : {};
  return {
    ...payload,
    date: row.record_id,
    userId,
    schemaVersion: row.schema_version,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? undefined,
    syncCounter: row.sync_counter,
    mutationId: row.mutation_id,
    serverRevision: row.server_revision,
    dirty: false,
  };
}

async function mergeEntityTable(
  table: Table<any, string>,
  rows: RemoteRecord[],
  recordType: StillRecordType,
  userId: string,
) {
  const relevant = rows.filter((row) => row.record_type === recordType);
  if (!relevant.length) return;
  const remote = relevant.map((row) => remoteEntityRecord(row, userId));
  const localRows = await table.bulkGet(remote.map((record) => record.id));
  const local = localRows.filter(Boolean) as LocalSyncedRecord[];
  const merged = mergeByKey(local, remote, (record) => record.id).map((record) => ({ ...record, userId }));
  if (merged.length) await table.bulkPut(merged);
}

async function mergeCheckIns(table: Table<any, string>, rows: RemoteRecord[], userId: string) {
  const relevant = rows.filter((row) => row.record_type === 'check_in');
  if (!relevant.length) return;
  const remote = relevant.map((row) => remoteCheckInRecord(row, userId));
  const localRows = await table.bulkGet(remote.map((record) => record.date));
  const local = localRows.filter(Boolean) as LocalSyncedCheckIn[];
  const merged = mergeByKey(local, remote, (record) => record.date).map((record) => ({ ...record, userId }));
  if (merged.length) await table.bulkPut(merged);
}

async function reconcileOutboxForRemoteRows(rows: RemoteRecord[]) {
  const affected = new Map<SyncOutboxSource, Set<string>>();
  for (const row of rows) {
    const source = outboxSourceForRecordType(row.record_type);
    const ids = affected.get(source) ?? new Set<string>();
    ids.add(row.record_id);
    affected.set(source, ids);
  }

  for (const [source, idsSet] of affected) {
    const ids = [...idsSet];
    const records = await outboxTable(source).bulkGet(ids);
    const dirtyEntries = [];
    const cleanKeys: string[] = [];

    records.forEach((record, index) => {
      const id = ids[index];
      const local = record as LocalSyncFields | undefined;
      if (local?.dirty === true) {
        dirtyEntries.push(createSyncOutboxRecord(source, id, local.updatedAt));
      } else {
        cleanKeys.push(syncOutboxKey(source, id));
      }
    });

    if (dirtyEntries.length) await stillDb.syncOutbox.bulkPut(dirtyEntries);
    if (cleanKeys.length) await stillDb.syncOutbox.bulkDelete(cleanKeys);
  }
}

async function applyRemoteRows(rows: RemoteRecord[], userId: string) {
  if (!rows.length) return;
  await stillDb.transaction(
    'rw',
    [
      stillDb.tasks,
      stillDb.events,
      stillDb.journalEntries,
      stillDb.expenses,
      stillDb.entityLinks,
      stillDb.workShifts,
      stillDb.checkIns,
      stillDb.accountSettings,
      stillDb.syncOutbox,
    ],
    async () => {
      await mergeEntityTable(stillDb.tasks, rows, 'task', userId);
      await mergeEntityTable(stillDb.events, rows, 'event', userId);
      await mergeEntityTable(stillDb.journalEntries, rows, 'journal_entry', userId);
      await mergeEntityTable(stillDb.expenses, rows, 'expense', userId);
      await mergeEntityTable(stillDb.entityLinks, rows, 'entity_link', userId);
      await mergeEntityTable(stillDb.workShifts, rows, 'work_shift', userId);
      await mergeCheckIns(stillDb.checkIns, rows, userId);
      await mergeEntityTable(stillDb.accountSettings, rows, 'settings', userId);
      await mergeEntityTable(stillDb.accountSettings, rows, 'work_settings', userId);
      await mergeEntityTable(stillDb.accountSettings, rows, 'money_settings', userId);
      await mergeEntityTable(stillDb.accountSettings, rows, 'health_settings', userId);
      await reconcileOutboxForRemoteRows(rows);
    },
  );
}

async function pushDirtyRows(userId: string) {
  const dirtyRows = await readDirtyRows();
  if (!dirtyRows.length) return;
  const acknowledgements = await pushRows(dirtyRows);
  await applyRemoteRows(acknowledgements, userId);
}

async function pullAndApplyRows(cursor: number, userId: string) {
  const pulled = await pullRows(cursor);
  await applyRemoteRows(pulled.rows, userId);
  return pulled.cursor;
}

async function savePullCursor(cursor: number) {
  await stillDb.repositoryMeta.put({ key: SYNC_CURSOR_META_KEY, value: String(cursor), updatedAt: Date.now() });
}

async function compactAcknowledgedLocalTombstones(cursor: number) {
  const cutoff = Date.now() - LOCAL_TOMBSTONE_RETENTION_MS;
  const sources: Array<{ source: SyncOutboxSource; table: Table<any, string> }> = [
    { source: 'tasks', table: stillDb.tasks },
    { source: 'events', table: stillDb.events },
    { source: 'journalEntries', table: stillDb.journalEntries },
    { source: 'expenses', table: stillDb.expenses },
    { source: 'entityLinks', table: stillDb.entityLinks },
    { source: 'workShifts', table: stillDb.workShifts },
    { source: 'checkIns', table: stillDb.checkIns },
  ];
  const tables = sources.map(({ table }) => table);

  await stillDb.transaction('rw', [...tables, stillDb.syncOutbox], async () => {
    for (const { source, table } of sources) {
      const primaryKeys = await table
        .where('deletedAt')
        .below(cutoff)
        .filter((record: LocalSyncFields) => Boolean(
          record.dirty === false
          && (record.serverRevision ?? Number.MAX_SAFE_INTEGER) <= cursor,
        ))
        .primaryKeys();
      const ids = primaryKeys.map(String);
      if (!ids.length) continue;
      await table.bulkDelete(ids);
      await stillDb.syncOutbox.bulkDelete(ids.map((id) => syncOutboxKey(source, id)));
    }
  });
}

async function assertCloudUserBinding(userId: string) {
  const existing = await stillDb.repositoryMeta.get(CLOUD_USER_META_KEY);
  assertCloudUserCompatibility(existing?.value, userId);
  if (!existing) await stillDb.repositoryMeta.put({ key: CLOUD_USER_META_KEY, value: userId, updatedAt: Date.now() });
}

async function runCloudSync(): Promise<PermanentDataSnapshot> {
  const session = await getCloudSession();
  if (!session) throw new Error('Sign in before synchronizing Still.');

  await flushRepositoryWrites();
  await assertCloudUserBinding(session.user.id);

  // Ensure any v1 bundled local settings are split before the first push.
  await localStillRepository.load();

  const cursor = await readPullCursor();
  const nextCursor = await runPullBoundSyncCycle(cursor, {
    push: () => pushDirtyRows(session.user.id),
    pullAndApply: (pullCursor) => pullAndApplyRows(pullCursor, session.user.id),
    migrate: async () => {
      // A pulled legacy settings/account row can come from an older client. Loading
      // sanitizes that row and creates any missing granular rows without overwriting
      // already-present Work/Money/Health records. The following push publishes
      // that migration, and the final pull consumes every resulting server revision
      // before the durable cursor is allowed to advance.
      await localStillRepository.load();
    },
  });

  if (nextCursor !== cursor) await savePullCursor(nextCursor);
  await compactAcknowledgedLocalTombstones(nextCursor);

  return localStillRepository.load();
}

async function runTrackedCloudSync() {
  markCloudSyncing();
  try {
    const synced = await runCloudSync();
    await recordCloudSyncSuccess();
    return synced;
  } catch (error) {
    await markCloudSyncFailure(error);
    throw error;
  }
}

export const synchronizeCloudData = createSingleFlight(runTrackedCloudSync);
