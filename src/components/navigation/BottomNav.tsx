import { BookOpen, BriefcaseBusiness, CalendarDays, CircleEllipsis, Home, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../stores/useAppStore';

const mobileItems = [
  { label: 'Home', path: '/', icon: Home },
  { label: 'Journal', path: '/today', icon: BookOpen },
  { label: 'Add', path: '#', icon: Plus },
  { label: 'Calendar', path: '/calendar', icon: CalendarDays },
  { label: 'Settings', path: '/more', icon: CircleEllipsis },
];

const desktopItems = [
  { label: 'Home', path: '/', icon: Home },
  { label: 'Work', path: '/work', icon: BriefcaseBusiness },
  { label: 'Journal', path: '/today', icon: BookOpen },
  { label: 'Add', path: '#', icon: Plus },
  { label: 'Calendar', path: '/calendar', icon: CalendarDays },
  { label: 'Settings', path: '/more', icon: CircleEllipsis },
];

function isWorkPath(pathname: string) {
  return pathname === '/work' || pathname.startsWith('/work/');
}

function isActivePath(itemPath: string, pathname: string, desktop: boolean) {
  if (itemPath === '/work') return isWorkPath(pathname);
  if (itemPath === '/') {
    return pathname === '/'
      || pathname === '/tasks'
      || pathname.startsWith('/life/')
      || (!desktop && isWorkPath(pathname))
      || pathname === '/money'
      || pathname === '/health'
      || pathname === '/reflection'
      || pathname === '/check-ins'
      || pathname === '/notifications';
  }
  return pathname === itemPath;
}

function useDesktopNavigation() {
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return desktop;
}

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const openQuickAdd = useAppStore((s) => s.openQuickAdd);
  const desktop = useDesktopNavigation();
  const items = desktop ? desktopItems : mobileItems;

  return <nav className="bottom-nav" aria-label="Primary navigation">
    {items.map(({ label, path, icon: Icon }) => label === 'Add' ? (
      <button key={label} className="nav-item" onClick={() => openQuickAdd()} aria-label="Quick add" type="button"><span className="add-button"><Plus size={26} /></span><span>{label}</span></button>
    ) : (
      <button
        key={label}
        className={`nav-item ${isActivePath(path, location.pathname, desktop) ? 'active' : ''}`}
        onClick={() => navigate(path)}
        aria-current={isActivePath(path, location.pathname, desktop) ? 'page' : undefined}
        type="button"
      ><Icon size={21} /><span>{label}</span></button>
    ))}
  </nav>;
}
