import { Cloud, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  signOutAndClearDevice,
  signOutKeepingLocalCopy,
} from '../../data/accountLifecycleCore';
import { accountSettingsStatePatch } from '../../data/accountSettings';
import { synchronizeCloudData } from '../../data/cloudSync';
import { clearLocalStillData } from '../../data/localDataLifecycle';
import {
  getCloudSession,
  getSupabaseConfigurationError,
  isSupabaseAvailable,
  signOutCloud,
  subscribeToCloudSession,
  type CloudSession,
} from '../../data/supabaseClient';
import { useAppStore } from '../../stores/useAppStore';

export function CloudSyncSettings() {
  const [session, setSession] = useState<CloudSession | null>(null);
  const [available, setAvailable] = useState(isSupabaseAvailable());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>();

  const applySnapshot = useCallback((snapshot: Awaited<ReturnType<typeof synchronizeCloudData>>) => {
    useAppStore.setState({
      tasks: snapshot.tasks,
      events: snapshot.events,
      journalEntries: snapshot.journalEntries,
      expenses: snapshot.expenses,
      entityLinks: snapshot.entityLinks,
      workShifts: snapshot.workShifts,
      ...accountSettingsStatePatch(snapshot.accountSettings),
    });
  }, []);

  const performSync = useCallback(async () => {
    const snapshot = await synchronizeCloudData();
    applySnapshot(snapshot);
    const completedAt = new Date();
    setLastSyncedAt(completedAt);
    return completedAt;
  }, [applySnapshot]);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    setMessage('Synchronizing your local and cloud data…');

    try {
      const completedAt = await performSync();
      setMessage(`Synced at ${completedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Still could not synchronize right now.');
    } finally {
      setSyncing(false);
    }
  }, [performSync]);

  useEffect(() => {
    let disposed = false;
    const cloudAvailable = isSupabaseAvailable();
    setAvailable(cloudAvailable);

    if (!cloudAvailable) {
      setMessage(getSupabaseConfigurationError() ?? 'Cloud sync could not load.');
      setLoading(false);
      return () => {
        disposed = true;
      };
    }

    void getCloudSession()
      .then((currentSession) => {
        if (!disposed) setSession(currentSession);
      })
      .catch((error) => {
        if (!disposed) setMessage(error instanceof Error ? error.message : 'Account details could not load.');
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });

    const unsubscribe = subscribeToCloudSession((_event, nextSession) => {
      if (!disposed) setSession(nextSession);
    });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  const disconnect = async () => {
    setLoading(true);
    setMessage('Syncing before logout…');

    try {
      await signOutKeepingLocalCopy({
        sync: async () => {
          await performSync();
        },
        signOut: signOutCloud,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Still could not sign out right now.');
      setLoading(false);
    }
  };

  const disconnectAndClear = async () => {
    const confirmation = window.prompt(
      'Still will sync your cloud-backed records and account preferences first, then remove all Still data and device-only state from this browser. Type CLEAR to continue.',
    );
    if (confirmation !== 'CLEAR') return;

    setLoading(true);
    setMessage('Syncing before clearing this device…');

    try {
      await signOutAndClearDevice({
        sync: async () => {
          await performSync();
        },
        signOut: signOutCloud,
        clearLocal: clearLocalStillData,
      });
      window.location.reload();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `This device was not cleared because Still could not safely finish the operation: ${error.message}`
          : 'This device was not cleared because Still could not safely finish the operation.',
      );
      setLoading(false);
    }
  };

  return (
    <section className="settings-section" id="cloud-sync" aria-labelledby="cloud-sync-title">
      <div className="settings-section-heading">
        <span><Cloud size={19} /></span>
        <div>
          <h2 id="cloud-sync-title">Account & cloud sync</h2>
          <p>Supabase is the durable copy of your synced Still records and account preferences.</p>
        </div>
      </div>

      <div className="card settings-card">
        {!available ? (
          <p className="settings-message" role="status">
            {message || 'Account access is not configured for this deployment.'}
          </p>
        ) : loading ? (
          <p className="settings-message" role="status">Loading your account…</p>
        ) : session ? (
          <>
            <div className="settings-action-row">
              <span>
                <strong>{session.user.email ?? 'Still account'}</strong>
                <small>{lastSyncedAt ? `Last synced ${lastSyncedAt.toLocaleString()}` : 'Signed in securely with Supabase.'}</small>
              </span>
              <button
                className="settings-primary-action"
                disabled={syncing}
                onClick={() => void syncNow()}
                type="button"
              >
                <RefreshCw size={15} /> {syncing ? 'Syncing…' : 'Sync now'}
              </button>
            </div>

            <div className="settings-reminder-options">
              <button
                className="settings-test-notification"
                disabled={loading || syncing}
                onClick={() => void disconnect()}
                type="button"
              >
                <LogOut size={15} /> Log out and keep offline copy
              </button>
              <button
                className="settings-test-notification"
                disabled={loading || syncing}
                onClick={() => void disconnectAndClear()}
                type="button"
              >
                <ShieldCheck size={15} /> Log out and clear this device
              </button>
            </div>
          </>
        ) : (
          <p className="settings-message" role="status">Your account session ended. Return to the login screen to continue.</p>
        )}

        {available && message && <p className="settings-message" role="status">{message}</p>}
        <p className="settings-footnote">
          Your profile name, appearance, reminder preferences, work profile, and work privacy preference sync with your account. Browser notification permission, local notification history, location/weather state, and reminder bookkeeping remain specific to this device.
        </p>
      </div>
    </section>
  );
}