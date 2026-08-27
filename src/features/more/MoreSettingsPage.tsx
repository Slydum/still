import {
  BriefcaseBusiness,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  Heart,
  HeartPulse,
  Search,
  WalletCards,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../stores/useAppStore';
import './more-phase3.css';
import { DataExportPanel } from './DataExportPanel';
import { MorePage } from './MorePage';

const quickAccess = [
  { label: 'Search', path: '/search', Icon: Search },
  { label: 'Calendar', path: '/calendar', Icon: CalendarDays },
  { label: 'Check-in', path: '/check-ins', Icon: HeartPulse },
  { label: 'Tasks', path: '/tasks', Icon: CheckSquare },
] as const;

const lifeAreas = [
  { label: 'Work', path: '/work', Icon: BriefcaseBusiness },
  { label: 'Love', path: '/life/love', Icon: Heart },
  { label: 'Health', path: '/health', Icon: HeartPulse },
  { label: 'Money', path: '/money', Icon: WalletCards },
] as const;

function firstInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || 'S';
}

export function MoreSettingsPage() {
  const navigate = useNavigate();
  const name = useAppStore((state) => state.name);

  return (
    <>
      <main className="shell more-hub" aria-labelledby="more-hub-title">
        <header className="more-hub-header">
          <h1 id="more-hub-title">More</h1>
        </header>

        <button className="more-profile-card" onClick={() => document.getElementById('profile-settings-title')?.scrollIntoView({ behavior: 'smooth' })} type="button">
          <span className="more-profile-avatar" aria-hidden="true">{firstInitial(name)}</span>
          <span className="more-profile-copy"><strong>{name || 'Your profile'}</strong><small>Local-first personal space</small></span>
          <ChevronRight size={16} />
        </button>

        <section className="more-hub-section" aria-labelledby="more-quick-title">
          <h2 id="more-quick-title">Quick access</h2>
          <div className="more-quick-grid">
            {quickAccess.map(({ label, path, Icon }) => (
              <button key={path} onClick={() => navigate(path)} type="button"><Icon size={18} /><span>{label}</span></button>
            ))}
          </div>
        </section>

        <section className="more-hub-section" aria-labelledby="more-life-title">
          <h2 id="more-life-title">Your life</h2>
          <div className="more-life-list">
            {lifeAreas.map(({ label, path, Icon }) => (
              <button key={path} onClick={() => navigate(path)} type="button"><Icon size={17} /><span>{label}</span><ChevronRight size={15} /></button>
            ))}
          </div>
        </section>

        <div className="more-settings-intro"><span>Settings</span><p>Preferences, privacy, sync, and the quieter machinery underneath.</p></div>
      </main>
      <MorePage />
      <div className="shell more-export-shell">
        <DataExportPanel />
      </div>
    </>
  );
}