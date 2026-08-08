import { format } from 'date-fns';
import { ArrowLeft, CalendarDays, CheckSquare, Pencil, Plus, Repeat2, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useBackNavigation } from '../../components/navigation/useBackNavigation';
import { LIFE_AREAS } from '../../domain/lifeAreas';
import { useAppStore, type StillTask } from '../../stores/useAppStore';
import { getLocalDateKey } from '../../theme/stillContext';
import './tasks.css';

type TaskFilter = 'open' | 'completed' | 'all';

const priorityRank = { high: 0, medium: 1, low: 2 } as const;

function dueLabel(dueDate: string, today: string) {
  if (dueDate === today) return 'Today';
  return format(new Date(`${dueDate}T12:00:00`), 'MMM d, yyyy');
}

function sortTasks(tasks: StillTask[]) {
  return [...tasks].sort((left, right) => {
    if (left.completed !== right.completed) return left.completed ? 1 : -1;
    if (left.completed && right.completed) {
      return (right.completedAt ?? right.updatedAt) - (left.completedAt ?? left.updatedAt);
    }
    const leftDue = left.dueDate ?? '9999-12-31';
    const rightDue = right.dueDate ?? '9999-12-31';
    if (leftDue !== rightDue) return leftDue.localeCompare(rightDue);
    const priorityDifference = priorityRank[left.priority] - priorityRank[right.priority];
    if (priorityDifference !== 0) return priorityDifference;
    return left.createdAt - right.createdAt;
  });
}

export function TasksPage() {
  const goBack = useBackNavigation('/');
  const tasks = useAppStore((state) => state.tasks);
  const openTaskEditor = useAppStore((state) => state.openTaskEditor);
  const toggleTask = useAppStore((state) => state.toggleTask);
  const deleteTask = useAppStore((state) => state.deleteTask);
  const [filter, setFilter] = useState<TaskFilter>('open');
  const today = getLocalDateKey();

  const openCount = tasks.filter((task) => !task.completed).length;
  const completedCount = tasks.length - openCount;
  const visibleTasks = useMemo(() => {
    const selected = filter === 'open'
      ? tasks.filter((task) => !task.completed)
      : filter === 'completed'
        ? tasks.filter((task) => task.completed)
        : tasks;
    return sortTasks(selected);
  }, [filter, tasks]);

  const remove = (task: StillTask) => {
    if (!window.confirm(`Delete “${task.title}”?`)) return;
    deleteTask(task.id);
  };

  const emptyCopy = filter === 'open'
    ? { title: 'Nothing waiting for you', body: completedCount ? 'Your open list is clear.' : 'Add one small next step when you need it.' }
    : filter === 'completed'
      ? { title: 'No completed tasks yet', body: 'Finished tasks will stay here so you can look back without crowding Home.' }
      : { title: 'No tasks yet', body: 'Add your first task to start a simple list.' };

  return (
    <main className="shell tasks-page">
      <header className="tasks-page-header">
        <button className="btn-icon" onClick={goBack} type="button" aria-label="Go back"><ArrowLeft size={20} /></button>
        <div className="tasks-page-heading">
          <div><p className="section-kicker">Your list</p><h1>Tasks</h1><p className="subtle">A complete view of what is open, finished, and still worth keeping.</p></div>
          <button className="btn btn-secondary btn-compact" onClick={() => openTaskEditor()} type="button"><Plus size={16} /> Add task</button>
        </div>
      </header>

      <section className="tasks-summary" aria-label="Task summary">
        <div><strong>{openCount}</strong><span>open</span></div>
        <div><strong>{completedCount}</strong><span>completed</span></div>
        <div><strong>{tasks.length}</strong><span>total</span></div>
      </section>

      <div className="tasks-filter" role="group" aria-label="Filter tasks">
        {(['open', 'completed', 'all'] as TaskFilter[]).map((value) => (
          <button
            className={filter === value ? 'is-active' : ''}
            key={value}
            onClick={() => setFilter(value)}
            type="button"
            aria-pressed={filter === value}
          >
            {value === 'open' ? 'Open' : value === 'completed' ? 'Completed' : 'All'}
          </button>
        ))}
      </div>

      {visibleTasks.length === 0 ? (
        <section className="card tasks-empty">
          <CheckSquare size={28} />
          <h2>{emptyCopy.title}</h2>
          <p>{emptyCopy.body}</p>
          {filter !== 'completed' && <button className="btn btn-secondary btn-compact" onClick={() => openTaskEditor()} type="button"><Plus size={16} /> Add task</button>}
        </section>
      ) : (
        <section className="tasks-list" aria-label={`${filter} tasks`}>
          {visibleTasks.map((task) => {
            const overdue = Boolean(task.dueDate && task.dueDate < today && !task.completed);
            const area = task.areaId ? LIFE_AREAS[task.areaId] : undefined;
            return (
              <article className={`card tasks-record ${task.completed ? 'is-complete' : ''}`} key={task.id}>
                <button
                  className={`checkbox ${task.completed ? 'done' : ''}`}
                  onClick={() => toggleTask(task.id)}
                  type="button"
                  aria-label={`${task.completed ? 'Mark incomplete' : 'Complete'} ${task.title}`}
                  aria-pressed={task.completed}
                >
                  {task.completed ? '✓' : ''}
                </button>
                <div className="tasks-record-copy">
                  <strong>{task.title}</strong>
                  {task.note && <p>{task.note}</p>}
                  <div className="tasks-record-meta">
                    <span className={`task-priority task-priority-${task.priority}`}>{task.priority}</span>
                    {area && <span>{area.label}</span>}
                    {task.dueDate && <span className={overdue ? 'task-overdue' : ''}><CalendarDays size={13} />{overdue ? 'Overdue · ' : ''}{dueLabel(task.dueDate, today)}</span>}
                    {task.repeat !== 'none' && <span><Repeat2 size={13} />{task.repeat}</span>}
                  </div>
                </div>
                <div className="tasks-record-actions">
                  <button className="btn-icon" onClick={() => openTaskEditor(task.id)} type="button" aria-label={`Edit ${task.title}`}><Pencil size={16} /></button>
                  <button className="btn-icon" onClick={() => remove(task)} type="button" aria-label={`Delete ${task.title}`}><Trash2 size={16} /></button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
