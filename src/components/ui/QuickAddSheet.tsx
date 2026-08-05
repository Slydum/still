import {
  BookOpen,
  CalendarPlus,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  HeartPulse,
  ReceiptText,
  Sparkles,
  Timer,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useAppStore,
  type EventCategory,
  type EventInput,
  type EventRepeat,
  type JournalEntry,
  type JournalInput,
  type JournalMood,
  type ExpenseInput,
  type StillEvent,
  type StillTask,
  type TaskInput,
  type TaskPriority,
  type TaskRepeat,
} from '../../stores/useAppStore';
import {
  takePendingJournalDraftContext,
  type JournalDraftContext,
} from '../../features/journal/journalDraftContext';
import { getLocalDateKey } from '../../theme/stillContext';
import { CheckInEditor } from './quick-add/CheckInEditor';
import { ExpenseEditor } from './quick-add/ExpenseEditor';
import { journalMoods } from './quick-add/quickAddOptions';

type QuickActionLabel = 'Task' | 'Event' | 'Expense' | 'Work' | 'Check-in' | 'Journal';

const primaryActions: Array<{ label: QuickActionLabel; icon: LucideIcon; hint: string }> = [
  { label: 'Task', icon: CheckSquare, hint: 'A small next step' },
  { label: 'Event', icon: CalendarPlus, hint: 'Something on your calendar' },
  { label: 'Expense', icon: ReceiptText, hint: 'Capture spending quickly' },
  { label: 'Journal', icon: BookOpen, hint: 'Write down this moment' },
];

const secondaryActions: Array<{ label: QuickActionLabel; icon: LucideIcon }> = [
  { label: 'Work', icon: Timer },
  { label: 'Check-in', icon: HeartPulse },
];

function MoreOptions({ children, open = false }: { children: ReactNode; open?: boolean }) {
  return (
    <details className="editor-more-options" open={open}>
      <summary>
        <span>More options</span>
        <ChevronDown size={16} aria-hidden="true" />
      </summary>
      <div className="editor-more-options-content">{children}</div>
    </details>
  );
}

function TaskEditor({ task, onCancel, onSave }: {
  task?: StillTask;
  onCancel: () => void;
  onSave: (input: TaskInput) => void;
}) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [note, setNote] = useState(task?.note ?? '');
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'medium');
  const [repeat, setRepeat] = useState<TaskRepeat>(task?.repeat ?? 'none');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) return;
    onSave({ title, note, dueDate, priority, repeat });
  };

  return (
    <form className="task-editor" onSubmit={submit}>
      <label className="task-field">
        <span>Task</span>
        <input autoFocus maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="What needs your attention?" required type="text" value={title} />
      </label>

      <MoreOptions open={Boolean(task?.note || task?.dueDate || task?.repeat !== 'none' || task?.priority !== 'medium')}>
        <div className="task-form-row">
          <label className="task-field">
            <span>Due date</span>
            <input min="2020-01-01" onChange={(event) => {
              const value = event.target.value;
              setDueDate(value);
              if (!value) setRepeat('none');
            }} type="date" value={dueDate} />
          </label>
          <label className="task-field">
            <span>Priority</span>
            <select onChange={(event) => setPriority(event.target.value as TaskPriority)} value={priority}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>
        <label className="task-field">
          <span>Repeat</span>
          <select disabled={!dueDate} onChange={(event) => setRepeat(event.target.value as TaskRepeat)} value={dueDate ? repeat : 'none'}>
            <option value="none">Does not repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        <label className="task-field">
          <span>Note <small>(optional)</small></span>
          <textarea maxLength={500} onChange={(event) => setNote(event.target.value)} placeholder="A useful detail" rows={2} value={note} />
        </label>
      </MoreOptions>

      <div className="task-editor-actions">
        <button className="task-secondary-button" onClick={onCancel} type="button">Cancel</button>
        <button className="task-primary-button" disabled={!title.trim()} type="submit">{task ? 'Save changes' : 'Add task'}</button>
      </div>
    </form>
  );
}

function EventEditor({ event, initialDate, onCancel, onSave }: {
  event?: StillEvent;
  initialDate?: string;
  onCancel: () => void;
  onSave: (input: EventInput) => void;
}) {
  const defaultDate = event?.startDate ?? initialDate ?? getLocalDateKey();
  const [title, setTitle] = useState(event?.title ?? '');
  const [note, setNote] = useState(event?.note ?? '');
  const [category, setCategory] = useState<EventCategory>(event?.category ?? 'personal');
  const [startDate, setStartDate] = useState(defaultDate);
  const [endDate, setEndDate] = useState(event?.endDate ?? defaultDate);
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [startTime, setStartTime] = useState(event?.startTime ?? '09:00');
  const [endTime, setEndTime] = useState(event?.endTime ?? '10:00');
  const [repeat, setRepeat] = useState<EventRepeat>(event?.repeat ?? 'none');
  const [error, setError] = useState('');

  const submit = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    setError('');
    if (!title.trim()) return;
    if (endDate < startDate) return setError('The event cannot end before it starts.');
    if (!allDay && startDate === endDate && endTime <= startTime) return setError('Choose an end time after the start time.');
    onSave({ title, note, category, startDate, endDate, allDay, startTime, endTime, repeat });
  };

  return (
    <form className="task-editor event-editor" onSubmit={submit}>
      <label className="task-field">
        <span>Event</span>
        <input autoFocus maxLength={120} onChange={(inputEvent) => setTitle(inputEvent.target.value)} placeholder="What’s happening?" required type="text" value={title} />
      </label>

      <div className="task-form-row">
        <label className="task-field">
          <span>Date</span>
          <input onChange={(inputEvent) => {
            const value = inputEvent.target.value;
            setStartDate(value);
            if (endDate < value) setEndDate(value);
          }} required type="date" value={startDate} />
        </label>
        {!allDay && <label className="task-field">
          <span>Time</span>
          <input onChange={(inputEvent) => setStartTime(inputEvent.target.value)} required type="time" value={startTime} />
        </label>}
      </div>

      <label className="event-all-day-toggle">
        <input checked={allDay} onChange={(inputEvent) => setAllDay(inputEvent.target.checked)} type="checkbox" />
        <span>All-day event</span>
      </label>

      <MoreOptions open={Boolean(event?.note || event?.repeat !== 'none' || event?.category !== 'personal' || event?.endDate !== event?.startDate)}>
        <div className="task-form-row">
          <label className="task-field">
            <span>End date</span>
            <input min={startDate} onChange={(inputEvent) => setEndDate(inputEvent.target.value)} required type="date" value={endDate} />
          </label>
          {!allDay && <label className="task-field">
            <span>End time</span>
            <input onChange={(inputEvent) => setEndTime(inputEvent.target.value)} required type="time" value={endTime} />
          </label>}
        </div>
        <div className="task-form-row">
          <label className="task-field">
            <span>Category</span>
            <select onChange={(inputEvent) => setCategory(inputEvent.target.value as EventCategory)} value={category}>
              <option value="personal">Personal</option><option value="work">Work</option><option value="health">Health</option><option value="love">Love</option><option value="money">Money</option>
            </select>
          </label>
          <label className="task-field">
            <span>Repeat</span>
            <select onChange={(inputEvent) => setRepeat(inputEvent.target.value as EventRepeat)} value={repeat}>
              <option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
            </select>
          </label>
        </div>
        <label className="task-field">
          <span>Note <small>(optional)</small></span>
          <textarea maxLength={500} onChange={(inputEvent) => setNote(inputEvent.target.value)} placeholder="Location or anything worth remembering" rows={2} value={note} />
        </label>
      </MoreOptions>

      {error && <p className="event-form-error" role="alert">{error}</p>}
      <div className="task-editor-actions">
        <button className="task-secondary-button" onClick={onCancel} type="button">Cancel</button>
        <button className="task-primary-button" disabled={!title.trim()} type="submit">{event ? 'Save changes' : 'Add event'}</button>
      </div>
    </form>
  );
}

function JournalEditor({ entry, initialDate, draftContext, onCancel, onSave }: {
  entry?: JournalEntry;
  initialDate?: string;
  draftContext?: JournalDraftContext;
  onCancel: () => void;
  onSave: (input: JournalInput) => void;
}) {
  const entryHasCheckInTag = entry?.tags.includes('check-in') ?? false;
  const [title, setTitle] = useState(entry?.title ?? '');
  const [body, setBody] = useState(entry?.body ?? '');
  const [entryDate, setEntryDate] = useState(entry?.entryDate ?? initialDate ?? getLocalDateKey());
  const [mood, setMood] = useState<JournalMood | undefined>(entry?.mood ?? draftContext?.suggestedMood);
  const [tags, setTags] = useState(entry?.tags.filter((tag) => tag !== 'check-in').join(', ') ?? '');
  const [includeCheckInTag, setIncludeCheckInTag] = useState(entryHasCheckInTag || Boolean(draftContext));
  const suggestedMood = journalMoods.find((option) => option.value === draftContext?.suggestedMood);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!body.trim()) return;
    const nextTags = tags.split(',');
    if (includeCheckInTag) nextTags.push('check-in');
    onSave({ title, body, entryDate, mood, tags: nextTags });
  };

  return (
    <form className="task-editor journal-editor" onSubmit={submit}>
      {!entry && draftContext && (
        <aside className="journal-checkin-context" aria-labelledby="journal-checkin-context-title">
          <div className="journal-checkin-context-label" id="journal-checkin-context-title">
            <HeartPulse size={15} />
            From your check-in
          </div>
          <blockquote>{draftContext.answer}</blockquote>
          <p>{draftContext.prompt}</p>
        </aside>
      )}

      <label className="task-field compact-date-field">
        <span>Date</span>
        <input onChange={(event) => setEntryDate(event.target.value)} required type="date" value={entryDate} />
      </label>
      <label className="task-field">
        <span>Reflection</span>
        <textarea
          autoFocus
          maxLength={5000}
          onChange={(event) => setBody(event.target.value)}
          placeholder={draftContext?.prompt ?? 'What’s on your mind?'}
          required
          rows={6}
          value={body}
        />
        <small className="journal-character-count">{body.length.toLocaleString()} / 5,000</small>
      </label>

      {!entry && draftContext && (
        <div className="journal-checkin-carryover">
          {suggestedMood && (
            <span className="journal-checkin-suggested-mood">
              <span aria-hidden="true">{suggestedMood.emoji}</span>
              Mood carried over: {suggestedMood.label}
            </span>
          )}
          <label>
            <input
              checked={includeCheckInTag}
              onChange={(event) => setIncludeCheckInTag(event.target.checked)}
              type="checkbox"
            />
            Link this reflection to the check-in
          </label>
        </div>
      )}

      <MoreOptions open={Boolean(entry?.title || entry?.mood || entry?.tags.length)}>
        <label className="task-field">
          <span>Title <small>(optional)</small></span>
          <input maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="Give this moment a name" type="text" value={title} />
        </label>
        <fieldset className="journal-mood-field">
          <legend>How did this moment feel?</legend>
          <div className="journal-mood-options">
            {journalMoods.map((option) => (
              <button className={mood === option.value ? 'is-selected' : ''} key={option.value} onClick={() => setMood(mood === option.value ? undefined : option.value)} type="button" aria-label={option.label} aria-pressed={mood === option.value}>
                <span>{option.emoji}</span><small>{option.label}</small>
              </button>
            ))}
          </div>
        </fieldset>
        <label className="task-field">
          <span>Tags <small>(optional)</small></span>
          <input maxLength={160} onChange={(event) => setTags(event.target.value)} placeholder="gratitude, work, rest" type="text" value={tags} />
        </label>
        {entry && entryHasCheckInTag && (
          <label className="journal-checkin-tag-option">
            <input
              checked={includeCheckInTag}
              onChange={(event) => setIncludeCheckInTag(event.target.checked)}
              type="checkbox"
            />
            Keep linked to its check-in
          </label>
        )}
      </MoreOptions>

      <div className="task-editor-actions">
        <button className="task-secondary-button" onClick={onCancel} type="button">Cancel</button>
        <button className="task-primary-button" disabled={!body.trim()} type="submit">{entry ? 'Save changes' : 'Save entry'}</button>
      </div>
    </form>
  );
}

export function QuickAddSheet() {
  const navigate = useNavigate();
  const open = useAppStore((state) => state.quickAddOpen);
  const mode = useAppStore((state) => state.quickAddMode);
  const editingTaskId = useAppStore((state) => state.editingTaskId);
  const editingEventId = useAppStore((state) => state.editingEventId);
  const editingJournalId = useAppStore((state) => state.editingJournalId);
  const eventDraftDate = useAppStore((state) => state.eventDraftDate);
  const journalDraftDate = useAppStore((state) => state.journalDraftDate);
  const tasks = useAppStore((state) => state.tasks);
  const events = useAppStore((state) => state.events);
  const journalEntries = useAppStore((state) => state.journalEntries);
  const currentMood = useAppStore((state) => state.mood);
  const currentEnergy = useAppStore((state) => state.energy);
  const replaceTodayCheckIn = useAppStore((state) => state.replaceTodayCheckIn);
  const expenseCurrency = useAppStore((state) => state.workProfile.currency);
  const openQuickAdd = useAppStore((state) => state.openQuickAdd);
  const openTaskEditor = useAppStore((state) => state.openTaskEditor);
  const openEventEditor = useAppStore((state) => state.openEventEditor);
  const openJournalEditor = useAppStore((state) => state.openJournalEditor);
  const close = useAppStore((state) => state.closeQuickAdd);
  const addTask = useAppStore((state) => state.addTask);
  const addExpense = useAppStore((state) => state.addExpense);
  const updateTask = useAppStore((state) => state.updateTask);
  const addEvent = useAppStore((state) => state.addEvent);
  const updateEvent = useAppStore((state) => state.updateEvent);
  const addJournalEntry = useAppStore((state) => state.addJournalEntry);
  const updateJournalEntry = useAppStore((state) => state.updateJournalEntry);
  const editingTask = tasks.find((task) => task.id === editingTaskId);
  const editingEvent = events.find((event) => event.id === editingEventId);
  const editingJournalEntry = journalEntries.find((entry) => entry.id === editingJournalId);
  const [journalDraftContext, setJournalDraftContext] = useState<JournalDraftContext>();
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!open || mode !== 'journal' || editingJournalId) {
      setJournalDraftContext(undefined);
      return;
    }

    setJournalDraftContext(takePendingJournalDraftContext());
  }, [editingJournalId, journalDraftDate, mode, open]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [close, open]);

  const toastElement = toast ? (
    <div className="still-toast is-visible" role="status" aria-live="polite">
      <Sparkles size={16} aria-hidden="true" />
      {toast}
    </div>
  ) : null;

  if (!open) return toastElement;

  const saveTask = (input: TaskInput) => { editingTask ? updateTask(editingTask.id, input) : addTask(input); close(); };
  const saveEvent = (input: EventInput) => { editingEvent ? updateEvent(editingEvent.id, input) : addEvent(input); close(); };
  const saveJournalEntry = (input: JournalInput) => {
    editingJournalEntry ? updateJournalEntry(editingJournalEntry.id, input) : addJournalEntry(input);
    setToast(journalDraftContext && !editingJournalEntry
      ? 'You made space for this feeling.'
      : 'Your reflection is saved.');
    setJournalDraftContext(undefined);
    close();
  };
  const saveExpense = (input: ExpenseInput) => { addExpense(input); close(); };
  const saveCheckIn = (mood?: number, energy?: number) => { replaceTodayCheckIn(mood, energy); close(); };
  const openWork = () => { close(); navigate('/work'); };

  const actionHandlers: Record<QuickActionLabel, () => void> = {
    Task: openTaskEditor,
    Event: openEventEditor,
    Expense: () => openQuickAdd('expense'),
    Work: openWork,
    'Check-in': () => openQuickAdd('check-in'),
    Journal: openJournalEditor,
  };

  const editorTitle = mode === 'task' ? (editingTask ? 'Edit task' : 'Add a task') : mode === 'event' ? (editingEvent ? 'Edit event' : 'Add an event') : mode === 'journal' ? (editingJournalEntry ? 'Edit entry' : 'New journal entry') : mode === 'expense' ? 'Add an expense' : mode === 'check-in' ? 'Quick check-in' : 'Add something';
  const editorSubtitle = mode === 'task' ? 'Start with the one thing that matters.' : mode === 'event' ? 'Add the essentials. Details can wait.' : mode === 'journal' ? (journalDraftContext ? 'Write what this feeling needs to say.' : 'A few honest words are enough.') : mode === 'expense' ? 'Capture the important part first.' : mode === 'check-in' ? 'Notice how you are.' : 'Choose what you want to capture.';

  return (
    <>
      <div className="sheet-backdrop" onClick={close}>
        <section className="sheet task-sheet" onClick={(event) => event.stopPropagation()} aria-modal="true" role="dialog" aria-labelledby="quick-add-title">
          <div className="sheet-handle" />
          <div className="section-head">
            <div className="task-sheet-heading">
              {mode !== 'menu' && !editingTask && !editingEvent && !editingJournalEntry && (
                <button className="task-back-button" onClick={() => openQuickAdd()} aria-label="Back to quick add" type="button"><ChevronLeft size={20} /></button>
              )}
              <div><h2 className="section-title" id="quick-add-title">{editorTitle}</h2><p className="subtle">{editorSubtitle}</p></div>
            </div>
            <button className="link-btn" onClick={close} aria-label="Close" type="button"><X /></button>
          </div>

          {mode === 'task' ? <TaskEditor key={editingTask?.id ?? 'new-task'} task={editingTask} onCancel={close} onSave={saveTask} />
            : mode === 'event' ? <EventEditor key={editingEvent?.id ?? `new-event-${eventDraftDate ?? 'today'}`} event={editingEvent} initialDate={eventDraftDate} onCancel={close} onSave={saveEvent} />
            : mode === 'journal' ? <JournalEditor key={editingJournalEntry?.id ?? `new-journal-${journalDraftDate ?? 'today'}-${journalDraftContext?.answer ?? 'plain'}`} entry={editingJournalEntry} initialDate={journalDraftDate} draftContext={journalDraftContext} onCancel={close} onSave={saveJournalEntry} />
            : mode === 'expense' ? <ExpenseEditor currency={expenseCurrency} onCancel={close} onSave={saveExpense} />
            : mode === 'check-in' ? <CheckInEditor currentEnergy={currentEnergy} currentMood={currentMood} onCancel={close} onSave={saveCheckIn} />
            : <>
                <div className="quick-grid quick-grid-primary">
                  {primaryActions.map(({ label, icon: Icon, hint }) => (
                    <button className="quick-action quick-action-primary" key={label} onClick={actionHandlers[label]} type="button">
                      <Icon size={22} /><span><strong>{label}</strong><small>{hint}</small></span>
                    </button>
                  ))}
                </div>
                <div className="quick-secondary-row">
                  {secondaryActions.map(({ label, icon: Icon }) => (
                    <button key={label} onClick={actionHandlers[label]} type="button"><Icon size={17} />{label}</button>
                  ))}
                </div>
              </>}
        </section>
      </div>
      {toastElement}
    </>
  );
}
