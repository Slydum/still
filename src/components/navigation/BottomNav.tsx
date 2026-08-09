import { BookOpen, CalendarDays, CircleEllipsis, Home, Plus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../stores/useAppStore';

const items = [
  { label: 'Home', path: '/', icon: Home },
  { label: 'Journal', path: '/today', icon: BookOpen },
  { label: 'Add', path: '#', icon: Plus },
  { label: 'Calendar', path: '/calendar', icon: CalendarDays },
  { label: 'Settings', path: '/more', icon: CircleEllipsis },
];

function isActivePath(itemPath: string, pathname: string) {
  if (itemPath === '/') {
    return pathname === '/'
      || pathname === '/tasks'
      || pathname.startsWith('/life/')
      || pathname === '/work'
      || pathname === '/money'
      || pathname === '/health'
      || pathname === '/reflection'
      || pathname === '/check-ins'
      || pathname === '/notifications';
  }
  return pathname === itemPath;
}

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const openQuickAdd = useAppStore((s) => s.openQuickAdd);
  return <nav className="bottom-nav" aria-label="Primary navigation">
    {items.map(({ label, path, icon: Icon }) => label === 'Add' ? (
      <button key={label} className="nav-item" onClick={() => openQuickAdd()} aria-label="Quick add" type="button"><span className="add-button"><Plus size={26} /></span><span>{label}</span></button>
    ) : (
      <button
        key={label}
        className={`nav-item ${isActivePath(path, location.pathname) ? 'active' : ''}`}
        onClick={() => navigate(path)}
        aria-current={isActivePath(path, location.pathname) ? 'page' : undefined}
        type="button"
      ><Icon size={21} /><span>{label}</span></button>
    ))}
  </nav>;
}
