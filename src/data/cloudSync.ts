import type { Table } from 'dexie';
import {
  assertCloudUserCompatibility,
  chunkRows,
  collectPaginatedRows,
  createSingleFlight,
  maxServerRevision,
  mergeByKey,
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

function toSettingsRpcRecords(records: Array<Record<string, unknown>>) {
  return records.flatMap((record) => {
    const recordType = settingsRecordType(String(record.id ?? ''));
    return recordType ? toRpcRecords(recordType, [record], 'id') : [];
  });
}

async function readDirtyRows(): Promise<RpcRecord[]> {
  const [tasks, events, journalEntries, expenses, entityLinks, workShifts, checkIns, settings] = await Promise.all([
    stillDb.tasks.toArray(),
    stillDb.events.toArray(),
    stillDb.journalEntries.toArray(),
    stillDb.expenses.toArray(),
    stillDb.entityLinks.toArray(),
    stillDb.workShifts.toArray(),
    stillDb.checkIns.toArray(),
    stillDb.accountSettings.toArray(),
  ]);

  return [
    ...toRpcRecords('task', tasks as unknown as Array<Record<string, unknown>>, 'id'),
    ...toRpcRecords('event', events as unknown as Array<Record<string, unknown>>, 'id'),
    ...toRpcRecords('journal_entry', journalEntries as unknown as Array<Record<string, unknown>>, 'id'),
    ...toRpcRecords('expense', expenses as unknown as Array<Record<string, unknown>>, 'id'),
    ...toRpcRecords('entity_link', entityLinks as unknown as Array<Record<string, unknown>>, 'id'),
    ...toRpcRecords('work_shift', workShifts as unknown as Array<Record<string, unknown>>, 'id'),
    ...toRpcRecords('check_in', checkIns as unknown as Array<Record<string, unknown>>, 'date'),
    ...toSettingsRpcRecords(settings as unknown as Array<Record<string, unknown>>),
  ];
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

async function pullRows(cursor: number): Promise<RemoteRecord[]> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Cloud sync could not load on this device.');

  return collectPaginatedRows(async (from, to) => {
    const { data, error } = await supabase
      .from('still_records')
      .select('*')
      .gt('server_revision', cursor)
      .order('server_revision', { ascending: true })
      .range(from, to);

    if (error) throw new Error(error.message);
    return (data ?? []) as RemoteRecord[];
  }, PULL_PAGE_SIZE);
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
  const local = await table.toArray() as LocalSyncedRecord[];
  const remote = relevant.map((row) => remoteEntityRecord(row, userId));
  const merged = mergeByKey(local, remote, (record) => record.id).map((record) => ({ ...record, userId }));
  if (merged.length) await table.bulkPut(merged);
}

async function mergeCheckIns(table: Table<any, string>, rows: RemoteRecord[], userId: string) {
  const relevant = rows.filter((row) => row.record_type === 'check_in');
  if (!relevant.length) return;
  const local = await table.toArray() as LocalSyncedCheckIn[];
  const remote = relevant.map((row) => remoteCheckInRecord(row, userId));
  const merged = mergeByKey(local, remote, (record) => record.date).map((record) => ({ ...record, userId }));
  if (merged.length) await table.bulkPut(merged);
}

async function applyRemoteRows(rows: RemoteRecord[], userId: string) {
  if (!rows.length) return;
  await stillDb.transaction(
    'rw',
    [stillDb.tasks, stillDb.events, stillDb.journalEntries, stillDb.expenses, stillDb.entityLinks, stillDb.workShifts, stillDb.checkIns, stillDb.accountSettings],
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
    },
  );
}

async function pushDirtyRows(userId: string, cursor: number) {
  const dirtyRows = await readDirtyRows();
  if (!dirtyRows.length) return cursor;
  const acknowledgements = await pushRows(dirtyRows);
  await applyRemoteRows(acknowledgements, userId);
  return maxServerRevision(acknowledgements, cursor);
}

async function savePullCursor(cursor: number) {
  await stillDb.repositoryMeta.put({ key: SYNC_CURSOR_META_KEY, value: String(cursor), updatedAt: Date.now() });
}

async function compactAcknowledgedLocalTombstones(cursor: number) {
  const cutoff = Date.now() - LOCAL_TOMBSTONE_RETENTION_MS;
  const tables: Array<Table<any, string>> = [
    stillDb.tasks,
    stillDb.events,
    stillDb.journalEntries,
    stillDb.expenses,
    stillDb.entityLinks,
    stillDb.workShifts,
    stillDb.checkIns,
  ];
  await stillDb.transaction('rw', tables, async () => {
    for (const table of tables) {
      await table.filter((record: LocalSyncFields) => Boolean(
        record.deletedAt
        && record.deletedAt < cutoff
        && record.dirty === false
        && (record.serverRevision ?? Number.MAX_SAFE_INTEGER) <= cursor,
      )).delete();
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
  let nextCursor = await pushDirtyRows(session.user.id, cursor);

  const remoteRows = await pullRows(cursor);
  await applyRemoteRows(remoteRows, session.user.id);
  nextCursor = maxServerRevision(remoteRows, nextCursor);

  // A pulled legacy settings/account row can come from an older client. Loading
  // sanitizes that row and creates any missing granular rows without overwriting
  // already-present Work/Money/Health records, then this second push publishes
  // the migration in the same sync cycle.
  await localStillRepository.load();
  nextCursor = await pushDirtyRows(session.user.id, nextCursor);

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
