import { readFile, writeFile } from 'node:fs/promises';

async function replaceExact(path, before, after) {
  const text = await readFile(path, 'utf8');
  if (!text.includes(before)) throw new Error(`${path}: expected text not found`);
  await writeFile(path, text.replace(before, after));
}

await writeFile('src/data/cloudSyncStatus.ts', `import { stillDb } from './localDb';

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

async function countDirtyRows() {
  const tables = [
    stillDb.tasks,
    stillDb.events,
    stillDb.journalEntries,
    stillDb.expenses,
    stillDb.entityLinks,
    stillDb.workShifts,
    stillDb.checkIns,
    stillDb.accountSettings,
  ];
  const counts = await Promise.all(
    tables.map((table) => table.filter((record) => record.dirty === true).count()),
  );
  return counts.reduce((total, count) => total + count, 0);
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
  return () => listeners.delete(listener);
}

export async function refreshCloudSyncStatus() {
  const [pendingChanges, lastSyncedAt] = await Promise.all([
    countDirtyRows(),
    readLastSuccessfulSync(),
  ]);

  if (snapshot.phase === 'syncing') {
    publish({ ...snapshot, pendingChanges, lastSyncedAt: lastSyncedAt ?? snapshot.lastSyncedAt });
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
    pendingChanges = await countDirtyRows();
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
    pendingChanges = await countDirtyRows();
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
`);

await writeFile('src/hooks/useCloudSyncStatus.ts', `import { useEffect, useSyncExternalStore } from 'react';
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
`);

await writeFile('src/domain/syncConfidence.ts', `export type SyncConfidenceKind =
  | 'saving'
  | 'local-error'
  | 'demo'
  | 'syncing'
  | 'offline'
  | 'waiting'
  | 'cloud-error'
  | 'synced'
  | 'local';

export type SyncConfidenceInput = {
  demoMode: boolean;
  online: boolean;
  localPhase: 'idle' | 'saving' | 'saved' | 'error';
  cloudPhase: 'idle' | 'waiting' | 'syncing' | 'synced' | 'error';
  pendingChanges: number;
  hasSuccessfulSync: boolean;
};

export type SyncConfidenceView = {
  kind: SyncConfidenceKind;
  label: string;
  detail: string;
};

function waitingDetail(pendingChanges: number) {
  if (pendingChanges === 1) return '1 local change is safely saved here and waiting for cloud sync.';
  if (pendingChanges > 1) return `${pendingChanges} local changes are safely saved here and waiting for cloud sync.`;
  return 'Local changes are safely saved here and waiting for cloud sync.';
}

export function deriveSyncConfidence(input: SyncConfidenceInput): SyncConfidenceView {
  if (input.localPhase === 'error') {
    return {
      kind: 'local-error',
      label: 'Save needs attention',
      detail: 'Still could not confirm the latest save on this device.',
    };
  }

  if (input.localPhase === 'saving') {
    return {
      kind: 'saving',
      label: 'Saving…',
      detail: 'Still is writing your latest change to this device.',
    };
  }

  if (input.demoMode) {
    return {
      kind: 'demo',
      label: 'Saved in demo',
      detail: 'Demo records stay in this browser and never sync to your Still account.',
    };
  }

  if (input.cloudPhase === 'syncing') {
    return {
      kind: 'syncing',
      label: 'Syncing…',
      detail: 'Your local copy is safe while Still sends local changes and checks for cloud updates.',
    };
  }

  if (!input.online) {
    return {
      kind: 'offline',
      label: 'Saved here · offline',
      detail: input.pendingChanges > 0
        ? `${waitingDetail(input.pendingChanges)} Still can retry when this device is online.`
        : 'Your local copy is available offline. Still can check the cloud again when this device is online.',
    };
  }

  if (input.pendingChanges > 0 || input.cloudPhase === 'waiting') {
    return {
      kind: 'waiting',
      label: 'Saved here · waiting',
      detail: waitingDetail(input.pendingChanges),
    };
  }

  if (input.cloudPhase === 'error') {
    return {
      kind: 'cloud-error',
      label: 'Saved here · cloud retry',
      detail: 'Your local copy is safe. Still could not finish the latest cloud check.',
    };
  }

  if (input.cloudPhase === 'synced' || input.hasSuccessfulSync) {
    return {
      kind: 'synced',
      label: 'Saved & synced',
      detail: 'The latest successful cloud sync acknowledged the local changes that were waiting at that time.',
    };
  }

  return {
    kind: 'local',
    label: 'Saved here',
    detail: 'Your changes are saved on this device. No successful cloud sync is recorded here yet.',
  };
}
`);

await writeFile('src/components/SyncConfidenceIndicator.tsx', `import {
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
  if (cloudStatus.lastSyncedAt && (view.kind === 'synced' || view.kind === 'offline' || view.kind === 'cloud-error')) {
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
`);

await writeFile('src/theme/sync-confidence.css', `.sync-confidence-indicator {
  position: fixed;
  z-index: 850;
  right: max(12px, env(safe-area-inset-right));
  bottom: calc(82px + env(safe-area-inset-bottom));
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  gap: 7px;
  padding: 7px 11px;
  border: 1px solid rgba(92, 76, 119, 0.18);
  border-radius: 999px;
  background: rgba(255, 253, 250, 0.94);
  box-shadow: 0 8px 24px rgba(54, 43, 70, 0.12);
  color: #514961;
  font: inherit;
  font-size: 0.76rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
}

.sync-confidence-indicator.is-synced {
  border-color: rgba(65, 122, 90, 0.2);
  color: #356b50;
}

.sync-confidence-indicator.is-waiting,
.sync-confidence-indicator.is-offline,
.sync-confidence-indicator.is-cloud-error {
  border-color: rgba(146, 103, 48, 0.22);
  color: #72552f;
}

.sync-confidence-indicator.is-local-error {
  border-color: rgba(150, 65, 59, 0.28);
  color: #8a403b;
}

.sync-confidence-indicator.is-saving svg,
.sync-confidence-indicator.is-syncing svg {
  animation: still-sync-spin 1s linear infinite;
}

@keyframes still-sync-spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 520px) {
  .sync-confidence-indicator {
    right: 10px;
    bottom: calc(76px + env(safe-area-inset-bottom));
    max-width: calc(100vw - 20px);
  }
}

html[data-reduce-motion='true'] .sync-confidence-indicator svg {
  animation: none;
}
`);

await writeFile('tests/domain/syncConfidence.test.ts', `import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deriveSyncConfidence } from '../../src/domain/syncConfidence.js';

const baseline = {
  demoMode: false,
  online: true,
  localPhase: 'saved' as const,
  cloudPhase: 'idle' as const,
  pendingChanges: 0,
  hasSuccessfulSync: false,
};

describe('sync confidence', () => {
  it('prioritizes a local save failure over every cloud state', () => {
    const view = deriveSyncConfidence({ ...baseline, localPhase: 'error', cloudPhase: 'syncing', pendingChanges: 3 });
    assert.equal(view.kind, 'local-error');
    assert.equal(view.label, 'Save needs attention');
  });

  it('shows local saving before cloud status', () => {
    const view = deriveSyncConfidence({ ...baseline, localPhase: 'saving', cloudPhase: 'synced', hasSuccessfulSync: true });
    assert.equal(view.kind, 'saving');
    assert.equal(view.label, 'Saving…');
  });

  it('keeps demo records explicitly local-only', () => {
    const view = deriveSyncConfidence({ ...baseline, demoMode: true, pendingChanges: 4 });
    assert.equal(view.kind, 'demo');
    assert.equal(view.label, 'Saved in demo');
  });

  it('shows an active cloud sync', () => {
    const view = deriveSyncConfidence({ ...baseline, cloudPhase: 'syncing', pendingChanges: 2 });
    assert.equal(view.kind, 'syncing');
    assert.equal(view.label, 'Syncing…');
  });

  it('makes offline local safety explicit', () => {
    const view = deriveSyncConfidence({ ...baseline, online: false, pendingChanges: 2 });
    assert.equal(view.kind, 'offline');
    assert.equal(view.label, 'Saved here · offline');
    assert.match(view.detail, /2 local changes/);
  });

  it('shows cloud-bound dirty records as safely waiting', () => {
    const view = deriveSyncConfidence({ ...baseline, pendingChanges: 2, hasSuccessfulSync: true });
    assert.equal(view.kind, 'waiting');
    assert.equal(view.label, 'Saved here · waiting');
    assert.match(view.detail, /2 local changes/);
  });

  it('keeps cloud failure separate from local save failure', () => {
    const view = deriveSyncConfidence({ ...baseline, cloudPhase: 'error', hasSuccessfulSync: true });
    assert.equal(view.kind, 'cloud-error');
    assert.equal(view.label, 'Saved here · cloud retry');
    assert.match(view.detail, /local copy is safe/);
  });

  it('claims synced only after a recorded successful cloud sync', () => {
    const view = deriveSyncConfidence({ ...baseline, cloudPhase: 'synced', hasSuccessfulSync: true });
    assert.equal(view.kind, 'synced');
    assert.equal(view.label, 'Saved & synced');
  });

  it('falls back to local-only saved state before first cloud success', () => {
    const view = deriveSyncConfidence(baseline);
    assert.equal(view.kind, 'local');
    assert.equal(view.label, 'Saved here');
  });
});
`);

await writeFile('src/stores/usePersistenceStatus.ts', `import { create } from 'zustand';

export type LocalPersistencePhase = 'idle' | 'saving' | 'saved' | 'error';

type PersistenceStatusState = {
  phase: LocalPersistencePhase;
  savedAt?: number;
  error?: string;
  failedAt?: number;
  markSaving: () => void;
  markSaved: () => void;
  setFailure: (error: unknown) => void;
  clearFailure: () => void;
};

function persistenceErrorMessage(error: unknown) {
  const detail = error instanceof Error && error.message ? ` ${error.message}` : '';
  return `Still could not save your latest changes on this device.${detail}`;
}

export const usePersistenceStatus = create<PersistenceStatusState>((set) => ({
  phase: 'idle',
  savedAt: undefined,
  error: undefined,
  failedAt: undefined,
  markSaving: () => set({ phase: 'saving', error: undefined, failedAt: undefined }),
  markSaved: () => set({ phase: 'saved', savedAt: Date.now(), error: undefined, failedAt: undefined }),
  setFailure: (error) => set({
    phase: 'error',
    error: persistenceErrorMessage(error),
    failedAt: Date.now(),
  }),
  clearFailure: () => set((state) => ({
    phase: state.phase === 'error' ? 'idle' : state.phase,
    error: undefined,
    failedAt: undefined,
  })),
}));
`);

await writeFile('src/data/stillDb.ts', `import { usePersistenceStatus } from '../stores/usePersistenceStatus';
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
`);

await replaceExact(
  'src/data/cloudSync.ts',
  `} from './cloudSyncCore';\nimport { stillDb } from './localDb';`,
  `} from './cloudSyncCore';\nimport {\n  markCloudSyncFailure,\n  markCloudSyncing,\n  recordCloudSyncSuccess,\n} from './cloudSyncStatus';\nimport { stillDb } from './localDb';`,
);

await replaceExact(
  'src/data/cloudSync.ts',
  `export const synchronizeCloudData = createSingleFlight(runCloudSync);`,
  `async function runTrackedCloudSync() {\n  markCloudSyncing();\n  try {\n    const synced = await runCloudSync();\n    await recordCloudSyncSuccess();\n    return synced;\n  } catch (error) {\n    await markCloudSyncFailure(error);\n    throw error;\n  }\n}\n\nexport const synchronizeCloudData = createSingleFlight(runTrackedCloudSync);`,
);

await replaceExact(
  'src/hooks/usePermanentDataRepository.ts',
  `import { accountSettingsFromState, accountSettingsStatePatch } from '../data/accountSettings';\nimport { stillRepository, type PermanentDataCache } from '../data/repositories';`,
  `import { accountSettingsFromState, accountSettingsStatePatch } from '../data/accountSettings';\nimport { refreshCloudSyncStatus } from '../data/cloudSyncStatus';\nimport { stillRepository, type PermanentDataCache } from '../data/repositories';`,
);

await replaceExact(
  'src/hooks/usePermanentDataRepository.ts',
  `function reportRepositorySuccess() {\n  usePersistenceStatus.getState().clearFailure();\n}`,
  `function reportRepositorySuccess() {\n  usePersistenceStatus.getState().markSaved();\n  void refreshCloudSyncStatus().catch((error) => {\n    console.warn('Still could not refresh cloud sync status after a local save:', error);\n  });\n}`,
);

await replaceExact(
  'src/hooks/usePermanentDataRepository.ts',
  `    let disposed = false;\n    let unsubscribe: (() => void) | undefined;\n\n    const enqueue = (write: () => Promise<void>) => {\n      enqueueRepositoryWrite(write, {\n        onSuccess: reportRepositorySuccess,\n        onError: reportRepositoryError,\n      });\n    };`,
  `    let disposed = false;\n    let unsubscribe: (() => void) | undefined;\n    let pendingWrites = 0;\n\n    const enqueue = (write: () => Promise<void>) => {\n      pendingWrites += 1;\n      usePersistenceStatus.getState().markSaving();\n      enqueueRepositoryWrite(write, {\n        onSuccess: () => {\n          pendingWrites = Math.max(0, pendingWrites - 1);\n          if (pendingWrites === 0) reportRepositorySuccess();\n        },\n        onError: (error) => {\n          pendingWrites = Math.max(0, pendingWrites - 1);\n          reportRepositoryError(error);\n        },\n      });\n    };`,
);

await replaceExact(
  'src/app/App.tsx',
  `import { BottomNav } from '../components/navigation/BottomNav';\nimport { QuickAddSheet } from '../components/ui/QuickAddSheet';`,
  `import { BottomNav } from '../components/navigation/BottomNav';\nimport { SyncConfidenceIndicator } from '../components/SyncConfidenceIndicator';\nimport { QuickAddSheet } from '../components/ui/QuickAddSheet';`,
);

await replaceExact(
  'src/app/App.tsx',
  `      <BottomNav />\n      <QuickAddSheet />`,
  `      <SyncConfidenceIndicator />\n      <BottomNav />\n      <QuickAddSheet />`,
);

await replaceExact(
  'src/main.tsx',
  `import './theme/persistence-status.css';`,
  `import './theme/persistence-status.css';\nimport './theme/sync-confidence.css';`,
);

await replaceExact(
  'src/features/more/CloudSyncSettings.tsx',
  `import { useAppStore } from '../../stores/useAppStore';`,
  `import { useCloudSyncStatus } from '../../hooks/useCloudSyncStatus';\nimport { useAppStore } from '../../stores/useAppStore';`,
);

await replaceExact(
  'src/features/more/CloudSyncSettings.tsx',
  `  const [loading, setLoading] = useState(!demoMode);\n  const [syncing, setSyncing] = useState(false);\n  const [message, setMessage] = useState('');\n  const [lastSyncedAt, setLastSyncedAt] = useState<Date>();`,
  `  const [loading, setLoading] = useState(!demoMode);\n  const [message, setMessage] = useState('');\n  const cloudStatus = useCloudSyncStatus();\n  const syncing = cloudStatus.phase === 'syncing';`,
);

await replaceExact(
  'src/features/more/CloudSyncSettings.tsx',
  `    const completedAt = new Date();\n    setLastSyncedAt(completedAt);\n    return completedAt;`,
  `    return new Date();`,
);

await replaceExact(
  'src/features/more/CloudSyncSettings.tsx',
  `  const syncNow = useCallback(async () => {\n    setSyncing(true);\n    setMessage('Syncing local changes and checking for cloud updates…');\n    try {\n      const completedAt = await performSync();\n      setMessage(\`Synced at \${completedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.\`);\n    } catch (error) {\n      setMessage(error instanceof Error ? error.message : 'Still could not synchronize right now. Your local copy has not been cleared.');\n    } finally {\n      setSyncing(false);\n    }\n  }, [performSync]);`,
  `  const syncNow = useCallback(async () => {\n    setMessage('Syncing local changes and checking for cloud updates…');\n    try {\n      const completedAt = await performSync();\n      setMessage(\`Synced at \${completedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.\`);\n    } catch (error) {\n      setMessage(error instanceof Error ? error.message : 'Still could not synchronize right now. Your local copy has not been cleared.');\n    }\n  }, [performSync]);`,
);

await replaceExact(
  'src/features/more/CloudSyncSettings.tsx',
  `<small>{lastSyncedAt ? \`Last successful sync \${lastSyncedAt.toLocaleString()}\` : 'Signed in. Still also attempts cloud sync when the signed-in app starts.'}</small>`,
  `<small>{cloudStatus.pendingChanges > 0\n                ? \`${'${cloudStatus.pendingChanges}'} local ${'${cloudStatus.pendingChanges === 1 ? \'change is\' : \'changes are\'}'} saved here and waiting for cloud sync.\`\n                : cloudStatus.error\n                  ? 'The latest cloud check did not finish. Your local copy is still here.'\n                  : cloudStatus.lastSyncedAt\n                    ? \`Last successful sync ${'${new Date(cloudStatus.lastSyncedAt).toLocaleString()}'}\`\n                    : 'Signed in. Still also attempts cloud sync when the signed-in app starts.'}</small>`,
);

await replaceExact(
  'scripts/e2e-demo-browser.mjs',
  `  await poll(cdp, "Boolean(document.querySelector('.app')) && !location.pathname.endsWith('/auth')", 'demo application');`,
  `  await poll(cdp, "Boolean(document.querySelector('.app')) && !location.pathname.endsWith('/auth')", 'demo application');\n  await poll(cdp, "document.querySelector('.sync-confidence-indicator')?.textContent?.includes('Saved in demo')", 'demo local save confidence');`,
);

await replaceExact(
  'scripts/e2e-live-pages.mjs',
  `  await poll(cdp, "Boolean(document.querySelector('.app')) && !location.pathname.endsWith('/auth')", 'live demo application');`,
  `  await poll(cdp, "Boolean(document.querySelector('.app')) && !location.pathname.endsWith('/auth')", 'live demo application');\n  await poll(cdp, "document.querySelector('.sync-confidence-indicator')?.textContent?.includes('Saved in demo')", 'live demo local save confidence');`,
);

await replaceExact(
  'scripts/e2e-auth-sync-browser.mjs',
  `  await poll(browser, "Boolean(document.querySelector('.app'))", 'signed-up application');`,
  `  await poll(browser, "Boolean(document.querySelector('.app'))", 'signed-up application');\n  await poll(browser, "document.querySelector('.sync-confidence-indicator')?.textContent?.includes('Saved & synced')", 'initial synced confidence');`,
);

await replaceExact(
  'scripts/e2e-auth-sync-browser.mjs',
  `  await poll(browser, "[...document.querySelectorAll('.settings-message')].some((item) => item.textContent?.includes('Synced at'))", 'successful cloud sync');`,
  `  await poll(browser, "[...document.querySelectorAll('.settings-message')].some((item) => item.textContent?.includes('Synced at'))", 'successful cloud sync');\n  await poll(browser, "document.querySelector('.sync-confidence-indicator')?.textContent?.includes('Saved & synced')", 'synced confidence');`,
);

await replaceExact(
  'scripts/e2e-auth-sync-browser.mjs',
  `  await poll(browser, \`document.body.innerText.includes(\${JSON.stringify(taskTitle)})\`, 'new task on dashboard');`,
  `  await poll(browser, \`document.body.innerText.includes(\${JSON.stringify(taskTitle)})\`, 'new task on dashboard');\n  await poll(browser, "document.querySelector('.sync-confidence-indicator')?.textContent?.includes('Saved here · waiting')", 'waiting-to-sync confidence');`,
);

console.log('Phase 5 sync confidence patch applied.');
