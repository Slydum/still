import {
  LOCAL_DEVICE_USER_ID,
  PERMANENT_DATA_SCHEMA_VERSION,
  type SyncMetadata,
} from './types';

type IdentifiedRecord = {
  id: string;
  updatedAt?: number;
  createdAt?: number;
};

export function recordTimestamp(record: { updatedAt?: number; createdAt?: number }, fallback = Date.now()) {
  return record.updatedAt ?? record.createdAt ?? fallback;
}

export function createMutationId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function compareSyncVersion(
  left: Pick<SyncMetadata, 'syncCounter' | 'mutationId' | 'deletedAt'>,
  right: Pick<SyncMetadata, 'syncCounter' | 'mutationId' | 'deletedAt'>,
) {
  if (left.syncCounter !== right.syncCounter) return left.syncCounter - right.syncCounter;
  const mutationDifference = left.mutationId.localeCompare(right.mutationId);
  if (mutationDifference !== 0) return mutationDifference;
  if (left.deletedAt && !right.deletedAt) return 1;
  if (!left.deletedAt && right.deletedAt) return -1;
  return 0;
}

export function addSyncMetadata<T extends IdentifiedRecord>(
  record: T,
  existing?: SyncMetadata,
  userId = LOCAL_DEVICE_USER_ID,
): T & SyncMetadata {
  return {
    ...record,
    userId: existing?.userId ?? userId,
    schemaVersion: PERMANENT_DATA_SCHEMA_VERSION,
    updatedAt: recordTimestamp(record),
    deletedAt: undefined,
    syncCounter: Math.max(1, (existing?.syncCounter ?? 0) + 1),
    mutationId: createMutationId(),
    serverRevision: existing?.serverRevision,
    dirty: true,
  };
}

export function reconcileCollection<T extends IdentifiedRecord>(
  existing: Array<T & SyncMetadata>,
  incoming: T[],
  now = Date.now(),
) {
  const existingById = new Map(existing.map((record) => [record.id, record]));
  const incomingIds = new Set(incoming.map((record) => record.id));

  const active = incoming.map((record) => addSyncMetadata(record, existingById.get(record.id)));
  const tombstones = existing
    .filter((record) => !incomingIds.has(record.id))
    .map((record) => record.deletedAt
      ? record
      : {
          ...record,
          updatedAt: now,
          deletedAt: now,
          syncCounter: record.syncCounter + 1,
          mutationId: createMutationId(),
          dirty: true,
        });

  return [...active, ...tombstones];
}

export function mergeSyncedRecords<T extends IdentifiedRecord>(
  local: Array<T & SyncMetadata>,
  remote: Array<T & SyncMetadata>,
) {
  const merged = new Map<string, T & SyncMetadata>();

  [...local, ...remote].forEach((record) => {
    const current = merged.get(record.id);
    if (!current || compareSyncVersion(record, current) > 0) merged.set(record.id, record);
  });

  return [...merged.values()];
}

export function activeRecords<T extends IdentifiedRecord>(records: Array<T & SyncMetadata>) {
  return records.filter((record) => !record.deletedAt).map((record) => {
    const {
      userId: _userId,
      schemaVersion: _schemaVersion,
      deletedAt: _deletedAt,
      syncCounter: _syncCounter,
      mutationId: _mutationId,
      serverRevision: _serverRevision,
      dirty: _dirty,
      ...value
    } = record;
    return value as T;
  });
}
