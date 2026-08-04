import { Navigate, Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import { BottomNav } from '../components/navigation/BottomNav';
import { QuickAddSheet } from '../components/ui/QuickAddSheet';
import { CalendarPage } from '../features/calendar/CalendarPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { JournalPage } from '../features/journal/JournalPage';
import { CheckInHistoryPage } from '../features/check-ins/CheckInHistoryPage';
import { MorePage } from '../features/more/MorePage';
import { useAppStore } from '../stores/useAppStore';

export default function App() {
  const appearanceTone = useAppStore((state) => state.appearanceTone);
  const reduceMotion = useAppStore((state) => state.reduceMotion);

  useEffect(() => {
    document.documentElement.dataset.tone = appearanceTone;
    document.documentElement.dataset.reduceMotion = String(reduceMotion);
  }, [appearanceTone, reduceMotion]);

  return <div className="app">
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/today" element={<JournalPage />} />
      <Route path="/calendar" element={<CalendarPage />} />
      <Route path="/check-ins" element={<CheckInHistoryPage />} />
      <Route path="/more" element={<MorePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <BottomNav />
    <QuickAddSheet />
  </div>;
}
