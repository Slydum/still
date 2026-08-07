import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  signOutAndClearDevice,
  signOutKeepingLocalCopy,
} from '../../src/data/accountLifecycleCore.js';

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
  });

  it('never clears local data when the required pre-clear sync fails', async () => {
    const calls: string[] = [];
    let error: unknown;

    try {
      await signOutAndClearDevice({
        sync: async () => {
          calls.push('sync');
          throw new Error('offline');
        },
        signOut: async () => {
          calls.push('signOut');
        },
        clearLocal: async () => {
          calls.push('clearLocal');
        },
      });
    } catch (caught) {
      error = caught;
    }

    assert.ok(error instanceof Error);
    assert.equal((error as Error).message, 'offline');
    assert.equal(calls.join(','), 'sync');
  });

  it('clears only after a successful sync and logout', async () => {
    const calls: string[] = [];

    const result = await signOutAndClearDevice({
      sync: async () => {
        calls.push('sync');
      },
      signOut: async () => {
        calls.push('signOut');
      },
      clearLocal: async () => {
        calls.push('clearLocal');
      },
    });

    assert.equal(calls.join(','), 'sync,signOut,clearLocal');
    assert.equal(result.synced, true);
    assert.equal(result.cleared, true);
  });
});
