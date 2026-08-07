import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { BottomNav } from '../components/navigation/BottomNav';
import { QuickAddSheet } from '../components/ui/QuickAddSheet';
import {
  accountSettingsStatePatch,
  displayNameFromUserMetadata,
  shouldSeedSignupDisplayName,
} from '../data/accountSettings';
import { synchronizeCloudData } from '../data/cloudSync';
import { stillDb } from '../data/localDb';
import {
  getCloudSession,
  isSupabaseAvailable,
  signOutCloud,
  subscribeToCloudSession,
  type CloudSession,
} from '../data/supabaseClient';
import { AuthPage } from '../features/auth/AuthPage';
import { CalendarPage } from '../features/calendar/CalendarPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { JournalPage } from '../features/journal/JournalPage';
import { CheckInHistoryPage } from '../features/check-ins/CheckInHistoryPage';
import { MoneyPage } from '../features/money/MoneyPage';
import { MorePage } from '../features/more/MorePage';
import { NotificationsPage } from '../features/notifications/NotificationsPage';
import { WorkPage } from '../features/work/WorkPage';
import { useAppStore } from '../stores/useAppStore';
import {
  initializePermanentDataRepository,
  usePermanentDataRepository,
} from '../hooks/usePermanentDataRepository';
import { useReminderEngine } from '../hooks/useReminderEngine';
import { getAppRoutePathname, toAppPath } from './appLocation';
import { beginDemoSession, isDemoMode } from './demoMode';

function replaceBrowserRoute(path: string) {
  window.history.replaceState({}, '', toAppPath(path));
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);
  return null;
}

function AppLoading({ message = 'Preparing your space…' }: { message?: string }) {
  return <main className="auth-loading" aria-live="polite"><div className="auth-loading-card"><div className="auth-brand">Still.</div><div className="auth-loading-spinner" aria-hidden="true" /><p>{message}</p></div></main>;
}

function applyCloudSnapshot(snapshot: Awaited<ReturnType<typeof synchronizeCloudData>>) {
  useAppStore.setState({
    tasks: snapshot.tasks,
    events: snapshot.events,
    journalEntries: snapshot.journalEntries,
    expenses: snapshot.expenses,
    entityLinks: snapshot.entityLinks,
    workShifts: snapshot.workShifts,
    ...accountSettingsStatePatch(snapshot.accountSettings),
  });
}

function createSeedMutationId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `profile-seed-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function seedDisplayNameForNewAccount(session: CloudSession) {
  const displayName = displayNameFromUserMetadata(session.user.user_metadata);
  if (!displayName) return;
  const existing = await stillDb.accountSettings.get('account');
  if (!existing || !shouldSeedSignupDisplayName(existing.name, existing.serverRevision)) return;
  useAppStore.setState({ name: displayName });
  await stillDb.accountSettings.put({
    ...existing,
    name: displayName,
    updatedAt: Date.now(),
    syncCounter: existing.syncCounter + 1,
    mutationId: createSeedMutationId(),
    dirty: true,
  });
}

function AppRoutes() {
  return (
    <div className="app">
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/today" element={<JournalPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/check-ins" element={<CheckInHistoryPage />} />
        <Route path="/more" element={<MorePage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/work" element={<WorkPage />} />
        <Route path="/money" element={<MoneyPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
      <QuickAddSheet />
    </div>
  );
}

function DemoApp() {
  usePermanentDataRepository();
  useReminderEngine();
  const [preparing, setPreparing] = useState(true);

  useEffect(() => {
    let disposed = false;
    void initializePermanentDataRepository().finally(() => {
      if (!disposed) setPreparing(false);
    });
    return () => { disposed = true; };
  }, []);

  if (preparing) return <AppLoading message="Opening the demo sandbox…" />;
  return <AppRoutes />;
}

function AuthenticatedApp({ session }: { session: CloudSession }) {
  usePermanentDataRepository();
  useReminderEngine();
  const [preparing, setPreparing] = useState(true);
  const [accountConflict, setAccountConflict] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let disposed = false;
    const prepare = async () => {
      try {
        await initializePermanentDataRepository();
        await seedDisplayNameForNewAccount(session);
        const snapshot = await synchronizeCloudData();
        if (!disposed) applyCloudSnapshot(snapshot);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Still could not synchronize right now.';
        if (message.includes('already linked to another Still account')) {
          if (!disposed) setAccountConflict(message);
        } else {
          console.warn('Still opened with its offline copy because cloud sync was unavailable:', error);
        }
      } finally {
        if (!disposed) setPreparing(false);
      }
    };
    void prepare();
    return () => { disposed = true; };
  }, [session.user.id]);

  if (preparing) return <AppLoading message="Bringing your Still space together…" />;

  if (accountConflict) {
    return (
      <main className="auth-page">
        <section className="auth-card auth-conflict-card">
          <div className="auth-brand">Still.</div>
          <header className="auth-card-header"><p className="section-kicker">Account protection</p><h2>This device belongs to another Still account.</h2><p>{accountConflict}</p></header>
          <p className="auth-status is-error">Sign back into the original account, or clear this device from that account before using a different account.</p>
          <button className="auth-submit" disabled={signingOut} onClick={() => { setSigningOut(true); void signOutCloud().finally(() => setSigningOut(false)); }} type="button">{signingOut ? 'Signing out…' : 'Return to login'}</button>
        </section>
      </main>
    );
  }

  return <AppRoutes />;
}

export default function App() {
  const appearanceTone = useAppStore((state) => state.appearanceTone);
  const reduceMotion = useAppStore((state) => state.reduceMotion);
  const demoMode = isDemoMode();
  const [session, setSession] = useState<CloudSession | null>(null);
  const [authLoading, setAuthLoading] = useState(!demoMode);
  const [recoveryMode, setRecoveryMode] = useState(() => getAppRoutePathname() === '/auth/recovery');
  const [initialNotice] = useState(() => getAppRoutePathname() === '/auth/confirmed' ? 'Your email is confirmed. Log in with the password you created.' : '');

  useEffect(() => {
    document.documentElement.dataset.tone = appearanceTone;
    document.documentElement.dataset.reduceMotion = String(reduceMotion);
  }, [appearanceTone, reduceMotion]);

  useEffect(() => {
    if (demoMode) return;
    let disposed = false;
    if (!isSupabaseAvailable()) {
      setAuthLoading(false);
      return () => { disposed = true; };
    }

    const unsubscribe = subscribeToCloudSession((event, nextSession) => {
      if (disposed) return;
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setRecoveryMode(false);
      setSession(nextSession);
      setAuthLoading(false);
    });

    void getCloudSession()
      .then((currentSession) => { if (!disposed) setSession(currentSession); })
      .catch((error) => console.error('Still could not restore the account session:', error))
      .finally(() => { if (!disposed) setAuthLoading(false); });

    return () => { disposed = true; unsubscribe(); };
  }, [demoMode]);

  useEffect(() => {
    if (demoMode) {
      if (getAppRoutePathname().startsWith('/auth')) replaceBrowserRoute('/');
      return;
    }
    if (authLoading || recoveryMode) return;
    const routePathname = getAppRoutePathname();
    if (!session && !routePathname.startsWith('/auth')) replaceBrowserRoute('/auth');
    else if (session && routePathname.startsWith('/auth')) replaceBrowserRoute('/');
  }, [authLoading, demoMode, recoveryMode, session]);

  if (demoMode) return <DemoApp />;
  if (authLoading) return <AppLoading message="Checking your Still account…" />;

  if (!session || recoveryMode) {
    return (
      <AuthPage
        initialNotice={initialNotice}
        recoveryMode={recoveryMode}
        onEnterDemo={() => {
          beginDemoSession();
          window.location.assign(toAppPath('/'));
        }}
        onRecoveryComplete={() => { setRecoveryMode(false); replaceBrowserRoute('/'); }}
      />
    );
  }

  return <AuthenticatedApp session={session} />;
}
