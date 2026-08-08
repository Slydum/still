import { readFile, writeFile } from 'node:fs/promises';

async function replaceExact(path, before, after) {
  const text = await readFile(path, 'utf8');
  if (!text.includes(before)) throw new Error(`${path}: expected text not found`);
  await writeFile(path, text.replace(before, after));
}

await replaceExact(
  'src/hooks/usePermanentDataRepository.ts',
  `let bootstrapPromise: ReturnType<typeof stillRepository.bootstrap> | undefined;`,
  `let bootstrapPromise: ReturnType<typeof stillRepository.bootstrap> | undefined;\nlet applyingRepositorySnapshot = false;`,
);

await replaceExact(
  'src/hooks/usePermanentDataRepository.ts',
  `function cacheFromStore(): PermanentDataCache {\n  const state = useAppStore.getState();\n  return {\n    tasks: state.tasks,\n    events: state.events,\n    journalEntries: state.journalEntries,\n    expenses: state.expenses,\n    entityLinks: state.entityLinks,\n    workShifts: state.workShifts,\n    accountSettings: accountSettingsFromStore(),\n  };\n}`,
  `function cacheFromStore(): PermanentDataCache {\n  const state = useAppStore.getState();\n  return {\n    tasks: state.tasks,\n    events: state.events,\n    journalEntries: state.journalEntries,\n    expenses: state.expenses,\n    entityLinks: state.entityLinks,\n    workShifts: state.workShifts,\n    accountSettings: accountSettingsFromStore(),\n  };\n}\n\nexport function applyPermanentDataSnapshot(snapshot: PermanentDataCache) {\n  applyingRepositorySnapshot = true;\n  try {\n    useAppStore.setState({\n      tasks: snapshot.tasks,\n      events: snapshot.events,\n      journalEntries: snapshot.journalEntries,\n      expenses: snapshot.expenses,\n      entityLinks: snapshot.entityLinks,\n      workShifts: snapshot.workShifts,\n      ...accountSettingsStatePatch(snapshot.accountSettings),\n    });\n  } finally {\n    applyingRepositorySnapshot = false;\n  }\n}`,
);

await replaceExact(
  'src/hooks/usePermanentDataRepository.ts',
  `      useAppStore.setState({\n        tasks: snapshot.tasks,\n        events: snapshot.events,\n        journalEntries: snapshot.journalEntries,\n        expenses: snapshot.expenses,\n        entityLinks: snapshot.entityLinks,\n        workShifts: snapshot.workShifts,\n        ...accountSettingsStatePatch(snapshot.accountSettings),\n      });`,
  `      applyPermanentDataSnapshot(snapshot);`,
);

await replaceExact(
  'src/hooks/usePermanentDataRepository.ts',
  `      unsubscribe = useAppStore.subscribe((state, previousState) => {\n        if (state.tasks !== previousState.tasks) {`,
  `      unsubscribe = useAppStore.subscribe((state, previousState) => {\n        if (applyingRepositorySnapshot) return;\n\n        if (state.tasks !== previousState.tasks) {`,
);

await replaceExact(
  'src/app/App.tsx',
  `import {\n  initializePermanentDataRepository,\n  usePermanentDataRepository,\n} from '../hooks/usePermanentDataRepository';`,
  `import {\n  applyPermanentDataSnapshot,\n  initializePermanentDataRepository,\n  usePermanentDataRepository,\n} from '../hooks/usePermanentDataRepository';`,
);

await replaceExact(
  'src/app/App.tsx',
  `function applyCloudSnapshot(snapshot: Awaited<ReturnType<typeof synchronizeCloudData>>) {\n  useAppStore.setState({\n    tasks: snapshot.tasks,\n    events: snapshot.events,\n    journalEntries: snapshot.journalEntries,\n    expenses: snapshot.expenses,\n    entityLinks: snapshot.entityLinks,\n    workShifts: snapshot.workShifts,\n    ...accountSettingsStatePatch(snapshot.accountSettings),\n  });\n}`,
  `function applyCloudSnapshot(snapshot: Awaited<ReturnType<typeof synchronizeCloudData>>) {\n  applyPermanentDataSnapshot(snapshot);\n}`,
);

await replaceExact(
  'src/app/App.tsx',
  `  accountSettingsStatePatch,\n  displayNameFromUserMetadata,`,
  `  displayNameFromUserMetadata,`,
);

await replaceExact(
  'src/features/more/CloudSyncSettings.tsx',
  `import { accountSettingsStatePatch } from '../../data/accountSettings';\nimport { synchronizeCloudData } from '../../data/cloudSync';`,
  `import { synchronizeCloudData } from '../../data/cloudSync';`,
);

await replaceExact(
  'src/features/more/CloudSyncSettings.tsx',
  `import { useCloudSyncStatus } from '../../hooks/useCloudSyncStatus';\nimport { useAppStore } from '../../stores/useAppStore';`,
  `import { useCloudSyncStatus } from '../../hooks/useCloudSyncStatus';\nimport { applyPermanentDataSnapshot } from '../../hooks/usePermanentDataRepository';`,
);

await replaceExact(
  'src/features/more/CloudSyncSettings.tsx',
  `  const applySnapshot = useCallback((snapshot: Awaited<ReturnType<typeof synchronizeCloudData>>) => {\n    useAppStore.setState({\n      tasks: snapshot.tasks,\n      events: snapshot.events,\n      journalEntries: snapshot.journalEntries,\n      expenses: snapshot.expenses,\n      entityLinks: snapshot.entityLinks,\n      workShifts: snapshot.workShifts,\n      ...accountSettingsStatePatch(snapshot.accountSettings),\n    });\n  }, []);`,
  `  const applySnapshot = useCallback((snapshot: Awaited<ReturnType<typeof synchronizeCloudData>>) => {\n    applyPermanentDataSnapshot(snapshot);\n  }, []);`,
);

console.log('Phase 5 sync echo fix applied.');
