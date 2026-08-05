import { Cloud, LogOut, RefreshCw, Send } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react';
import { synchronizeCloudData } from '../../data/cloudSync';
import {
  getCloudSession,
  isSupabaseAvailable,
  requestCloudMagicLink,
  signOutCloud,
  subscribeToCloudSession,
  type CloudSession,
} from '../../data/supabaseClient';
import { useAppStore } from '../../stores/useAppStore';

export function CloudSyncSettings() {
  const [email, setEmail] = useState('');
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
    setAvailable(isSupabaseAvailable());

    const initialize = async () => {
      try {
        const currentSession = await getCloudSession();
        if (disposed) return;
        setSession(currentSession);
        if (currentSession) void syncNow(true);
      } catch (error) {
        if (!disposed) {
          setMessage(error instanceof Error ? error.message : 'Cloud sync could not initialize.');
        }
      } finally {
        if (!disposed) setLoading(false);
      }
    };

    void initialize();
    const unsubscribe = subscribeToCloudSession((nextSession) => {
      if (disposed) return;
      setSession(nextSession);
      if (nextSession) void syncNow();
    });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [syncNow]);

  const sendMagicLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setMessage('');
    try {
      await requestCloudMagicLink(email.trim());
      setMessage('Check your email and open the secure sign-in link on this device.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Still could not send the sign-in link.');
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    setLoading(true);
    try {
      await signOutCloud();
      setSession(null);
      setMessage('Cloud sync is disconnected. Your local data remains on this device.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Still could not sign out right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="settings-section" id="cloud-sync" aria-labelledby="cloud-sync-title">
      <div className="settings-section-heading">
        <span><Cloud size={19} /></span>
        <div>
          <h2 id="cloud-sync-title">Cloud sync</h2>
          <p>Keep your Still data available across signed-in devices.</p>
        </div>
      </div>

      <div className="card settings-card">
        {!available ? (
          <p className="settings-message" role="status">
            Cloud sync could not load. Check your connection, then reopen Still.
          </p>
        ) : session ? (
          <>
            <div className="settings-action-row">
              <span>
                <strong>{session.user.email ?? 'Still account'}</strong>
                <small>{lastSyncedAt ? `Last synced ${lastSyncedAt.toLocaleString()}` : 'Connected securely with Supabase.'}</small>
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
              <LogOut size={15} /> Disconnect cloud sync
            </button>
          </>
        ) : (
          <form className="settings-profile-form" onSubmit={sendMagicLink}>
            <label>
              <span>Email address</span>
              <input
                autoComplete="email"
                inputMode="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </label>
            <button disabled={loading || !email.trim()} type="submit">
              <Send size={15} /> {loading ? 'Loading…' : 'Email sign-in link'}
            </button>
          </form>
        )}

        {message && <p className="settings-message" role="status">{message}</p>}
        <p className="settings-footnote">
          Cloud sync is optional. Still keeps an offline copy on this device and only lets the signed-in account access its rows.
        </p>
      </div>
    </section>
  );
}
