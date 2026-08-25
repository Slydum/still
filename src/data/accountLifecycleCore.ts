export type AccountLifecycleStage =
  | 'syncing'
  | 'preparing-local-clear'
  | 'clearing-local-data'
  | 'signing-out'
  | 'complete';

export type AccountLifecycleProgress = {
  stage: AccountLifecycleStage;
  synced: boolean;
  preparedForClear: boolean;
  cleared: boolean;
  signedOut: boolean;
};

export type AccountLifecycleDependencies = {
  sync: () => Promise<void>;
  prepareLocalClear: () => Promise<void>;
  signOut: () => Promise<void>;
  clearLocal: () => Promise<void>;
  onProgress?: (progress: AccountLifecycleProgress) => void;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The account operation could not finish.';
}

export class AccountLifecycleError extends Error {
  readonly stage: AccountLifecycleStage;
  readonly progress: AccountLifecycleProgress;
  readonly originalError: unknown;

  constructor(stage: AccountLifecycleStage, progress: AccountLifecycleProgress, originalError: unknown) {
    super(errorMessage(originalError));
    this.name = 'AccountLifecycleError';
    this.stage = stage;
    this.progress = { ...progress };
    this.originalError = originalError;
  }
}

function publish(
  progress: AccountLifecycleProgress,
  stage: AccountLifecycleStage,
  listener?: (progress: AccountLifecycleProgress) => void,
) {
  progress.stage = stage;
  listener?.({ ...progress });
}

export async function signOutKeepingLocalCopy(
  dependencies: Pick<AccountLifecycleDependencies, 'sync' | 'signOut' | 'onProgress'>,
) {
  const progress: AccountLifecycleProgress = {
    stage: 'syncing',
    synced: false,
    preparedForClear: false,
    cleared: false,
    signedOut: false,
  };

  publish(progress, 'syncing', dependencies.onProgress);
  try {
    await dependencies.sync();
    progress.synced = true;
  } catch {
    // Ordinary logout is intentionally best-effort. Unsynced data remains local.
  }

  publish(progress, 'signing-out', dependencies.onProgress);
  try {
    await dependencies.signOut();
    progress.signedOut = true;
  } catch (error) {
    throw new AccountLifecycleError('signing-out', progress, error);
  }

  publish(progress, 'complete', dependencies.onProgress);
  return { synced: progress.synced, signedOut: true } as const;
}

export async function signOutAndClearDevice(
  dependencies: AccountLifecycleDependencies,
) {
  const progress: AccountLifecycleProgress = {
    stage: 'syncing',
    synced: false,
    preparedForClear: false,
    cleared: false,
    signedOut: false,
  };

  publish(progress, 'syncing', dependencies.onProgress);
  try {
    await dependencies.sync();
    progress.synced = true;
  } catch (error) {
    throw new AccountLifecycleError('syncing', progress, error);
  }

  publish(progress, 'preparing-local-clear', dependencies.onProgress);
  try {
    await dependencies.prepareLocalClear();
    progress.preparedForClear = true;
  } catch (error) {
    throw new AccountLifecycleError('preparing-local-clear', progress, error);
  }

  publish(progress, 'clearing-local-data', dependencies.onProgress);
  try {
    await dependencies.clearLocal();
    progress.cleared = true;
  } catch (error) {
    throw new AccountLifecycleError('clearing-local-data', progress, error);
  }

  publish(progress, 'signing-out', dependencies.onProgress);
  try {
    await dependencies.signOut();
    progress.signedOut = true;
  } catch (error) {
    throw new AccountLifecycleError('signing-out', progress, error);
  }

  publish(progress, 'complete', dependencies.onProgress);
  return {
    synced: true,
    preparedForClear: true,
    cleared: true,
    signedOut: true,
  } as const;
}
