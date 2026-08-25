import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import {
  AccountLifecycleError,
  signOutAndClearDevice,
  signOutKeepingLocalCopy,
} from '../../src/data/accountLifecycleCore.js';

const supabaseClientSource = fs.readFileSync('src/data/supabaseClient.ts', 'utf8');

describe('account data lifecycle', () => {
  it('attempts a best-effort sync before ordinary logout while keeping local data', async () => {
    const calls: string[] = [];

    const result = await signOutKeepingLocalCopy({
      sync: async () => {
        calls.push('sync');
        throw new Error('offline');
      },
      signOut: async () => {
        calls.push('signOut');
      },
    });

    assert.equal(calls.join(','), 'sync,signOut');
    assert.equal(result.synced, false);
    assert.equal(result.signedOut, true);
  });

  it('scopes browser logout to the current Supabase session', () => {
    assert.ok(supabaseClientSource.includes("supabase.auth.signOut({ scope: 'local' })"));
    assert.equal(supabaseClientSource.includes('supabase.auth.signOut();'), false);
  });

  it('never prepares, clears, or signs out when the required pre-clear sync fails', async () => {
    const calls: string[] = [];
    let error: unknown;

    try {
      await signOutAndClearDevice({
        sync: async () => {
          calls.push('sync');
          throw new Error('offline');
        },
        prepareLocalClear: async () => {
          calls.push('prepareLocalClear');
        },
        clearLocal: async () => {
          calls.push('clearLocal');
        },
        signOut: async () => {
          calls.push('signOut');
        },
      });
    } catch (caught) {
      error = caught;
    }

    assert.ok(error instanceof AccountLifecycleError);
    assert.equal(error.stage, 'syncing');
    assert.equal(error.message, 'offline');
    assert.equal(error.progress.synced, false);
    assert.equal(error.progress.cleared, false);
    assert.equal(error.progress.signedOut, false);
    assert.equal(calls.join(','), 'sync');
  });

  it('keeps the session signed in when queued local writes cannot be drained', async () => {
    const calls: string[] = [];
    let error: unknown;

    try {
      await signOutAndClearDevice({
        sync: async () => {
          calls.push('sync');
        },
        prepareLocalClear: async () => {
          calls.push('prepareLocalClear');
          throw new Error('write queue failed');
        },
        clearLocal: async () => {
          calls.push('clearLocal');
        },
        signOut: async () => {
          calls.push('signOut');
        },
      });
    } catch (caught) {
      error = caught;
    }

    assert.ok(error instanceof AccountLifecycleError);
    assert.equal(error.stage, 'preparing-local-clear');
    assert.equal(error.progress.synced, true);
    assert.equal(error.progress.preparedForClear, false);
    assert.equal(error.progress.cleared, false);
    assert.equal(error.progress.signedOut, false);
    assert.equal(calls.join(','), 'sync,prepareLocalClear');
  });

  it('keeps the session signed in when local clearing fails', async () => {
    const calls: string[] = [];
    let error: unknown;

    try {
      await signOutAndClearDevice({
        sync: async () => {
          calls.push('sync');
        },
        prepareLocalClear: async () => {
          calls.push('prepareLocalClear');
        },
        clearLocal: async () => {
          calls.push('clearLocal');
          throw new Error('indexeddb blocked');
        },
        signOut: async () => {
          calls.push('signOut');
        },
      });
    } catch (caught) {
      error = caught;
    }

    assert.ok(error instanceof AccountLifecycleError);
    assert.equal(error.stage, 'clearing-local-data');
    assert.equal(error.progress.synced, true);
    assert.equal(error.progress.preparedForClear, true);
    assert.equal(error.progress.cleared, false);
    assert.equal(error.progress.signedOut, false);
    assert.equal(calls.join(','), 'sync,prepareLocalClear,clearLocal');
  });

  it('reports the recoverable final-sign-out state after local data was cleared', async () => {
    const calls: string[] = [];
    let error: unknown;

    try {
      await signOutAndClearDevice({
        sync: async () => {
          calls.push('sync');
        },
        prepareLocalClear: async () => {
          calls.push('prepareLocalClear');
        },
        clearLocal: async () => {
          calls.push('clearLocal');
        },
        signOut: async () => {
          calls.push('signOut');
          throw new Error('sign out unavailable');
        },
      });
    } catch (caught) {
      error = caught;
    }

    assert.ok(error instanceof AccountLifecycleError);
    assert.equal(error.stage, 'signing-out');
    assert.equal(error.progress.synced, true);
    assert.equal(error.progress.preparedForClear, true);
    assert.equal(error.progress.cleared, true);
    assert.equal(error.progress.signedOut, false);
    assert.equal(calls.join(','), 'sync,prepareLocalClear,clearLocal,signOut');
  });

  it('clears only after sync and queued writes finish, then signs out', async () => {
    const calls: string[] = [];
    const stages: string[] = [];

    const result = await signOutAndClearDevice({
      sync: async () => {
        calls.push('sync');
      },
      prepareLocalClear: async () => {
        calls.push('prepareLocalClear');
      },
      clearLocal: async () => {
        calls.push('clearLocal');
      },
      signOut: async () => {
        calls.push('signOut');
      },
      onProgress: (progress) => stages.push(progress.stage),
    });

    assert.equal(calls.join(','), 'sync,prepareLocalClear,clearLocal,signOut');
    assert.equal(stages.join(','), 'syncing,preparing-local-clear,clearing-local-data,signing-out,complete');
    assert.equal(result.synced, true);
    assert.equal(result.preparedForClear, true);
    assert.equal(result.cleared, true);
    assert.equal(result.signedOut, true);
  });
});
