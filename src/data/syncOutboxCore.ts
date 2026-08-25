export const SYNC_OUTBOX_SOURCES = [
  'tasks',
  'events',
  'journalEntries',
  'expenses',
  'entityLinks',
  'workShifts',
  'checkIns',
  'accountSettings',
] as const;

export type SyncOutboxSource = typeof SYNC_OUTBOX_SOURCES[number];

export type SyncOutboxRecord = {
  key: string;
  source: SyncOutboxSource;
  recordId: string;
  enqueuedAt: number;
};

export function syncOutboxKey(source: SyncOutboxSource, recordId: string) {
  return `${source}:${recordId}`;
}

export function createSyncOutboxRecord(
  source: SyncOutboxSource,
  recordId: string,
  enqueuedAt = Date.now(),
): SyncOutboxRecord {
  return {
    key: syncOutboxKey(source, recordId),
    source,
    recordId,
    enqueuedAt,
  };
}

export function syncOutboxRecordForDirtyRow(
  source: SyncOutboxSource,
  row: Record<string, unknown>,
  idKey: 'id' | 'date',
  fallbackTime = Date.now(),
) {
  if (row.dirty !== true) return undefined;
  const recordId = String(row[idKey] ?? '');
  if (!recordId) return undefined;
  const updatedAt = Number(row.updatedAt);
  return createSyncOutboxRecord(
    source,
    recordId,
    Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : fallbackTime,
  );
}
