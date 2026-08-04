import {
  Bell,
  Check,
  Download,
  Info,
  MapPin,
  Palette,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { stillDb } from '../../data/stillDb';
import { useAppStore, type AppearanceTone } from '../../stores/useAppStore';

const LOCATION_WEATHER_KEY = 'still-location-weather-enabled-v2';

const tones: Array<{ value: AppearanceTone; label: string; colors: string[] }> = [
  { value: 'lavender', label: 'Lavender', colors: ['#b8a7f7', '#f8c8d8'] },
  { value: 'warm', label: 'Warm', colors: ['#e9ad81', '#f4d6b8'] },
  { value: 'sage', label: 'Sage', colors: ['#88b69f', '#c9e3d4'] },
];

function SettingToggle({ checked, label, description, onChange }: { checked: boolean; label: string; description: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="settings-toggle-row">
      <span><strong>{label}</strong><small>{description}</small></span>
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
    </label>
  );
}

export function MorePage() {
  const storedName = useAppStore((state) => state.name);
  const setName = useAppStore((state) => state.setName);
  const appearanceTone = useAppStore((state) => state.appearanceTone);
  const setAppearanceTone = useAppStore((state) => state.setAppearanceTone);
  const reduceMotion = useAppStore((state) => state.reduceMotion);
  const setReduceMotion = useAppStore((state) => state.setReduceMotion);
  const notificationsEnabled = useAppStore((state) => state.notificationsEnabled);
  const setNotificationsEnabled = useAppStore((state) => state.setNotificationsEnabled);
  const autoWeather = useAppStore((state) => state.autoWeather);
  const setAutoWeather = useAppStore((state) => state.setAutoWeather);
  const weather = useAppStore((state) => state.weather);
  const setWeather = useAppStore((state) => state.setWeather);
  const [name, updateName] = useState(storedName);
  const [profileSaved, setProfileSaved] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const notificationSupported = typeof window !== 'undefined' && 'Notification' in window;
  const notificationPermission = notificationSupported ? Notification.permission : 'unsupported';

  useEffect(() => {
    if (window.location.hash === '#notifications') {
      window.setTimeout(() => document.getElementById('notifications')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }), 80);
    }
  }, [reduceMotion]);

  useEffect(() => {
    if (notificationSupported && Notification.permission !== 'granted' && notificationsEnabled) {
      setNotificationsEnabled(false);
    }
  }, [notificationSupported, notificationsEnabled, setNotificationsEnabled]);

  const saveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;
    setName(name.trim());
    updateName(name.trim());
    setProfileSaved(true);
    window.setTimeout(() => setProfileSaved(false), 1800);
  };

  const enableNotifications = async () => {
    if (!notificationSupported) {
      setNotificationMessage('Notifications are not supported in this browser.');
      return;
    }

    const permission = await Notification.requestPermission();
    const enabled = permission === 'granted';
    setNotificationsEnabled(enabled);
    setNotificationMessage(enabled ? 'Notifications are ready.' : 'Permission was not granted. You can change it in your browser settings.');

    if (enabled) {
      try {
        new Notification('Still notifications are ready', { body: 'A gentle reminder can meet you here when you need it.' });
      } catch {
        // Some mobile browsers grant permission but only display notifications from a service worker.
      }
    }
  };

  const updateWeatherPreference = (enabled: boolean) => {
    setAutoWeather(enabled);
    if (!enabled) {
      window.localStorage.removeItem(LOCATION_WEATHER_KEY);
      setWeather(undefined);
    }
  };

  const exportData = async () => {
    const state = useAppStore.getState();
    const [checkIns, dailyQuotes] = await Promise.all([
      stillDb.checkIns.toArray(),
      stillDb.dailyQuotes.toArray(),
    ]);
    const payload = {
      app: 'Still',
      version: '0.1.0',
      exportedAt: new Date().toISOString(),
      profile: { name: state.name },
      preferences: {
        appearanceTone: state.appearanceTone,
        reduceMotion: state.reduceMotion,
        notificationsEnabled: state.notificationsEnabled,
        autoWeather: state.autoWeather,
      },
      tasks: state.tasks,
      events: state.events,
      journalEntries: state.journalEntries,
      checkIns,
      dailyQuotes,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `still-export-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const resetData = async () => {
    const confirmation = window.prompt('This removes every task, event, journal entry, and check-in stored on this device. Type RESET to continue.');
    if (confirmation !== 'RESET') return;
    await stillDb.delete();
    window.localStorage.removeItem('still-app-state-v1');
    window.localStorage.removeItem(LOCATION_WEATHER_KEY);
    window.location.reload();
  };

  return (
    <main className="shell more-page">
      <header className="more-page-header"><p className="section-kicker">Make Still yours</p><h1>More</h1><p className="subtle">Preferences, privacy, and the details that shape your space.</p></header>

      <section className="settings-section" aria-labelledby="profile-settings-title">
        <div className="settings-section-heading"><span><UserRound size={19} /></span><div><h2 id="profile-settings-title">Profile</h2><p>The name Still uses when it greets you.</p></div></div>
        <form className="card settings-profile-form" onSubmit={saveProfile}>
          <label><span>Your name</span><input maxLength={40} onChange={(event) => updateName(event.target.value)} required type="text" value={name} /></label>
          <button disabled={!name.trim() || name.trim() === storedName} type="submit">{profileSaved ? <><Check size={16} /> Saved</> : 'Save name'}</button>
        </form>
      </section>

      <section className="settings-section" aria-labelledby="appearance-settings-title">
        <div className="settings-section-heading"><span><Palette size={19} /></span><div><h2 id="appearance-settings-title">Appearance</h2><p>Choose the atmosphere that feels easiest to return to.</p></div></div>
        <div className="card settings-card">
          <div className="tone-picker" role="radiogroup" aria-label="Color atmosphere">
            {tones.map((tone) => <button className={appearanceTone === tone.value ? 'is-selected' : ''} key={tone.value} onClick={() => setAppearanceTone(tone.value)} role="radio" aria-checked={appearanceTone === tone.value} type="button"><span className="tone-swatches">{tone.colors.map((color) => <i key={color} style={{ background: color }} />)}</span><strong>{tone.label}</strong>{appearanceTone === tone.value && <Check size={15} />}</button>)}
          </div>
          <SettingToggle checked={reduceMotion} label="Reduce motion" description="Stops decorative movement and minimizes transitions." onChange={setReduceMotion} />
        </div>
      </section>

      <section className="settings-section" aria-labelledby="weather-settings-title">
        <div className="settings-section-heading"><span><MapPin size={19} /></span><div><h2 id="weather-settings-title">Weather & location</h2><p>Location is used only to request your local weather.</p></div></div>
        <div className="card settings-card">
          <SettingToggle checked={autoWeather} label="Automatic local weather" description="Refresh weather when Still opens on this device." onChange={updateWeatherPreference} />
          <div className="settings-status-row"><span><small>Current condition</small><strong>{weather ? weather.replace('-', ' ') : 'Not connected'}</strong></span>{weather && <button onClick={() => { window.localStorage.removeItem(LOCATION_WEATHER_KEY); setWeather(undefined); }} type="button"><RotateCcw size={15} /> Reset</button>}</div>
          <p className="settings-footnote">Turning this off stops automatic requests. Browser-level location permission is managed in your device settings.</p>
        </div>
      </section>

      <section className="settings-section" id="notifications" aria-labelledby="notification-settings-title">
        <div className="settings-section-heading"><span><Bell size={19} /></span><div><h2 id="notification-settings-title">Notifications</h2><p>Control whether Still may send gentle browser reminders.</p></div></div>
        <div className="card settings-card">
          <div className="settings-action-row"><span><strong>Browser notifications</strong><small>Permission: {notificationPermission}</small></span>{notificationsEnabled ? <button className="settings-secondary-action" onClick={() => setNotificationsEnabled(false)} type="button">Turn off</button> : <button className="settings-primary-action" onClick={() => void enableNotifications()} type="button">Enable</button>}</div>
          {notificationMessage && <p className="settings-message" role="status">{notificationMessage}</p>}
        </div>
      </section>

      <section className="settings-section" aria-labelledby="data-settings-title">
        <div className="settings-section-heading"><span><ShieldCheck size={19} /></span><div><h2 id="data-settings-title">Your data</h2><p>Still stores your personal content locally on this device.</p></div></div>
        <div className="card settings-card settings-data-actions">
          <button onClick={() => void exportData()} type="button"><Download size={18} /><span><strong>Export my data</strong><small>Download a readable JSON backup.</small></span></button>
          <button className="is-danger" onClick={() => void resetData()} type="button"><Trash2 size={18} /><span><strong>Reset Still</strong><small>Delete all locally stored app data.</small></span></button>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="about-settings-title">
        <div className="settings-section-heading"><span><Info size={19} /></span><div><h2 id="about-settings-title">About</h2><p>A calm daily space built around your own rhythm.</p></div></div>
        <div className="card settings-about-card"><div><strong>Still</strong><span>Version 0.1.0</span></div><p>Your tasks, calendar, journal, check-ins, and preferences remain in this browser unless you export or reset them.</p></div>
      </section>
    </main>
  );
}
