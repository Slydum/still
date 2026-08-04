import { ArrowLeft, Bell, CalendarClock, CheckCheck, CircleCheckBig, Sparkles, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore, type AppNotificationKind } from '../../stores/useAppStore';

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

export function NotificationsPage() {
  const navigate = useNavigate();
  const notifications = useAppStore((state) => state.notifications);
  const markAllNotificationsRead = useAppStore((state) => state.markAllNotificationsRead);
  const clearNotifications = useAppStore((state) => state.clearNotifications);

  useEffect(() => {
    const timeout = window.setTimeout(markAllNotificationsRead, 500);
    return () => window.clearTimeout(timeout);
  }, [markAllNotificationsRead]);

  return (
    <main className="shell notification-center-page">
      <header className="notification-center-header">
        <button onClick={() => navigate('/')} type="button" aria-label="Back to Life"><ArrowLeft size={19} /></button>
        <div><p className="section-kicker">Your gentle reminders</p><h1>Notifications</h1><p className="subtle">Recent reminders from tasks, events, and daily check-ins.</p></div>
      </header>

      {notifications.length > 0 && <div className="notification-center-actions">
        <button onClick={markAllNotificationsRead} type="button"><CheckCheck size={15} /> Mark all read</button>
        <button onClick={() => { if (window.confirm('Clear every notification from Still?')) clearNotifications(); }} type="button"><Trash2 size={15} /> Clear all</button>
      </div>}

      {notifications.length === 0 ? <section className="notification-center-empty">
        <span><Bell size={25} /></span><strong>All quiet for now</strong><p>Task, event, and check-in reminders will appear here after Still sends them.</p>
      </section> : <section className="notification-center-list" aria-label="Recent notifications">
        {notifications.map((notification) => {
          const Icon = notificationIcons[notification.kind];
          return <article className={`card notification-center-item${notification.read ? '' : ' is-unread'}`} key={notification.id}>
            <span className={`notification-kind-icon is-${notification.kind}`}><Icon size={18} /></span>
            <div><div><strong>{notification.title}</strong><time dateTime={new Date(notification.createdAt).toISOString()}>{formatNotificationTime(notification.createdAt)}</time></div><p>{notification.body}</p></div>
          </article>;
        })}
      </section>}
    </main>
  );
}
