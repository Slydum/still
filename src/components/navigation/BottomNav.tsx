import { BookOpen, BriefcaseBusiness, CheckSquare, CircleEllipsis, Home, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppStore } from '../../stores/useAppStore';
import { isNavCurrentPage, isNavSectionActive } from './navigationState';

const mobileItems = [
  { label: 'Home', path: '/', icon: Home },
  { label: 'Journal', path: '/today', icon: BookOpen },
  { label: 'Add', path: '#', icon: Plus },
  { label: 'Tasks', path: '/tasks', icon: CheckSquare },
  { label: 'More', path: '/more', icon: CircleEllipsis },
];

const desktopItems = [
  { label: 'Home', path: '/', icon: Home },
  { label: 'Work', path: '/work', icon: BriefcaseBusiness },
  { label: 'Journal', path: '/today', icon: BookOpen },
  { label: 'Add', path: '#', icon: Plus },
  { label: 'Tasks', path: '/tasks', icon: CheckSquare },
  { label: 'More', path: '/more', icon: CircleEllipsis },
];

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
  const openQuickAdd = useAppStore((s) => s.openQuickAdd);
  const desktop = useDesktopNavigation();
  const items = desktop ? desktopItems : mobileItems;

  return <nav className="bottom-nav" aria-label="Primary navigation">
    {items.map(({ label, path, icon: Icon }) => label === 'Add' ? (
      <button key={label} className="nav-item" onClick={() => openQuickAdd()} aria-label="Quick add" type="button"><span className="add-button"><Plus size={26} /></span><span>{label}</span></button>
    ) : (
      <Link
        key={label}
        className={`nav-item ${isNavSectionActive(path, location.pathname, desktop) ? 'active' : ''}`}
        to={path}
        aria-current={isNavCurrentPage(path, location.pathname) ? 'page' : undefined}
      ><Icon size={21} /><span>{label}</span></Link>
    ))}
  </nav>;
}