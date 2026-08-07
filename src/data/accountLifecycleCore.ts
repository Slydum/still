export type AccountLifecycleDependencies = {
  sync: () => Promise<void>;
  signOut: () => Promise<void>;
  clearLocal: () => Promise<void>;
};

export async function signOutKeepingLocalCopy(
  dependencies: Pick<AccountLifecycleDependencies, 'sync' | 'signOut'>,
) {
  let synced = true;

  try {
    await dependencies.sync();
  } catch {
    synced = false;
  }

  await dependencies.signOut();
  return { synced };
}

export async function signOutAndClearDevice(
  dependencies: AccountLifecycleDependencies,
) {
  await dependencies.sync();
  await dependencies.signOut();
  await dependencies.clearLocal();
  return { synced: true, cleared: true } as const;
}
