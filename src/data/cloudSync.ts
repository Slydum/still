import type { Table } from 'dexie';
import { stillDb } from './localDb';
import { localStillRepository } from './repositories/localStillRepository';
import type { PermanentDataSnapshot } from './repositories/types';
import { getCloudSession, getSupabaseClient } from './supabaseClient';

const CLOUD_USER_META_KEY = 'supabase-user-id-v1';
const SYNC_BATCH_SIZE = 250;

type StillRecordType =
  | 'task'
  | 'event'
  | 'journal_entry'
  | 'expense'
  | 'entity_link'
  | 'work_shift'
  | 'check_in';

type RpcRecord = {
  record_type: StillRecordType;
  record_id: string;
  schema_version: number;
  payload: Record<string, unknown>;
  updated_at: number;
  deleted_at: number | null;
};

type RemoteRecord = RpcRecord & {
  user_id: string;
  created_at: string;
  modified_at: string;
};

type LocalSyncedRecord = Record<string, unknown> & {
  id: string;
  userId: string;
  schemaVersion: number;
  updatedAt: number;
  deletedAt?: number;
};

type LocalSyncedCheckIn = Record<string, unknown> & {
  date: string;
  userId: string;
  schemaVersion: number;
  updatedAt: number;
  deletedAt?: number;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toRpcRecords(
  recordType: StillRecordType,
  records: Array<Record<string, unknown>>,
  idKey: 'id' | 'date',
): RpcRecord[] {
  return records.flatMap((record) => {
    const recordId = String(record[idKey] ?? '');
    const updatedAt = Number(record.updatedAt);
    if (!recordId || !Number.isFinite(updatedAt)) return [];

    const {
      userId: _userId,
      schemaVersion: _schemaVersion,
      deletedAt: _deletedAt,
      ...payload
    } = record;

    return [{
      record_type: recordType,
      record_id: recordId,
      schema_version: Number(record.schemaVersion) || 1,
      payload,
      updated_at: updatedAt,
      deleted_at: typeof record.deletedAt === 'number' ? record.deletedAt : null,
    }];
  });
}

async function readLocalRows(): Promise<RpcRecord[]> {
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
    stillDb.checkIns.toArray(),
  ]);

  return [
    ...toRpcRecords('task', tasks as unknown as Array<Record<string, unknown>>, 'id'),
    ...toRpcRecords('event', events as unknown as Array<Record<string, unknown>>, 'id'),
    ...toRpcRecords('journal_entry', journalEntries as unknown as Array<Record<string, unknown>>, 'id'),
    ...toRpcRecords('expense', expenses as unknown as Array<Record<string, unknown>>, 'id'),
    ...toRpcRecords('entity_link', entityLinks as unknown as Array<Record<string, unknown>>, 'id'),
    ...toRpcRecords('work_shift', workShifts as unknown as Array<Record<string, unknown>>, 'id'),
    ...toRpcRecords('check_in', checkIns as unknown as Array<Record<string, unknown>>, 'date'),
  ];
}

async function pushRows(rows: RpcRecord[]) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Cloud sync could not load on this device.');

  for (let index = 0; index < rows.length; index += SYNC_BATCH_SIZE) {
    const batch = rows.slice(index, index + SYNC_BATCH_SIZE);
    const { error } = await supabase.rpc('sync_still_records', { p_records: batch });
    if (error) throw new Error(error.message);
  }
}

async function pullRows(): Promise<RemoteRecord[]> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Cloud sync could not load on this device.');

  const { data, error } = await supabase
    .from('still_records')
    .select('*')
    .order('updated_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as RemoteRecord[];
}

function mergeByKey<T extends { updatedAt: number; deletedAt?: number }>(
  local: T[],
  remote: T[],
  keyOf: (record: T) => string,
) {
  const merged = new Map<string, T>();

  [...local, ...remote].forEach((record) => {
    const key = keyOf(record);
    const current = merged.get(key);
    if (!current || record.updatedAt > current.updatedAt) {
      merged.set(key, record);
      return;
    }

    if (record.updatedAt === current.updatedAt && record.deletedAt && !current.deletedAt) {
      merged.set(key, record);
    }
  });

  return [...merged.values()];
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
  };
}

async function mergeEntityTable(
  table: Table<any, string>,
  rows: RemoteRecord[],
  recordType: StillRecordType,
  userId: string,
) {
  const local = await table.toArray() as LocalSyncedRecord[];
  const remote = rows
    .filter((row) => row.record_type === recordType)
    .map((row) => remoteEntityRecord(row, userId));
  const merged = mergeByKey(local, remote, (record) => record.id)
    .map((record) => ({ ...record, userId }));

  if (merged.length) await table.bulkPut(merged);
}

async function mergeCheckIns(
  table: Table<any, string>,
  rows: RemoteRecord[],
  userId: string,
) {
  const local = await table.toArray() as LocalSyncedCheckIn[];
  const remote = rows
    .filter((row) => row.record_type === 'check_in')
    .map((row) => remoteCheckInRecord(row, userId));
  const merged = mergeByKey(local, remote, (record) => record.date)
    .map((record) => ({ ...record, userId }));

  if (merged.length) await table.bulkPut(merged);
}

async function applyRemoteRows(rows: RemoteRecord[], userId: string) {
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
    ],
    async () => {
      await mergeEntityTable(stillDb.tasks, rows, 'task', userId);
      await mergeEntityTable(stillDb.events, rows, 'event', userId);
      await mergeEntityTable(stillDb.journalEntries, rows, 'journal_entry', userId);
      await mergeEntityTable(stillDb.expenses, rows, 'expense', userId);
      await mergeEntityTable(stillDb.entityLinks, rows, 'entity_link', userId);
      await mergeEntityTable(stillDb.workShifts, rows, 'work_shift', userId);
      await mergeCheckIns(stillDb.checkIns, rows, userId);
    },
  );
}

async function assertCloudUserBinding(userId: string) {
  const existing = await stillDb.repositoryMeta.get(CLOUD_USER_META_KEY);
  if (existing && existing.value !== userId) {
    throw new Error(
      'This browser is already linked to another Still account. Export or reset the local data before connecting a different account.',
    );
  }

  if (!existing) {
    await stillDb.repositoryMeta.put({
      key: CLOUD_USER_META_KEY,
      value: userId,
      updatedAt: Date.now(),
    });
  }
}

async function runCloudSync(): Promise<PermanentDataSnapshot> {
  const session = await getCloudSession();
  if (!session) throw new Error('Sign in before synchronizing Still.');

  await assertCloudUserBinding(session.user.id);

  const localRows = await readLocalRows();
  if (localRows.length) await pushRows(localRows);

  const remoteRows = await pullRows();
  await applyRemoteRows(remoteRows, session.user.id);

  const convergedRows = await readLocalRows();
  if (convergedRows.length) await pushRows(convergedRows);

  return localStillRepository.load();
}

let activeSync: Promise<PermanentDataSnapshot> | undefined;

export function synchronizeCloudData() {
  if (activeSync) return activeSync;

  activeSync = runCloudSync().finally(() => {
    activeSync = undefined;
  });

  return activeSync;
}
