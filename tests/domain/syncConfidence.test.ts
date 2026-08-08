import assert from 'node:assert/strict';
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
    assert.ok(view.detail.includes('2 local changes'));
  });

  it('shows cloud-bound dirty records as safely waiting', () => {
    const view = deriveSyncConfidence({ ...baseline, pendingChanges: 2, hasSuccessfulSync: true });
    assert.equal(view.kind, 'waiting');
    assert.equal(view.label, 'Saved here · waiting');
    assert.ok(view.detail.includes('2 local changes'));
  });

  it('keeps cloud failure separate from local save failure', () => {
    const view = deriveSyncConfidence({ ...baseline, cloudPhase: 'error', hasSuccessfulSync: true });
    assert.equal(view.kind, 'cloud-error');
    assert.equal(view.label, 'Saved here · cloud retry');
    assert.ok(view.detail.includes('local copy is safe'));
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
