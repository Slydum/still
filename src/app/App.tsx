import { Suspense, lazy, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import { BottomNavigation } from '../components/navigation/BottomNavigation';
import { DesktopHeader } from '../components/navigation/DesktopHeader';
import { QuickAddSheet } from '../components/ui/QuickAddSheet';
import { initializeCloudSession, subscribeToCloudSession, type CloudSession } from '../data/supabaseClient';
import { synchronizeCloudData } from '../data/cloudSync';
import { stillDb } from '../data/localDb';
import { displayNameFromUserMetadata, shouldSeedSignupDisplayName } from '../data/accountSettings';
import { flushRepositoryWrites } from '../data/repositoryWriteQueue';
import { usePermanentDataRepository, applyPermanentDataSnapshot } from '../hooks/usePermanentDataRepository';
import { useReminderEngine } from '../hooks/useReminderEngine';
import { AuthPage } from '../features/auth/AuthPage';
import { CalendarPage } from '../features/calendar/CalendarPage';
import { CheckInHistoryPage } from '../features/check-ins/CheckInHistoryPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { JournalPage } from '../features/journal/JournalPage';
import { LifeAreaPage } from '../features/life-areas/LifeAreaPage';
import { MorePage } from '../features/more/MorePage';
import { NotificationsPage } from '../features/notifications/NotificationsPage';
import { TasksPage } from '../features/tasks/TasksPage';
import { WeeklyReflectionPage } from '../features/reflection/WeeklyReflectionPage';
import { WorkPage } from '../features/work/WorkPage';
import { WorkQueuePage } from '../features/work/WorkQueuePage';
import { useAppStore } from '../stores/useAppStore';
import { isDemoMode } from './demoMode';

const MoneyPage = lazy(() => import('../features/money/MoneyPage').then((module) => ({ default: module.MoneyPage })));
const HealthPage = lazy(() => import('../features/health/HealthPage').then((module) => ({ default: module.HealthPage })));

function RouteScrollManager() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'auto';
    if (navigationType === 'POP') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
    return () => window.cancelAnimationFrame(frame);
  }, [navigationType, pathname]);
  return null;
}

function AppLoading({ message = 'Preparing your space…' }: { message?: string }) {
  return <main className="auth-loading" aria-live="polite"><div className="auth-loading-card"><h1 className="auth-brand">Still.</h1><div className="auth-loading-spinner" aria-hidden="true" /><p>{message}</p></div></main>;
}

function applyCloudSnapshot(snapshot: Awaited<ReturnType<typeof synchronizeCloudData>>) { applyPermanentDataSnapshot(snapshot); }
function createSeedMutationId() { return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `profile-seed-${Date.now()}-${Math.random().toString(36).slice(2)}`; }

async function seedDisplayNameForNewAccount(session: CloudSession) {
  const displayName = displayNameFromUserMetadata(session.user.user_metadata);
  if (!displayName) return;
  const existing = await stillDb.accountSettings.get('account');
  if (!existing || existing.id !== 'account' || !shouldSeedSignupDisplayName(existing.name, existing.serverRevision)) return;
  useAppStore.setState({ name: displayName });
  await stillDb.accountSettings.put({ ...existing, name: displayName, updatedAt: Date.now(), syncCounter: existing.syncCounter + 1, mutationId: createSeedMutationId(), dirty: true });
}

function AppRoutes() {
  return <div className="app"><RouteScrollManager /><Routes>
    <Route path="/" element={<DashboardPage />} />
    <Route path="/tasks" element={<TasksPage />} />
    <Route path="/today" element={<JournalPage />} />
    <Route path="/calendar" element={<CalendarPage />} />
    <Route path="/check-ins" element={<CheckInHistoryPage />} />
    <Route path="/more" element={<MorePage />} />
    <Route path="/reflection" element={<WeeklyReflectionPage />} />
    <Route path="/notifications" element={<NotificationsPage />} />
    <Route path="/work" element={<WorkQueuePage />} />
    <Route path="/work/details" element={<WorkPage />} />
    <Route path="/life/work" element={<Navigate to="/work" replace />} />
    <Route path="/money" element={<Suspense fallback={<AppLoading message="Opening Money…" />}><MoneyPage /></Suspense>} />
    <Route path="/health" element={<Suspense fallback={<AppLoading message="Opening Health…" />}><HealthPage /></Suspense>} />
    <Route path="/life/:areaId" element={<LifeAreaPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes><BottomNavigation /><DesktopHeader /><QuickAddSheet /></div>;
}

function DemoApp() {
  usePermanentDataRepository();
  useReminderEngine();
  return <AppRoutes />;
}

function SignedInApp({ session }: { session: CloudSession }) {
  usePermanentDataRepository();
  useReminderEngine();
  const [ready, setReady] = useState(false);
  const [syncError, setSyncError] = useState<string>();

  useEffect(() => {
    let disposed = false;
    setReady(false);
    setSyncError(undefined);
    void (async () => {
      try {
        await seedDisplayNameForNewAccount(session);
        const snapshot = await synchronizeCloudData();
        if (!disposed) applyCloudSnapshot(snapshot);
      } catch (error) {
        if (!disposed) setSyncError(error instanceof Error ? error.message : 'Still could not synchronize this account.');
      } finally {
        if (!disposed) setReady(true);
      }
    })();
    return () => { disposed = true; };
  }, [session.user.id]);

  if (!ready) return <AppLoading message="Synchronizing your space…" />;
  if (syncError) return <main className="auth-loading"><div className="auth-loading-card"><h1 className="auth-brand">Still.</h1><p>{syncError}</p><button type="button" onClick={() => window.location.reload()}>Try again</button></div></main>;
  return <AppRoutes />;
}

export function App() {
  const [session, setSession] = useState<CloudSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(!isDemoMode());

  useEffect(() => {
    if (isDemoMode()) return undefined;
    let disposed = false;
    void initializeCloudSession().then((nextSession) => {
      if (!disposed) {
        setSession(nextSession);
        setLoadingSession(false);
      }
    });
    const unsubscribe = subscribeToCloudSession((nextSession) => {
      if (disposed) return;
      setSession(nextSession);
      setLoadingSession(false);
    });
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => () => { void flushRepositoryWrites(); }, []);

  if (isDemoMode()) return <DemoApp />;
  if (loadingSession) return <AppLoading />;
  if (!session) return <AuthPage />;
  return <SignedInApp session={session} />;
}
