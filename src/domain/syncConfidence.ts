export type SyncConfidenceKind =
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
