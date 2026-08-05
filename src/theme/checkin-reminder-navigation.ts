import { snoozeCheckIn, CHECK_IN_SNOOZE_MINUTES } from '../features/check-ins/checkInReminder';
import { getLocalDateKey } from './stillContext';
import './checkin-reminder-navigation.css';

const CHECK_IN_QUERY_KEY = 'checkin';
const FOCUS_CLASS = 'is-reminder-focused';

function removeReminderIntent(url: URL) {
  url.searchParams.delete(CHECK_IN_QUERY_KEY);
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, '', nextUrl || '/');
}

function showSnoozeConfirmation() {
  document.querySelector('.checkin-snooze-toast')?.remove();

  const toast = document.createElement('div');
  toast.className = 'checkin-snooze-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = `We’ll check back in ${CHECK_IN_SNOOZE_MINUTES} minutes.`;
  document.body.append(toast);

  window.setTimeout(() => {
    toast.classList.add('is-leaving');
    window.setTimeout(() => toast.remove(), 240);
  }, 2600);
}

function focusCheckInCard() {
  const card = document.querySelector<HTMLElement>('.checkin-combined-card');
  if (!card) return false;

  card.scrollIntoView({
    behavior: document.documentElement.dataset.reduceMotion === 'true' ? 'auto' : 'smooth',
    block: 'center',
  });
  card.classList.remove(FOCUS_CLASS);
  void card.offsetWidth;
  card.classList.add(FOCUS_CLASS);
  window.setTimeout(() => card.classList.remove(FOCUS_CLASS), 2800);
  return true;
}

function queueCheckInFocus() {
  if (focusCheckInCard()) return;

  const observer = new MutationObserver(() => {
    if (!focusCheckInCard()) return;
    observer.disconnect();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(() => observer.disconnect(), 6000);
}

function consumeReminderIntent() {
  const url = new URL(window.location.href);
  const intent = url.searchParams.get(CHECK_IN_QUERY_KEY);
  if (!intent) return;

  removeReminderIntent(url);

  if (intent === 'snooze') {
    snoozeCheckIn(getLocalDateKey());
    window.requestAnimationFrame(showSnoozeConfirmation);
    return;
  }

  if (intent === 'now') {
    window.setTimeout(queueCheckInFocus, 80);
  }
}

if (typeof window !== 'undefined') consumeReminderIntent();
