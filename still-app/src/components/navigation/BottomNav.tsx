import { CalendarDays, CircleEllipsis, Home, Plus, SunMedium } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../stores/useAppStore';

const items = [
  { label: 'Life', path: '/', icon: Home },
  { label: 'Today', path: '/today', icon: SunMedium },
  { label: 'Add', path: '#', icon: Plus },
  { label: 'Calendar', path: '/calendar', icon: CalendarDays },
  { label: 'More', path: '/more', icon: CircleEllipsis },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const openQuickAdd = useAppStore((s) => s.openQuickAdd);

  return <nav className="bottom-nav" aria-label="Primary navigation">
    {items.map(({ label, path, icon: Icon }) => label === 'Add' ? (
      <button key={label} className="nav-item" onClick={openQuickAdd} aria-label="Quick add">
        <span className="add-button"><Plus size={26} /></span>
        <span>{label}</span>
      </button>
    ) : (
      <button key={label} className={`nav-item ${location.pathname === path ? 'active' : ''}`} onClick={() => navigate(path)}>
        <Icon size={21} />
        <span>{label}</span>
      </button>
    ))}
  </nav>;
}
