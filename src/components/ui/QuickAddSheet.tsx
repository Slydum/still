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
  type StillTask,
  type TaskInput,
  type TaskPriority,
  type TaskRepeat,
} from '../../stores/useAppStore';

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

export function QuickAddSheet() {
  const open = useAppStore((state) => state.quickAddOpen);
  const mode = useAppStore((state) => state.quickAddMode);
  const editingTaskId = useAppStore((state) => state.editingTaskId);
  const tasks = useAppStore((state) => state.tasks);
  const openQuickAdd = useAppStore((state) => state.openQuickAdd);
  const openTaskEditor = useAppStore((state) => state.openTaskEditor);
  const close = useAppStore((state) => state.closeQuickAdd);
  const addTask = useAppStore((state) => state.addTask);
  const updateTask = useAppStore((state) => state.updateTask);
  const editingTask = tasks.find((task) => task.id === editingTaskId);

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
            {mode === 'task' && !editingTask && (
              <button className="task-back-button" onClick={openQuickAdd} aria-label="Back to quick add" type="button">
                <ChevronLeft size={20} />
              </button>
            )}
            <div>
              <h2 className="section-title" id="quick-add-title">
                {mode === 'task' ? (editingTask ? 'Edit task' : 'Add a task') : 'Add something'}
              </h2>
              <p className="subtle">
                {mode === 'task' ? 'Make space for what matters next.' : 'What would you like to remember?'}
              </p>
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
        ) : (
          <div className="quick-grid">
            {actions.map(([label, Icon]) => (
              <button
                className="quick-action"
                key={label}
                onClick={() => {
                  if (label === 'Task') openTaskEditor();
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
