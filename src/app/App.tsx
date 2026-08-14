import { Navigate, Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';
import { BottomNav } from '../components/navigation/BottomNav';
import { SyncConfidenceIndicator } from '../components/SyncConfidenceIndicator';
import { QuickAddSheet } from '../components/ui/QuickAddSheet';
import { displayNameFromUserMetadata, shouldSeedSignupDisplayName } from '../data/accountSettings';
import { synchronizeCloudData } from '../data/cloudSync';
import { stillDb } from '../data/localDb';
import { getCloudSession, isSupabaseAvailable, signOutCloud, subscribeToCloudSession, type CloudSession } from '../data/supabaseClient';
import { AuthPage } from '../features/auth/AuthPage';
import { CalendarPage } from '../features/calendar/CalendarPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { JournalPage } from '../features/journal/JournalPage';
import { CheckInHistoryPage } from '../features/check-ins/CheckInHistoryPage';
import { MorePage } from '../features/more/MorePage';
import { WeeklyReflectionPage } from '../features/reflection/WeeklyReflectionPage';
import { NotificationsPage } from '../features/notifications/NotificationsPage';
import { TasksPage } from '../features/tasks/TasksPage';
import { WorkPage } from '../features/work/WorkPage';
import { WorkQueuePage } from '../features/work/WorkQueuePage';
import { useAppStore } from '../stores/useAppStore';
import { applyPermanentDataSnapshot, initializePermanentDataRepository, usePermanentDataRepository } from '../hooks/usePermanentDataRepository';
import { useReminderEngine } from '../hooks/useReminderEngine';
import { getAppRoutePathname, toAppPath } from './appLocation';
import { beginDemoSession, isDemoMode } from './demoMode';

const HealthPage = lazy(() => import('../features/health/HealthPage').then((module) => ({ default: module.HealthPage })));
const LovePage = lazy(() => import('../features/love/LovePage').then((module) => ({ default: module.LovePage })));
const MoneyPage = lazy(() => import('../features/money/MoneyPage').then((module) => ({ default: module.MoneyPage })));
const LifeAreaPage = lazy(() => import('../features/life-area/LifeAreaPage').then((module) => ({ default: module.LifeAreaPage })));

function replaceBrowserRoute(path: string) {
  window.history.replaceState({}, '', toAppPath(path));
  window.dispatchEvent(new PopStateEvent('popstate'));
}

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
    <Route path="/life/health" element={<Navigate to="/health" replace />} />
    <Route path="/life/love" element={<Suspense fallback={<AppLoading message="Opening Love…" />}><LovePage /></Suspense>} />
    <Route path="/life/:areaId" element={<Suspense fallback={<AppLoading message="Opening your Life Area…" />}><LifeAreaPage /></Suspense>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes><SyncConfidenceIndicator /><BottomNav /><QuickAddSheet /></div>;
}

function DemoApp() {
  usePermanentDataRepository(); useReminderEngine();
  const [preparing, setPreparing] = useState(true);
  useEffect(() => { let disposed = false; void initializePermanentDataRepository().finally(() => { if (!disposed) setPreparing(false); }); return () => { disposed = true; }; }, []);
  if (preparing) return <AppLoading message="Opening the demo sandbox…" />;
  return <AppRoutes />;
}

function AuthenticatedApp({ session }: { session: CloudSession }) {
  usePermanentDataRepository(); useReminderEngine();
  const [preparing, setPreparing] = useState(true);
  const [accountConflict, setAccountConflict] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    let disposed = false;
    const prepare = async () => {
      try { await initializePermanentDataRepository(); await seedDisplayNameForNewAccount(session); const snapshot = await synchronizeCloudData(); if (!disposed) applyCloudSnapshot(snapshot); }
      catch (error) { const message = error instanceof Error ? error.message : 'Still could not synchronize right now.'; if (message.includes('already linked to another Still account')) { if (!disposed) setAccountConflict(message); } else console.warn('Still opened with its offline copy because cloud sync was unavailable:', error); }
      finally { if (!disposed) setPreparing(false); }
    };
    void prepare(); return () => { disposed = true; };
  }, [session.user.id]);
  if (preparing) return <AppLoading message="Bringing your Still space together…" />;
  if (accountConflict) return <main className="auth-page"><section className="auth-card auth-conflict-card"><div className="auth-brand">Still.</div><header className="auth-card-header"><p className="section-kicker">Account protection</p><h2>This browser already has local Still data for another account.</h2><p>{accountConflict}</p></header><p className="auth-status is-error">Still will not merge local records across accounts. Sign back into the original account and use “Log out — clear local data” before switching this browser to a different account.</p><button className="auth-submit" disabled={signingOut} onClick={() => { setSigningOut(true); void signOutCloud().finally(() => setSigningOut(false)); }} type="button">{signingOut ? 'Signing out…' : 'Return to login'}</button></section></main>;
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
  useEffect(() => { document.documentElement.dataset.tone = appearanceTone; document.documentElement.dataset.reduceMotion = String(reduceMotion); }, [appearanceTone, reduceMotion]);
  useEffect(() => {
    if (demoMode) return;
    let disposed = false;
    if (!isSupabaseAvailable()) { setAuthLoading(false); return () => { disposed = true; }; }
    const unsubscribe = subscribeToCloudSession((event, nextSession) => { if (disposed) return; if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true); if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setRecoveryMode(false); setSession(nextSession); setAuthLoading(false); });
    void getCloudSession().then((currentSession) => { if (!disposed) setSession(currentSession); }).catch((error) => console.error('Still could not restore the account session:', error)).finally(() => { if (!disposed) setAuthLoading(false); });
    return () => { disposed = true; unsubscribe(); };
  }, [demoMode]);
  useEffect(() => {
    if (demoMode) { if (getAppRoutePathname().startsWith('/auth')) replaceBrowserRoute('/'); return; }
    if (authLoading || recoveryMode) return;
    const routePathname = getAppRoutePathname();
    if (!session && !routePathname.startsWith('/auth')) replaceBrowserRoute('/auth'); else if (session && routePathname.startsWith('/auth')) replaceBrowserRoute('/');
  }, [authLoading, demoMode, recoveryMode, session]);
  if (demoMode) return <DemoApp />;
  if (authLoading) return <AppLoading message="Checking your Still account…" />;
  if (!session || recoveryMode) return <AuthPage initialNotice={initialNotice} recoveryMode={recoveryMode} onEnterDemo={() => { beginDemoSession(); window.location.assign(toAppPath('/')); }} onRecoveryComplete={() => { setRecoveryMode(false); replaceBrowserRoute('/'); }} />;
  return <AuthenticatedApp session={session} />;
}
