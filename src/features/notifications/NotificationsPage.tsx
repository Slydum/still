import { ArrowLeft, Bell, CalendarClock, CheckCheck, CircleCheckBig, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CHECK_IN_FOCUS_EVENT } from '../check-ins/checkInReminder';
import { useAppStore, type AppNotification, type AppNotificationKind } from '../../stores/useAppStore';

const notificationIcons = {
  task: CircleCheckBig,
  event: CalendarClock,
  'check-in': Sparkles,
  system: Bell,
} satisfies Record<AppNotificationKind, typeof Bell>;

function formatNotificationTime(createdAt: number) {
  const date = new Date(createdAt);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function isUniversalReminder(notification: AppNotification) {
  return notification.id.startsWith('reminder:');
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const notifications = useAppStore((state) => state.notifications);
  const markAllNotificationsRead = useAppStore((state) => state.markAllNotificationsRead);
  const clearNotifications = useAppStore((state) => state.clearNotifications);

  useEffect(() => {
    const timeout = window.setTimeout(markAllNotificationsRead, 500);
    return () => window.clearTimeout(timeout);
  }, [markAllNotificationsRead]);

  const openCheckIn = () => {
    navigate('/');
    window.requestAnimationFrame(() => window.dispatchEvent(new Event(CHECK_IN_FOCUS_EVENT)));
  };

  const openNotification = (kind: AppNotificationKind, universal = false) => {
    if (universal) {
      navigate('/reminders');
      return;
    }
    if (kind === 'check-in') {
      openCheckIn();
      return;
    }
    if (kind === 'task') navigate('/tasks');
    if (kind === 'event') navigate('/calendar');
  };

  return (
    <main className="shell notification-center-page">
      <header className="notification-center-header">
        <button onClick={() => navigate('/')} type="button" aria-label="Back home"><ArrowLeft size={19} /></button>
        <div><p className="section-kicker">Your gentle reminders</p><h1>Notifications</h1><p className="subtle">Recent task, event, check-in, and saved reminders.</p></div>
      </header>

      <div className="notification-center-actions">
        <button onClick={() => navigate('/reminders')} type="button"><Plus size={15} /> Manage reminders</button>
        {notifications.length > 0 && <>
          <button onClick={markAllNotificationsRead} type="button"><CheckCheck size={15} /> Mark all read</button>
          <button onClick={() => { if (window.confirm('Clear every notification from Still?')) clearNotifications(); }} type="button"><Trash2 size={15} /> Clear all</button>
        </>}
      </div>

      {notifications.length === 0 ? <section className="notification-center-empty">
        <span><Bell size={25} /></span><strong>All quiet for now</strong><p>Tasks, events, check-ins, and your own saved reminders will appear here after Still sends them.</p>
      </section> : <section className="notification-center-list" aria-label="Recent notifications">
        {notifications.map((notification) => {
          const Icon = notificationIcons[notification.kind];
          const universal = isUniversalReminder(notification);
          const actionable = universal || notification.kind !== 'system';
          const destination = universal
            ? 'Open reminders.'
            : notification.kind === 'task'
              ? 'Open tasks.'
              : notification.kind === 'event'
                ? 'Open calendar.'
                : notification.kind === 'check-in'
                  ? 'Open today’s check-in.'
                  : '';

          return <article
            className={`card notification-center-item${notification.read ? '' : ' is-unread'}${actionable ? ' is-actionable' : ''}`}
            key={notification.id}
            onClick={actionable ? () => openNotification(notification.kind, universal) : undefined}
            onKeyDown={actionable ? (event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              openNotification(notification.kind, universal);
            } : undefined}
            role={actionable ? 'button' : undefined}
            tabIndex={actionable ? 0 : undefined}
            aria-label={actionable ? `${notification.title}. ${destination}` : undefined}
          >
            <span className={`notification-kind-icon is-${notification.kind}`}><Icon size={18} /></span>
            <div><div><strong>{notification.title}</strong><time dateTime={new Date(notification.createdAt).toISOString()}>{formatNotificationTime(notification.createdAt)}</time></div><p>{notification.body}</p></div>
          </article>;
        })}
      </section>}
    </main>
  );
}
