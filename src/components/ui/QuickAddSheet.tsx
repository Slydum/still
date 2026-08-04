import {
  BookOpen,
  CalendarPlus,
  CheckSquare,
  ChevronLeft,
  HeartPulse,
  ReceiptText,
  Timer,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import {
  useAppStore,
  type EventCategory,
  type EventInput,
  type EventRepeat,
  type JournalEntry,
  type JournalInput,
  type JournalMood,
  type StillEvent,
  type StillTask,
  type TaskInput,
  type TaskPriority,
  type TaskRepeat,
} from '../../stores/useAppStore';
import { getLocalDateKey } from '../../theme/stillContext';

const actions: Array<[label: string, icon: LucideIcon]> = [
  ['Task', CheckSquare],
  ['Event', CalendarPlus],
  ['Expense', ReceiptText],
  ['Work', Timer],
  ['Check-in', HeartPulse],
  ['Journal', BookOpen],
];

const journalMoods: Array<{ value: JournalMood; emoji: string; label: string }> = [
  { value: 1, emoji: '🌧️', label: 'Heavy' },
  { value: 2, emoji: '🌫️', label: 'Low' },
  { value: 3, emoji: '🌿', label: 'Steady' },
  { value: 4, emoji: '🌤️', label: 'Good' },
  { value: 5, emoji: '✨', label: 'Bright' },
];

function TaskEditor({
  task,
  onCancel,
  onSave,
}: {
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
        <input
          autoFocus
          maxLength={120}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="What needs your attention?"
          required
          type="text"
          value={title}
        />
      </label>

      <label className="task-field">
        <span>Note <small>(optional)</small></span>
        <textarea
          maxLength={500}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Add a gentle reminder or useful detail"
          rows={3}
          value={note}
        />
      </label>

      <div className="task-form-row">
        <label className="task-field">
          <span>Due date</span>
          <input
            min="2020-01-01"
            onChange={(event) => {
              const value = event.target.value;
              setDueDate(value);
              if (!value) setRepeat('none');
            }}
            type="date"
            value={dueDate}
          />
        </label>

        <label className="task-field">
          <span>Priority</span>
          <select
            onChange={(event) => setPriority(event.target.value as TaskPriority)}
            value={priority}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
      </div>

      <label className="task-field">
        <span>Repeat</span>
        <select
          disabled={!dueDate}
          onChange={(event) => setRepeat(event.target.value as TaskRepeat)}
          value={dueDate ? repeat : 'none'}
        >
          <option value="none">Does not repeat</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        {!dueDate && <small className="task-field-hint">Choose a due date to repeat this task.</small>}
      </label>

      <div className="task-editor-actions">
        <button className="task-secondary-button" onClick={onCancel} type="button">Cancel</button>
        <button className="task-primary-button" disabled={!title.trim()} type="submit">
          {task ? 'Save changes' : 'Add task'}
        </button>
      </div>
    </form>
  );
}

function EventEditor({
  event,
  initialDate,
  onCancel,
  onSave,
}: {
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
    if (endDate < startDate) {
      setError('The event cannot end before it starts.');
      return;
    }

    if (!allDay && startDate === endDate && endTime <= startTime) {
      setError('Choose an end time after the start time.');
      return;
    }

    onSave({
      title,
      note,
      category,
      startDate,
      endDate,
      allDay,
      startTime,
      endTime,
      repeat,
    });
  };

  return (
    <form className="task-editor event-editor" onSubmit={submit}>
      <label className="task-field">
        <span>Event</span>
        <input
          autoFocus
          maxLength={120}
          onChange={(inputEvent) => setTitle(inputEvent.target.value)}
          placeholder="What’s happening?"
          required
          type="text"
          value={title}
        />
      </label>

      <div className="task-form-row">
        <label className="task-field">
          <span>Starts</span>
          <input
            onChange={(inputEvent) => {
              const value = inputEvent.target.value;
              setStartDate(value);
              if (endDate < value) setEndDate(value);
            }}
            required
            type="date"
            value={startDate}
          />
        </label>
        <label className="task-field">
          <span>Ends</span>
          <input
            min={startDate}
            onChange={(inputEvent) => setEndDate(inputEvent.target.value)}
            required
            type="date"
            value={endDate}
          />
        </label>
      </div>

      <label className="event-all-day-toggle">
        <input
          checked={allDay}
          onChange={(inputEvent) => setAllDay(inputEvent.target.checked)}
          type="checkbox"
        />
        <span>All-day event</span>
      </label>

      {!allDay && (
        <div className="task-form-row">
          <label className="task-field">
            <span>Start time</span>
            <input
              onChange={(inputEvent) => setStartTime(inputEvent.target.value)}
              required
              type="time"
              value={startTime}
            />
          </label>
          <label className="task-field">
            <span>End time</span>
            <input
              onChange={(inputEvent) => setEndTime(inputEvent.target.value)}
              required
              type="time"
              value={endTime}
            />
          </label>
        </div>
      )}

      <div className="task-form-row">
        <label className="task-field">
          <span>Category</span>
          <select
            onChange={(inputEvent) => setCategory(inputEvent.target.value as EventCategory)}
            value={category}
          >
            <option value="personal">Personal</option>
            <option value="work">Work</option>
            <option value="health">Health</option>
            <option value="love">Love</option>
            <option value="money">Money</option>
          </select>
        </label>
        <label className="task-field">
          <span>Repeat</span>
          <select
            onChange={(inputEvent) => setRepeat(inputEvent.target.value as EventRepeat)}
            value={repeat}
          >
            <option value="none">Does not repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
      </div>

      <label className="task-field">
        <span>Note <small>(optional)</small></span>
        <textarea
          maxLength={500}
          onChange={(inputEvent) => setNote(inputEvent.target.value)}
          placeholder="Location, preparation, or anything worth remembering"
          rows={3}
          value={note}
        />
      </label>

      {error && <p className="event-form-error" role="alert">{error}</p>}

      <div className="task-editor-actions">
        <button className="task-secondary-button" onClick={onCancel} type="button">Cancel</button>
        <button className="task-primary-button" disabled={!title.trim()} type="submit">
          {event ? 'Save changes' : 'Add event'}
        </button>
      </div>
    </form>
  );
}

function JournalEditor({
  entry,
  initialDate,
  onCancel,
  onSave,
}: {
  entry?: JournalEntry;
  initialDate?: string;
  onCancel: () => void;
  onSave: (input: JournalInput) => void;
}) {
  const [title, setTitle] = useState(entry?.title ?? '');
  const [body, setBody] = useState(entry?.body ?? '');
  const [entryDate, setEntryDate] = useState(entry?.entryDate ?? initialDate ?? getLocalDateKey());
  const [mood, setMood] = useState<JournalMood | undefined>(entry?.mood);
  const [tags, setTags] = useState(entry?.tags.join(', ') ?? '');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!body.trim()) return;

    onSave({
      title,
      body,
      entryDate,
      mood,
      tags: tags.split(','),
    });
  };

  return (
    <form className="task-editor journal-editor" onSubmit={submit}>
      <div className="task-form-row journal-editor-top-row">
        <label className="task-field">
          <span>Date</span>
          <input
            onChange={(event) => setEntryDate(event.target.value)}
            required
            type="date"
            value={entryDate}
          />
        </label>
        <label className="task-field">
          <span>Title <small>(optional)</small></span>
          <input
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Give this moment a name"
            type="text"
            value={title}
          />
        </label>
      </div>

      <label className="task-field">
        <span>Reflection</span>
        <textarea
          autoFocus
          maxLength={5000}
          onChange={(event) => setBody(event.target.value)}
          placeholder="What’s on your mind?"
          required
          rows={8}
          value={body}
        />
        <small className="journal-character-count">{body.length.toLocaleString()} / 5,000</small>
      </label>

      <fieldset className="journal-mood-field">
        <legend>How did this moment feel? <small>(optional)</small></legend>
        <div className="journal-mood-options">
          {journalMoods.map((option) => (
            <button
              className={mood === option.value ? 'is-selected' : ''}
              key={option.value}
              onClick={() => setMood(mood === option.value ? undefined : option.value)}
              type="button"
              aria-label={option.label}
              aria-pressed={mood === option.value}
            >
              <span>{option.emoji}</span>
              <small>{option.label}</small>
            </button>
          ))}
        </div>
      </fieldset>

      <label className="task-field">
        <span>Tags <small>(optional)</small></span>
        <input
          maxLength={160}
          onChange={(event) => setTags(event.target.value)}
          placeholder="gratitude, work, rest"
          type="text"
          value={tags}
        />
        <small className="task-field-hint">Separate tags with commas.</small>
      </label>

      <div className="task-editor-actions">
        <button className="task-secondary-button" onClick={onCancel} type="button">Cancel</button>
        <button className="task-primary-button" disabled={!body.trim()} type="submit">
          {entry ? 'Save changes' : 'Save entry'}
        </button>
      </div>
    </form>
  );
}

export function QuickAddSheet() {
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
  const openQuickAdd = useAppStore((state) => state.openQuickAdd);
  const openTaskEditor = useAppStore((state) => state.openTaskEditor);
  const openEventEditor = useAppStore((state) => state.openEventEditor);
  const openJournalEditor = useAppStore((state) => state.openJournalEditor);
  const close = useAppStore((state) => state.closeQuickAdd);
  const addTask = useAppStore((state) => state.addTask);
  const updateTask = useAppStore((state) => state.updateTask);
  const addEvent = useAppStore((state) => state.addEvent);
  const updateEvent = useAppStore((state) => state.updateEvent);
  const addJournalEntry = useAppStore((state) => state.addJournalEntry);
  const updateJournalEntry = useAppStore((state) => state.updateJournalEntry);
  const editingTask = tasks.find((task) => task.id === editingTaskId);
  const editingEvent = events.find((event) => event.id === editingEventId);
  const editingJournalEntry = journalEntries.find((entry) => entry.id === editingJournalId);

  useEffect(() => {
    if (!open) return undefined;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [close, open]);

  if (!open) return null;

  const saveTask = (input: TaskInput) => {
    if (editingTask) updateTask(editingTask.id, input);
    else addTask(input);
    close();
  };

  const saveEvent = (input: EventInput) => {
    if (editingEvent) updateEvent(editingEvent.id, input);
    else addEvent(input);
    close();
  };

  const saveJournalEntry = (input: JournalInput) => {
    if (editingJournalEntry) updateJournalEntry(editingJournalEntry.id, input);
    else addJournalEntry(input);
    close();
  };

  const editorTitle = mode === 'task'
    ? (editingTask ? 'Edit task' : 'Add a task')
    : mode === 'event'
      ? (editingEvent ? 'Edit event' : 'Add an event')
      : mode === 'journal'
        ? (editingJournalEntry ? 'Edit entry' : 'New journal entry')
      : 'Add something';

  const editorSubtitle = mode === 'task'
    ? 'Make space for what matters next.'
    : mode === 'event'
      ? 'Keep the moments that shape your day close.'
      : mode === 'journal'
        ? 'There is no right way to put this moment into words.'
      : 'What would you like to remember?';

  return (
    <div className="sheet-backdrop" onClick={close}>
      <section
        className="sheet task-sheet"
        onClick={(event) => event.stopPropagation()}
        aria-modal="true"
        role="dialog"
        aria-labelledby="quick-add-title"
      >
        <div className="sheet-handle" />
        <div className="section-head">
          <div className="task-sheet-heading">
            {mode !== 'menu' && !editingTask && !editingEvent && !editingJournalEntry && (
              <button className="task-back-button" onClick={openQuickAdd} aria-label="Back to quick add" type="button">
                <ChevronLeft size={20} />
              </button>
            )}
            <div>
              <h2 className="section-title" id="quick-add-title">
                {editorTitle}
              </h2>
              <p className="subtle">{editorSubtitle}</p>
            </div>
          </div>
          <button className="link-btn" onClick={close} aria-label="Close" type="button">
            <X />
          </button>
        </div>

        {mode === 'task' ? (
          <TaskEditor
            key={editingTask?.id ?? 'new-task'}
            task={editingTask}
            onCancel={close}
            onSave={saveTask}
          />
        ) : mode === 'event' ? (
          <EventEditor
            key={editingEvent?.id ?? `new-event-${eventDraftDate ?? 'today'}`}
            event={editingEvent}
            initialDate={eventDraftDate}
            onCancel={close}
            onSave={saveEvent}
          />
        ) : mode === 'journal' ? (
          <JournalEditor
            key={editingJournalEntry?.id ?? `new-journal-${journalDraftDate ?? 'today'}`}
            entry={editingJournalEntry}
            initialDate={journalDraftDate}
            onCancel={close}
            onSave={saveJournalEntry}
          />
        ) : (
          <div className="quick-grid">
            {actions.map(([label, Icon]) => (
              <button
                className="quick-action"
                key={label}
                onClick={() => {
                  if (label === 'Task') openTaskEditor();
                  else if (label === 'Event') openEventEditor();
                  else if (label === 'Journal') openJournalEditor();
                  else window.alert(`${label} form comes next.`);
                }}
                type="button"
              >
                <Icon size={24} />
                <div>{label}</div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
