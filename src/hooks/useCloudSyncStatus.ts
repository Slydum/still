import { useEffect, useSyncExternalStore } from 'react';
import {
  getCloudSyncStatusSnapshot,
  refreshCloudSyncStatus,
  subscribeCloudSyncStatus,
} from '../data/cloudSyncStatus';

export function useCloudSyncStatus() {
  const status = useSyncExternalStore(
    subscribeCloudSyncStatus,
    getCloudSyncStatusSnapshot,
    getCloudSyncStatusSnapshot,
  );

  useEffect(() => {
    void refreshCloudSyncStatus().catch((error) => {
      console.warn('Still could not refresh cloud sync status:', error);
    });
  }, []);

  return status;
}
