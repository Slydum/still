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

export function addSyncMetadata<T extends IdentifiedRecord>(
  record: T,
  existing?: SyncMetadata,
  userId = LOCAL_DEVICE_USER_ID,
): T & SyncMetadata {
  const sourceUpdatedAt = recordTimestamp(record);
  return {
    ...record,
    userId: existing?.userId ?? userId,
    schemaVersion: PERMANENT_DATA_SCHEMA_VERSION,
    updatedAt: Math.max(sourceUpdatedAt, existing?.updatedAt ?? 0),
    deletedAt: undefined,
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
          updatedAt: Math.max(now, record.updatedAt),
          deletedAt: now,
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
    if (!current || record.updatedAt > current.updatedAt) {
      merged.set(record.id, record);
      return;
    }

    if (record.updatedAt === current.updatedAt && record.deletedAt && !current.deletedAt) {
      merged.set(record.id, record);
    }
  });

  return [...merged.values()];
}

export function activeRecords<T extends IdentifiedRecord>(records: Array<T & SyncMetadata>) {
  return records.filter((record) => !record.deletedAt).map((record) => {
    const { userId: _userId, schemaVersion: _schemaVersion, deletedAt: _deletedAt, ...value } = record;
    return value as T;
  });
}
