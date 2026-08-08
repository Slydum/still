import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  CloudOff,
  HardDrive,
  RefreshCw,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isDemoMode } from '../app/demoMode';
import { deriveSyncConfidence, type SyncConfidenceKind } from '../domain/syncConfidence';
import { useCloudSyncStatus } from '../hooks/useCloudSyncStatus';
import { usePersistenceStatus } from '../stores/usePersistenceStatus';

function StatusIcon({ kind }: { kind: SyncConfidenceKind }) {
  if (kind === 'local-error') return <AlertTriangle aria-hidden="true" size={15} />;
  if (kind === 'syncing' || kind === 'saving') return <RefreshCw aria-hidden="true" size={15} />;
  if (kind === 'offline') return <CloudOff aria-hidden="true" size={15} />;
  if (kind === 'synced') return <CheckCircle2 aria-hidden="true" size={15} />;
  if (kind === 'waiting' || kind === 'cloud-error') return <Cloud aria-hidden="true" size={15} />;
  return <HardDrive aria-hidden="true" size={15} />;
}

export function SyncConfidenceIndicator() {
  const navigate = useNavigate();
  const cloudStatus = useCloudSyncStatus();
  const localPhase = usePersistenceStatus((state) => state.phase);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const view = deriveSyncConfidence({
    demoMode: isDemoMode(),
    online,
    localPhase,
    cloudPhase: cloudStatus.phase,
    pendingChanges: cloudStatus.pendingChanges,
    hasSuccessfulSync: Boolean(cloudStatus.lastSyncedAt),
  });

  let detail = view.detail;
  if (
    cloudStatus.lastSyncedAt
    && (view.kind === 'synced' || view.kind === 'offline' || view.kind === 'cloud-error')
  ) {
    detail += ` Last successful sync ${new Date(cloudStatus.lastSyncedAt).toLocaleString()}.`;
  }

  return (
    <button
      className={`sync-confidence-indicator is-${view.kind}`}
      type="button"
      title={detail}
      aria-label={`${view.label}. ${detail}`}
      onClick={() => navigate('/more#cloud-sync')}
    >
      <StatusIcon kind={view.kind} />
      <span>{view.label}</span>
    </button>
  );
}
