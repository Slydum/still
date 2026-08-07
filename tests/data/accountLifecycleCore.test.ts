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

    assert.deepEqual(calls, ['sync', 'signOut']);
    assert.equal(result.synced, false);
  });

  it('never clears local data when the required pre-clear sync fails', async () => {
    const calls: string[] = [];

    await assert.rejects(() => signOutAndClearDevice({
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
    }), /offline/);

    assert.deepEqual(calls, ['sync']);
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

    assert.deepEqual(calls, ['sync', 'signOut', 'clearLocal']);
    assert.deepEqual(result, { synced: true, cleared: true });
  });
});
