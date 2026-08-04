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

export function QuickAddSheet() {
  const open = useAppStore((state) => state.quickAddOpen);
  const mode = useAppStore((state) => state.quickAddMode);
  const editingTaskId = useAppStore((state) => state.editingTaskId);
  const editingEventId = useAppStore((state) => state.editingEventId);
  const eventDraftDate = useAppStore((state) => state.eventDraftDate);
  const tasks = useAppStore((state) => state.tasks);
  const events = useAppStore((state) => state.events);
  const openQuickAdd = useAppStore((state) => state.openQuickAdd);
  const openTaskEditor = useAppStore((state) => state.openTaskEditor);
  const openEventEditor = useAppStore((state) => state.openEventEditor);
  const close = useAppStore((state) => state.closeQuickAdd);
  const addTask = useAppStore((state) => state.addTask);
  const updateTask = useAppStore((state) => state.updateTask);
  const addEvent = useAppStore((state) => state.addEvent);
  const updateEvent = useAppStore((state) => state.updateEvent);
  const editingTask = tasks.find((task) => task.id === editingTaskId);
  const editingEvent = events.find((event) => event.id === editingEventId);

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

  const editorTitle = mode === 'task'
    ? (editingTask ? 'Edit task' : 'Add a task')
    : mode === 'event'
      ? (editingEvent ? 'Edit event' : 'Add an event')
      : 'Add something';

  const editorSubtitle = mode === 'task'
    ? 'Make space for what matters next.'
    : mode === 'event'
      ? 'Keep the moments that shape your day close.'
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
            {mode !== 'menu' && !editingTask && !editingEvent && (
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
        ) : (
          <div className="quick-grid">
            {actions.map(([label, Icon]) => (
              <button
                className="quick-action"
                key={label}
                onClick={() => {
                  if (label === 'Task') openTaskEditor();
                  else if (label === 'Event') openEventEditor();
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
