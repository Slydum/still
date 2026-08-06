import { Cloud, LogOut, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { synchronizeCloudData } from '../../data/cloudSync';
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
    });
  }, []);

  const syncNow = useCallback(async (quiet = false) => {
    setSyncing(true);
    if (!quiet) setMessage('Synchronizing your local and cloud data…');

    try {
      const snapshot = await synchronizeCloudData();
      applySnapshot(snapshot);
      const completedAt = new Date();
      setLastSyncedAt(completedAt);
      setMessage(`Synced at ${completedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Still could not synchronize right now.');
    } finally {
      setSyncing(false);
    }
  }, [applySnapshot]);

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
    try {
      await signOutCloud();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Still could not sign out right now.');
      setLoading(false);
    }
  };

  return (
    <section className="settings-section" id="cloud-sync" aria-labelledby="cloud-sync-title">
      <div className="settings-section-heading">
        <span><Cloud size={19} /></span>
        <div>
          <h2 id="cloud-sync-title">Account & cloud sync</h2>
          <p>Manage the account that keeps your Still data connected.</p>
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
            <button
              className="settings-test-notification"
              disabled={loading || syncing}
              onClick={() => void disconnect()}
              type="button"
            >
              <LogOut size={15} /> Log out of Still
            </button>
          </>
        ) : (
          <p className="settings-message" role="status">Your account session ended. Return to the login screen to continue.</p>
        )}

        {available && message && <p className="settings-message" role="status">{message}</p>}
        <p className="settings-footnote">
          Still keeps an offline copy on this device. Only this signed-in account can read its cloud records.
        </p>
      </div>
    </section>
  );
}
