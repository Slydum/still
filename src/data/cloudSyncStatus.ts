import { stillDb } from './localDb';

const LAST_SUCCESSFUL_SYNC_META_KEY = 'supabase-last-successful-sync-at-v1';

export type CloudSyncPhase = 'idle' | 'waiting' | 'syncing' | 'synced' | 'error';

export type CloudSyncStatusSnapshot = {
  phase: CloudSyncPhase;
  pendingChanges: number;
  lastSyncedAt?: number;
  error?: string;
};

let snapshot: CloudSyncStatusSnapshot = {
  phase: 'idle',
  pendingChanges: 0,
};

const listeners = new Set<() => void>();

function publish(next: CloudSyncStatusSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

async function countPendingChanges() {
  return stillDb.syncOutbox.count();
}

async function readLastSuccessfulSync() {
  const record = await stillDb.repositoryMeta.get(LAST_SUCCESSFUL_SYNC_META_KEY);
  const value = Number(record?.value ?? 0);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : 'Still could not finish cloud sync right now.';
}

export function getCloudSyncStatusSnapshot() {
  return snapshot;
}

export function subscribeCloudSyncStatus(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function refreshCloudSyncStatus() {
  const [pendingChanges, lastSyncedAt] = await Promise.all([
    countPendingChanges(),
    readLastSuccessfulSync(),
  ]);

  if (snapshot.phase === 'syncing') {
    publish({
      ...snapshot,
      pendingChanges,
      lastSyncedAt: lastSyncedAt ?? snapshot.lastSyncedAt,
    });
    return;
  }

  const retainedError = snapshot.error;
  publish({
    phase: pendingChanges > 0 ? 'waiting' : retainedError ? 'error' : lastSyncedAt ? 'synced' : 'idle',
    pendingChanges,
    lastSyncedAt,
    error: retainedError,
  });
}

export function markCloudSyncing() {
  publish({
    ...snapshot,
    phase: 'syncing',
    error: undefined,
  });
}

export async function recordCloudSyncSuccess(completedAt = Date.now()) {
  try {
    await stillDb.repositoryMeta.put({
      key: LAST_SUCCESSFUL_SYNC_META_KEY,
      value: String(completedAt),
      updatedAt: completedAt,
    });
  } catch (error) {
    console.warn('Still could not remember the last successful sync time:', error);
  }

  let pendingChanges = snapshot.pendingChanges;
  try {
    pendingChanges = await countPendingChanges();
  } catch (error) {
    console.warn('Still could not recount local sync changes after cloud sync:', error);
  }

  publish({
    phase: pendingChanges > 0 ? 'waiting' : 'synced',
    pendingChanges,
    lastSyncedAt: completedAt,
    error: undefined,
  });
}

export async function markCloudSyncFailure(error: unknown) {
  let pendingChanges = snapshot.pendingChanges;
  try {
    pendingChanges = await countPendingChanges();
  } catch (countError) {
    console.warn('Still could not recount local sync changes after a cloud error:', countError);
  }

  publish({
    phase: pendingChanges > 0 ? 'waiting' : 'error',
    pendingChanges,
    lastSyncedAt: snapshot.lastSyncedAt,
    error: errorMessage(error),
  });
}
