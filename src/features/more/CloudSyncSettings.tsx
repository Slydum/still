import { Cloud, LogOut, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { clearDemoAppState, endDemoSession, isDemoMode } from '../../app/demoMode';
import { signOutAndClearDevice, signOutKeepingLocalCopy } from '../../data/accountLifecycleCore';
import { synchronizeCloudData } from '../../data/cloudSync';
import { clearLocalStillData } from '../../data/localDataLifecycle';
import { stillDb } from '../../data/localDb';
import {
  getCloudSession,
  getSupabaseConfigurationError,
  isSupabaseAvailable,
  signOutCloud,
  subscribeToCloudSession,
  type CloudSession,
} from '../../data/supabaseClient';
import { useCloudSyncStatus } from '../../hooks/useCloudSyncStatus';
import { applyPermanentDataSnapshot } from '../../hooks/usePermanentDataRepository';

function DemoSandboxSettings() {
  const [busy, setBusy] = useState(false);

  const resetDemo = async () => {
    if (window.prompt('Reset only the demo sandbox? Type RESET to continue.') !== 'RESET') return;
    setBusy(true);
    try {
      clearDemoAppState();
      await stillDb.delete();
      window.location.reload();
    } finally {
      setBusy(false);
    }
  };

  const leaveDemo = () => {
    endDemoSession();
    window.location.reload();
  };

  return (
    <section className="settings-section" id="cloud-sync" aria-labelledby="cloud-sync-title">
      <div className="settings-section-heading">
        <span><Cloud size={19} /></span>
        <div><h2 id="cloud-sync-title">Demo sandbox</h2><p>Demo records use a separate local database and never sync to Supabase.</p></div>
      </div>
      <div className="card settings-card">
        <p className="settings-message" role="status">Demo mode is active. Records you create here stay in the demo database on this browser.</p>
        <div className="settings-reminder-options">
          <button className="settings-test-notification" disabled={busy} onClick={() => void resetDemo()} type="button"><RotateCcw size={15} /> Reset demo data</button>
          <button className="settings-test-notification" disabled={busy} onClick={leaveDemo} type="button"><LogOut size={15} /> Exit demo</button>
        </div>
        <p className="settings-footnote">Your normal Still record database is not merged into the demo database. Browser-level permissions and device-level notification/weather state still belong to the browser, so resetting demo records does not reset those browser controls.</p>
      </div>
    </section>
  );
}

export function CloudSyncSettings() {
  const demoMode = isDemoMode();
  const [session, setSession] = useState<CloudSession | null>(null);
  const [available, setAvailable] = useState(isSupabaseAvailable());
  const [loading, setLoading] = useState(!demoMode);
  const [message, setMessage] = useState('');
  const cloudStatus = useCloudSyncStatus();
  const syncing = cloudStatus.phase === 'syncing';

  const applySnapshot = useCallback((snapshot: Awaited<ReturnType<typeof synchronizeCloudData>>) => {
    applyPermanentDataSnapshot(snapshot);
  }, []);

  const performSync = useCallback(async () => {
    const snapshot = await synchronizeCloudData();
    applySnapshot(snapshot);
    return new Date();
  }, [applySnapshot]);

  const syncNow = useCallback(async () => {
    setMessage('Syncing local changes and checking for cloud updates…');
    try {
      const completedAt = await performSync();
      setMessage(`Synced at ${completedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Still could not synchronize right now. Your local copy has not been cleared.');
    }
  }, [performSync]);

  useEffect(() => {
    if (demoMode) return;
    let disposed = false;
    const cloudAvailable = isSupabaseAvailable();
    setAvailable(cloudAvailable);
    if (!cloudAvailable) {
      setMessage(getSupabaseConfigurationError() ?? 'Cloud sync could not load.');
      setLoading(false);
      return () => { disposed = true; };
    }

    void getCloudSession()
      .then((currentSession) => { if (!disposed) setSession(currentSession); })
      .catch((error) => { if (!disposed) setMessage(error instanceof Error ? error.message : 'Account details could not load.'); })
      .finally(() => { if (!disposed) setLoading(false); });

    const unsubscribe = subscribeToCloudSession((_event, nextSession) => { if (!disposed) setSession(nextSession); });
    return () => { disposed = true; unsubscribe(); };
  }, [demoMode]);

  if (demoMode) return <DemoSandboxSettings />;

  const disconnect = async () => {
    setLoading(true);
    setMessage('Trying one cloud sync before logout…');
    try {
      await signOutKeepingLocalCopy({ sync: async () => { await performSync(); }, signOut: signOutCloud });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Still could not sign out right now.');
      setLoading(false);
    }
  };

  const disconnectAndClear = async () => {
    const confirmation = window.prompt('Still will require a successful cloud sync first, then sign out and remove this account’s Still-managed local database and device preferences from this browser. Browser-granted permissions and cached app files are controlled by the browser and may remain. Type CLEAR to continue.');
    if (confirmation !== 'CLEAR') return;
    setLoading(true);
    setMessage('Syncing before clearing this browser…');
    try {
      await signOutAndClearDevice({ sync: async () => { await performSync(); }, signOut: signOutCloud, clearLocal: clearLocalStillData });
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? `Local data was not cleared because Still could not safely finish the operation: ${error.message}` : 'Local data was not cleared because Still could not safely finish the operation.');
      setLoading(false);
    }
  };

  return (
    <section className="settings-section" id="cloud-sync" aria-labelledby="cloud-sync-title">
      <div className="settings-section-heading"><span><Cloud size={19} /></span><div><h2 id="cloud-sync-title">Account & cloud sync</h2><p>Still saves locally first. Records reach Supabase only after a successful cloud sync.</p></div></div>
      <div className="card settings-card">
        {!available ? <p className="settings-message" role="status">{message || 'Account access is not configured for this deployment.'}</p>
          : loading ? <p className="settings-message" role="status">Loading your account…</p>
            : session ? <>
              <div className="settings-action-row"><span><strong>{session.user.email ?? 'Still account'}</strong><small>{cloudStatus.pendingChanges > 0
                ? `${cloudStatus.pendingChanges} local ${cloudStatus.pendingChanges === 1 ? 'change is' : 'changes are'} saved here and waiting for cloud sync.`
                : cloudStatus.error
                  ? 'The latest cloud check did not finish. Your local copy is still here.'
                  : cloudStatus.lastSyncedAt
                    ? `Last successful sync ${new Date(cloudStatus.lastSyncedAt).toLocaleString()}`
                    : 'Signed in. Still also attempts cloud sync when the signed-in app starts.'}</small></span><button className="settings-primary-action" disabled={syncing} onClick={() => void syncNow()} type="button"><RefreshCw size={15} /> {syncing ? 'Syncing…' : 'Sync now'}</button></div>
              <div className="settings-reminder-options"><button className="settings-test-notification" disabled={loading || syncing} onClick={() => void disconnect()} type="button"><LogOut size={15} /> Log out — keep local copy</button><button className="settings-test-notification" disabled={loading || syncing} onClick={() => void disconnectAndClear()} type="button"><ShieldCheck size={15} /> Log out — clear local data</button></div>
            </> : <p className="settings-message" role="status">Your account session ended. Return to the login screen to continue.</p>}
        {available && message && <p className="settings-message" role="status">{message}</p>}
        <p className="settings-footnote">Profile name, appearance, reminder schedule choices, work profile, and work privacy preference sync with your account. Browser notification permission, whether reminders are enabled on this browser, notification history, location/weather state, and reminder delivery bookkeeping stay device-specific.</p>
        <p className="settings-footnote">Ordinary logout tries to sync first but can still log out if cloud sync is unavailable; any unsynced changes remain only in this browser until the same account signs in and syncs successfully. Clearing local data is stricter and will not proceed unless sync succeeds.</p>
      </div>
    </section>
  );
}
