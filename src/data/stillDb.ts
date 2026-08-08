import { usePersistenceStatus } from '../stores/usePersistenceStatus';
import { refreshCloudSyncStatus } from './cloudSyncStatus';
import { stillRepository } from './repositories';

export { stillDb } from './localDb';
export type { CheckInRecord, DailyQuoteRecord } from './records';

async function trackedLocalWrite(write: () => Promise<void>) {
  usePersistenceStatus.getState().markSaving();
  try {
    await write();
    usePersistenceStatus.getState().markSaved();
    void refreshCloudSyncStatus().catch((error) => {
      console.warn('Still could not refresh cloud sync status after a local check-in change:', error);
    });
  } catch (error) {
    usePersistenceStatus.getState().setFailure(error);
    throw error;
  }
}

export function saveCheckIn(record: import('./records').CheckInRecord) {
  return trackedLocalWrite(() => stillRepository.saveCheckIn(record));
}

export function listCheckIns() {
  return stillRepository.listCheckIns();
}

export function deleteCheckIn(date: string) {
  return trackedLocalWrite(() => stillRepository.deleteCheckIn(date));
}
