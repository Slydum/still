export type VersionedRecord = {
  syncCounter: number;
  mutationId: string;
  deletedAt?: number;
  serverRevision?: number;
  dirty?: boolean;
};

export function chunkRows<T>(rows: T[], batchSize: number) {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error('Batch size must be a positive integer.');
  }

  const batches: T[][] = [];
  for (let index = 0; index < rows.length; index += batchSize) {
    batches.push(rows.slice(index, index + batchSize));
  }
  return batches;
}

export async function collectPaginatedRows<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize: number,
) {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error('Page size must be a positive integer.');
  }

  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export function compareVersion(left: VersionedRecord, right: VersionedRecord) {
  if (left.syncCounter !== right.syncCounter) return left.syncCounter - right.syncCounter;
  const mutationDifference = left.mutationId.localeCompare(right.mutationId);
  if (mutationDifference !== 0) return mutationDifference;
  if (left.deletedAt && !right.deletedAt) return 1;
  if (!left.deletedAt && right.deletedAt) return -1;
  return 0;
}

export function mergeByKey<T extends VersionedRecord>(
  local: T[],
  remote: T[],
  keyOf: (record: T) => string,
) {
  const merged = new Map<string, T>();

  for (const record of [...local, ...remote]) {
    const key = keyOf(record);
    const current = merged.get(key);
    if (!current) {
      merged.set(key, record);
      continue;
    }

    const comparison = compareVersion(record, current);
    if (comparison > 0) {
      merged.set(key, record);
      continue;
    }

    if (
      comparison === 0
      && (record.serverRevision ?? 0) >= (current.serverRevision ?? 0)
      && record.dirty === false
    ) {
      merged.set(key, record);
    }
  }

  return [...merged.values()];
}

export function maxServerRevision(rows: Array<{ server_revision: number }>, fallback = 0) {
  return rows.reduce((maximum, row) => Math.max(maximum, row.server_revision), fallback);
}

export function assertCloudUserCompatibility(
  existingUserId: string | undefined,
  nextUserId: string,
) {
  if (existingUserId && existingUserId !== nextUserId) {
    throw new Error(
      'This browser is already linked to another Still account. Log out and clear this device before connecting a different account.',
    );
  }
}

export function createSingleFlight<T>(run: () => Promise<T>) {
  let active: Promise<T> | undefined;

  return () => {
    if (active) return active;

    active = run().finally(() => {
      active = undefined;
    });
    return active;
  };
}
