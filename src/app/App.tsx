import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { BottomNav } from '../components/navigation/BottomNav';
import { QuickAddSheet } from '../components/ui/QuickAddSheet';
import { CalendarPage } from '../features/calendar/CalendarPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { JournalPage } from '../features/journal/JournalPage';
import { CheckInHistoryPage } from '../features/check-ins/CheckInHistoryPage';
import { MorePage } from '../features/more/MorePage';
import { NotificationsPage } from '../features/notifications/NotificationsPage';
import { WorkPage } from '../features/work/WorkPage';
import { useAppStore } from '../stores/useAppStore';
import { useReminderEngine } from '../hooks/useReminderEngine';

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return null;
}

export default function App() {
  useReminderEngine();
  const appearanceTone = useAppStore((state) => state.appearanceTone);
  const reduceMotion = useAppStore((state) => state.reduceMotion);

  useEffect(() => {
    document.documentElement.dataset.tone = appearanceTone;
    document.documentElement.dataset.reduceMotion = String(reduceMotion);
  }, [appearanceTone, reduceMotion]);

  return <div className="app">
    <ScrollToTop />
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/today" element={<JournalPage />} />
      <Route path="/calendar" element={<CalendarPage />} />
      <Route path="/check-ins" element={<CheckInHistoryPage />} />
      <Route path="/more" element={<MorePage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/work" element={<WorkPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <BottomNav />
    <QuickAddSheet />
  </div>;
}
