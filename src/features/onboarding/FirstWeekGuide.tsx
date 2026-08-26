import { ArrowRight, CalendarPlus, CircleCheck, ListPlus, NotebookPen, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isAttachmentEntry } from '../../domain/attachments';
import { isGoalEntry } from '../../domain/goals';
import { isReminderEntry } from '../../domain/reminders';
import { useAppStore } from '../../stores/useAppStore';
import { getLocalDateKey } from '../../theme/stillContext';
import './first-week-guide.css';

const GUIDE_KEY = 'still-first-week-guide-v1';
const DAY_MS = 24 * 60 * 60 * 1000;

type GuideState = { firstSeen: number; dismissed: boolean; checkInDone: boolean };

type GuideStep = {
  id: 'check-in' | 'task' | 'event' | 'journal';
  title: string;
  detail: string;
  day: number;
  done: boolean;
  icon: typeof Sparkles;
  action: () => void;
};

function readGuideState(): GuideState | undefined {
  try {
    const raw = window.localStorage.getItem(GUIDE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<GuideState>;
    return {
      firstSeen: typeof parsed.firstSeen === 'number' ? parsed.firstSeen : Date.now(),
      dismissed: parsed.dismissed === true,
      checkInDone: parsed.checkInDone === true,
    };
  } catch {
    return undefined;
  }
}

function writeGuideState(state: GuideState) {
  window.localStorage.setItem(GUIDE_KEY, JSON.stringify(state));
}

function isOrdinaryJournal(tags: string[]) {
  return !tags.includes('love-person') && !tags.includes('love-checkin') && !tags.includes('health-note');
}

export function FirstWeekGuide() {
  const { pathname } = useLocation();
  const tasks = useAppStore((state) => state.tasks);
  const events = useAppStore((state) => state.events);
  const journalEntries = useAppStore((state) => state.journalEntries);
  const expenses = useAppStore((state) => state.expenses);
  const workShifts = useAppStore((state) => state.workShifts);
  const checkInDate = useAppStore((state) => state.checkInDate);
  const openQuickAdd = useAppStore((state) => state.openQuickAdd);
  const openTaskEditor = useAppStore((state) => state.openTaskEditor);
  const openEventEditor = useAppStore((state) => state.openEventEditor);
  const openJournalEditor = useAppStore((state) => state.openJournalEditor);
  const [guide, setGuide] = useState<GuideState>(() => readGuideState() ?? { firstSeen: Date.now(), dismissed: false, checkInDone: false });

  const ordinaryJournalCount = useMemo(() => journalEntries.filter((entry) =>
    isOrdinaryJournal(entry.tags) && !isGoalEntry(entry) && !isReminderEntry(entry) && !isAttachmentEntry(entry)).length, [journalEntries]);
  const establishedRecordCount = tasks.length + events.length + ordinaryJournalCount + expenses.length + workShifts.length;

  useEffect(() => {
    const existing = readGuideState();
    if (!existing && establishedRecordCount >= 6) {
      const completed = { firstSeen: Date.now(), dismissed: true, checkInDone: true };
      writeGuideState(completed);
      setGuide(completed);
      return;
    }
    writeGuideState(guide);
  }, [establishedRecordCount, guide]);

  useEffect(() => {
    if (!checkInDate || guide.checkInDone) return;
    setGuide((current) => ({ ...current, checkInDone: true }));
  }, [checkInDate, guide.checkInDone]);

  const elapsedDay = Math.max(0, Math.floor((Date.now() - guide.firstSeen) / DAY_MS));
  const steps = useMemo<GuideStep[]>(() => [
    { id: 'check-in', title: 'Start with a check-in', detail: 'Give Still one small signal about how today feels.', day: 0, done: guide.checkInDone, icon: Sparkles, action: () => openQuickAdd('check-in') },
    { id: 'task', title: 'Keep one thing from slipping', detail: 'Add a task you actually want to remember, not a fake onboarding chore.', day: 0, done: tasks.length > 0, icon: ListPlus, action: () => openTaskEditor() },
    { id: 'event', title: 'Put something on your calendar', detail: 'Tomorrow, a plan or appointment gives Still something useful to bring back.', day: 1, done: events.length > 0, icon: CalendarPlus, action: () => openEventEditor(undefined, getLocalDateKey()) },
    { id: 'journal', title: 'Leave one note for future you', detail: 'A short reflection is enough. Still can become useful without becoming homework.', day: 2, done: ordinaryJournalCount > 0, icon: NotebookPen, action: () => openJournalEditor(undefined, getLocalDateKey()) },
  ], [events.length, guide.checkInDone, openEventEditor, openJournalEditor, openQuickAdd, openTaskEditor, ordinaryJournalCount, tasks.length]);

  const available = steps.filter((step) => step.day <= elapsedDay);
  const current = available.find((step) => !step.done) ?? steps.find((step) => !step.done);
  const completed = steps.filter((step) => step.done).length;

  if (pathname !== '/' || guide.dismissed || establishedRecordCount >= 6 || !current) return null;

  const Icon = current.icon;
  return (
    <aside className="first-week-guide" aria-labelledby="first-week-guide-title">
      <div className="first-week-guide-icon" aria-hidden="true"><Icon size={18} /></div>
      <div className="first-week-guide-copy">
        <div className="first-week-guide-meta"><span>This week in Still</span><small>{completed}/{steps.length} familiar</small></div>
        <strong id="first-week-guide-title">{current.title}</strong>
        <p>{current.detail}</p>
        <div className="first-week-guide-progress" aria-label={`${completed} of ${steps.length} introduction steps complete`}>
          {steps.map((step) => <i className={step.done ? 'is-done' : step.id === current.id ? 'is-current' : ''} key={step.id}>{step.done && <CircleCheck size={12} />}</i>)}
        </div>
      </div>
      <button className="first-week-guide-action" onClick={current.action} type="button">Try it <ArrowRight size={15} /></button>
      <button className="first-week-guide-dismiss" onClick={() => setGuide((state) => ({ ...state, dismissed: true }))} type="button" aria-label="Dismiss first-week guide"><X size={16} /></button>
    </aside>
  );
}
