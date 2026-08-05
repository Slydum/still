export type IdentifiedVersionedRecord = {
  id: string;
  updatedAt?: number;
  createdAt?: number;
};

export type CollectionChanges<T extends IdentifiedVersionedRecord> = {
  upserts: T[];
  deletedIds: string[];
};

function recordVersion(record: IdentifiedVersionedRecord) {
  return record.updatedAt ?? record.createdAt ?? 0;
}

export function diffCollectionChanges<T extends IdentifiedVersionedRecord>(
  previous: T[],
  next: T[],
): CollectionChanges<T> {
  const previousById = new Map(previous.map((record) => [record.id, record]));
  const nextIds = new Set(next.map((record) => record.id));

  const upserts = next.filter((record) => {
    const existing = previousById.get(record.id);
    return !existing || recordVersion(existing) !== recordVersion(record);
  });

  const deletedIds = previous
    .filter((record) => !nextIds.has(record.id))
    .map((record) => record.id);

  return { upserts, deletedIds };
}

export function hasCollectionChanges<T extends IdentifiedVersionedRecord>(
  changes: CollectionChanges<T>,
) {
  return changes.upserts.length > 0 || changes.deletedIds.length > 0;
}
