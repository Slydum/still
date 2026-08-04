import { Navigate, Route, Routes } from 'react-router-dom';
import { BottomNav } from '../components/navigation/BottomNav';
import { QuickAddSheet } from '../components/ui/QuickAddSheet';
import { CalendarPage } from '../features/calendar/CalendarPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { JournalPage } from '../features/journal/JournalPage';
import { CheckInHistoryPage } from '../features/check-ins/CheckInHistoryPage';

function Placeholder({ title, icon }: { title: string; icon: string }) {
  return <main className="shell page-placeholder"><div><div style={{fontSize:64}}>{icon}</div><h1>{title}</h1><p className="subtle">This calm little corner is ready for its next feature.</p></div></main>;
}

export default function App() {
  return <div className="app">
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/today" element={<JournalPage />} />
      <Route path="/calendar" element={<CalendarPage />} />
      <Route path="/check-ins" element={<CheckInHistoryPage />} />
      <Route path="/more" element={<Placeholder title="More" icon="🌷" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <BottomNav />
    <QuickAddSheet />
  </div>;
}
