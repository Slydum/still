import {
  Bell,
  Check,
  Clock3,
  Info,
  MapPin,
  Palette,
  RotateCcw,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useAppStore, type AppearanceTone } from '../../stores/useAppStore';
import { CloudSyncSettings } from './CloudSyncSettings';

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
  const taskReminders = useAppStore((state) => state.taskReminders);
  const setTaskReminders = useAppStore((state) => state.setTaskReminders);
  const eventReminders = useAppStore((state) => state.eventReminders);
  const setEventReminders = useAppStore((state) => state.setEventReminders);
  const dailyCheckInReminder = useAppStore((state) => state.dailyCheckInReminder);
  const setDailyCheckInReminder = useAppStore((state) => state.setDailyCheckInReminder);
  const reminderTime = useAppStore((state) => state.reminderTime);
  const setReminderTime = useAppStore((state) => state.setReminderTime);
  const eventReminderMinutes = useAppStore((state) => state.eventReminderMinutes);
  const setEventReminderMinutes = useAppStore((state) => state.setEventReminderMinutes);
  const addNotification = useAppStore((state) => state.addNotification);
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
    setNotificationMessage(enabled ? 'Local reminders are enabled in Still on this browser.' : 'Permission was not granted. You can change it in your browser settings.');

    if (enabled) {
      try {
        new Notification('Still notifications are ready', { body: 'A gentle reminder can meet you here when you need it.' });
      } catch {
        // Some mobile browsers grant permission but only display notifications from a service worker.
      }
    }
  };

  const sendTestNotification = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification('A quiet hello from Still', { body: 'Your reminders are working.', tag: 'still-test' });
      } else {
        new Notification('A quiet hello from Still', { body: 'Your reminders are working.', tag: 'still-test' });
      }
      setNotificationMessage('Test reminder sent.');
      addNotification({ id: `system:test:${Date.now()}`, title: 'A quiet hello from Still', body: 'Your reminders are working.', kind: 'system' });
    } catch {
      setNotificationMessage('This browser could not display the test reminder.');
    }
  };

  const updateWeatherPreference = (enabled: boolean) => {
    setAutoWeather(enabled);
    if (!enabled) {
      window.localStorage.removeItem(LOCATION_WEATHER_KEY);
      setWeather(undefined);
    }
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
        <div className="settings-section-heading"><span><MapPin size={19} /></span><div><h2 id="weather-settings-title">Weather & location</h2><p>Automatic weather uses browser location only for a direct Open-Meteo weather request.</p></div></div>
        <div className="card settings-card">
          <SettingToggle checked={autoWeather} label="Automatic local weather" description="Request current local weather when the dashboard opens on this device." onChange={updateWeatherPreference} />
          <div className="settings-status-row"><span><small>Current condition</small><strong>{weather ? weather.replace('-', ' ') : 'Not connected'}</strong></span>{weather && <button onClick={() => { window.localStorage.removeItem(LOCATION_WEATHER_KEY); setWeather(undefined); }} type="button"><RotateCcw size={15} /> Reset</button>}</div>
          <p className="settings-footnote">When automatic weather runs, your browser sends latitude and longitude directly to Open-Meteo to request current conditions. Still does not add those coordinates to your Supabase account. Turning this off stops automatic weather requests; browser location permission is managed by your browser or device.</p>
        </div>
      </section>

      <section className="settings-section" id="notifications" aria-labelledby="notification-settings-title">
        <div className="settings-section-heading"><span><Bell size={19} /></span><div><h2 id="notification-settings-title">Notifications</h2><p>Control local browser reminders on this device.</p></div></div>
        <div className="card settings-card">
          <div className="settings-action-row"><span><strong>Browser notifications</strong><small>Permission: {notificationPermission}</small></span>{notificationsEnabled ? <button className="settings-secondary-action" onClick={() => setNotificationsEnabled(false)} type="button">Pause in Still</button> : <button className="settings-primary-action" onClick={() => void enableNotifications()} type="button">{notificationPermission === 'granted' ? 'Resume in Still' : 'Enable'}</button>}</div>
          {notificationsEnabled && <>
            <div className="settings-reminder-options">
              <SettingToggle checked={taskReminders} label="Task reminders" description="Remind me about unfinished tasks due today." onChange={setTaskReminders} />
              <SettingToggle checked={eventReminders} label="Event reminders" description="Alert me shortly before timed calendar events." onChange={setEventReminders} />
              <SettingToggle checked={dailyCheckInReminder} label="Daily check-in" description="A gentle reminder when I have not checked in yet." onChange={setDailyCheckInReminder} />
            </div>
            <div className="settings-reminder-fields">
              <label><span><Clock3 size={15} /> Daily reminder time</span><input aria-label="Daily reminder time" onChange={(event) => setReminderTime(event.target.value)} type="time" value={reminderTime} /></label>
              <label><span>Event notice</span><select aria-label="Event reminder lead time" onChange={(event) => setEventReminderMinutes(Number(event.target.value))} value={eventReminderMinutes}><option value={10}>10 minutes before</option><option value={30}>30 minutes before</option><option value={60}>1 hour before</option></select></label>
            </div>
            <button className="settings-test-notification" onClick={() => void sendTestNotification()} type="button">Send a test reminder</button>
          </>}
          {notificationMessage && <p className="settings-message" role="status">{notificationMessage}</p>}
          <p className="settings-footnote">Still has no server-side push service. Reminder checks are driven by the running page/PWA process, so browsers may throttle or suspend them in the background and a fully closed browser cannot receive these local-only reminders. Pausing reminders in Still does not revoke browser notification permission.</p>
        </div>
      </section>

      <CloudSyncSettings />

      <section className="settings-section" aria-labelledby="data-settings-title">
        <div className="settings-section-heading"><span><ShieldCheck size={19} /></span><div><h2 id="data-settings-title">Data & privacy</h2><p>Local-first storage, account-scoped cloud sync, and clear recovery limits.</p></div></div>
        <div className="card settings-card">
          <p className="settings-footnote">Still saves supported records in IndexedDB first. Cloud sync is attempted when the signed-in app starts, when you tap “Sync now,” and during logout flows; edits made between successful syncs can exist only on this browser.</p>
          <p className="settings-footnote">Cloud sync includes tasks, events, journal entries, expenses, links, work shifts, check-ins, and account preferences. Browser notification permission and local notification history, location/weather state, reminder delivery bookkeeping, and daily quote history stay device-specific.</p>
          <p className="settings-footnote">Supabase rows are scoped to your authenticated account with row-level security. Still cloud sync is not an end-to-end encrypted vault with user-only keys.</p>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="about-settings-title">
        <div className="settings-section-heading"><span><Info size={19} /></span><div><h2 id="about-settings-title">About</h2><p>A calm daily space built around your own rhythm.</p></div></div>
        <div className="card settings-about-card"><div><strong>Still</strong><span>Version 0.1.0</span></div><p>Offline use depends on this browser’s local copy. Clearing site data or using “Log out — clear local data” removes that copy. Another device can recover only records that previously completed a successful Supabase sync.</p></div>
      </section>
    </main>
  );
}
