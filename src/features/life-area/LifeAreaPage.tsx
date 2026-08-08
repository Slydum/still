import { format } from 'date-fns';
import {
  ArrowLeft,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  CheckSquare,
  Heart,
  HeartPulse,
  ReceiptText,
  WalletCards,
} from 'lucide-react';
import { useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useBackNavigation } from '../../components/navigation/useBackNavigation';
import { LIFE_AREAS, isLifeAreaId, type LifeAreaId } from '../../domain/lifeAreas';
import { recordsForLifeArea } from '../../domain/lifeAreaRecords';
import { useAppStore } from '../../stores/useAppStore';
import './life-area.css';

const areaIcons = {
  work: BriefcaseBusiness,
  love: Heart,
  health: HeartPulse,
  money: WalletCards,
} as const;

function dateLabel(date: string) {
  return format(new Date(`${date}T12:00:00`), 'MMM d, yyyy');
}

function shiftLabel(startedAt: number, endedAt?: number) {
  const start = new Date(startedAt);
  if (!endedAt) return `${format(start, 'MMM d')} · In progress`;
  return `${format(start, 'MMM d')} · ${format(start, 'h:mm a')}–${format(new Date(endedAt), 'h:mm a')}`;
}

function sectionTitle(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function LifeAreaPage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/');
  const { areaId: routeAreaId } = useParams();
  const tasks = useAppStore((state) => state.tasks);
  const events = useAppStore((state) => state.events);
  const journalEntries = useAppStore((state) => state.journalEntries);
  const expenses = useAppStore((state) => state.expenses);
  const workShifts = useAppStore((state) => state.workShifts);
  const openTaskEditor = useAppStore((state) => state.openTaskEditor);
  const openEventEditor = useAppStore((state) => state.openEventEditor);
  const openJournalEditor = useAppStore((state) => state.openJournalEditor);
  const openQuickAdd = useAppStore((state) => state.openQuickAdd);

  const areaId: LifeAreaId | undefined = isLifeAreaId(routeAreaId) ? routeAreaId : undefined;
  const records = useMemo(() => areaId ? recordsForLifeArea(areaId, {
    tasks, events, journalEntries, expenses, workShifts,
  }) : undefined, [areaId, events, expenses, journalEntries, tasks, workShifts]);

  if (!areaId || !records) return <Navigate to="/" replace />;

  const definition = LIFE_AREAS[areaId];
  const AreaIcon = areaIcons[areaId];
  const total = records.tasks.length + records.events.length + records.journalEntries.length + records.expenses.length + records.workShifts.length;
  const sortedTasks = [...records.tasks].sort((a, b) => a.completed !== b.completed ? (a.completed ? 1 : -1) : (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31') || b.updatedAt - a.updatedAt);
  const sortedEvents = [...records.events].sort((a, b) => a.startDate.localeCompare(b.startDate) || (a.startTime ?? '').localeCompare(b.startTime ?? ''));
  const sortedJournals = [...records.journalEntries].sort((a, b) => b.entryDate.localeCompare(a.entryDate) || b.updatedAt - a.updatedAt);
  const sortedExpenses = [...records.expenses].sort((a, b) => b.expenseDate.localeCompare(a.expenseDate) || b.updatedAt - a.updatedAt);
  const sortedShifts = [...records.workShifts].sort((a, b) => b.startedAt - a.startedAt);

  return (
    <main className={`shell life-area-page life-area-${areaId} ${total === 0 ? 'is-empty' : ''}`}>
      <header className="life-area-header">
        <button className="btn-icon" onClick={goBack} type="button" aria-label="Go back"><ArrowLeft size={20} /></button>
        <div className="life-area-heading">
          <span className="life-area-icon" aria-hidden="true"><AreaIcon size={22} /></span>
          <div><p className="section-kicker">Life area</p><h1>{definition.label}</h1><p className="subtle">{definition.description}</p></div>
        </div>
      </header>

      <section className="card life-area-summary" aria-label={`${definition.label} summary`}>
        <div><strong>{total}</strong><span>{total === 1 ? 'connected record' : 'connected records'}</span></div>
        {total > 0 && <p>Only records you explicitly connect appear here. Still does not guess what belongs in your life areas.</p>}
        {(areaId === 'work' || areaId === 'money') && (
          <button className="btn btn-secondary btn-compact" onClick={() => navigate(areaId === 'work' ? '/work' : '/money')} type="button">
            Open {areaId === 'work' ? 'work tracker' : 'spending tracker'}
          </button>
        )}
      </section>

      <section className="life-area-capture" aria-label={`Add to ${definition.label}`}>
        <button onClick={() => openTaskEditor()} type="button"><CheckSquare size={17} /><span>Add task</span></button>
        <button onClick={() => openEventEditor()} type="button"><CalendarDays size={17} /><span>Add event</span></button>
        <button onClick={() => openJournalEditor()} type="button"><BookOpen size={17} /><span>Add reflection</span></button>
        {areaId === 'money' && <button onClick={() => openQuickAdd('expense')} type="button"><ReceiptText size={17} /><span>Add expense</span></button>}
      </section>

      {total === 0 ? (
        <section className="card life-area-empty">
          <AreaIcon size={28} />
          <h2>Nothing connected yet</h2>
          <p>Choose {definition.label} as the Life Area on a task, event, or reflection and it will appear here.</p>
        </section>
      ) : (
        <div className="life-area-record-sections">
          {sortedTasks.length > 0 && <section className="life-area-record-section"><div className="life-area-section-heading"><CheckSquare size={18} /><h2>{sectionTitle(sortedTasks.length, 'task')}</h2></div><div className="life-area-record-list">{sortedTasks.map((task) => <button className="card life-area-record" key={task.id} onClick={() => openTaskEditor(task.id)} type="button"><span className={`life-area-record-state ${task.completed ? 'is-complete' : ''}`}>{task.completed ? '✓' : ''}</span><span><strong>{task.title}</strong><small>{task.dueDate ? `Due ${dateLabel(task.dueDate)}` : 'No due date'} · {task.priority} priority</small></span></button>)}</div></section>}
          {sortedEvents.length > 0 && <section className="life-area-record-section"><div className="life-area-section-heading"><CalendarDays size={18} /><h2>{sectionTitle(sortedEvents.length, 'event')}</h2></div><div className="life-area-record-list">{sortedEvents.map((event) => <button className="card life-area-record" key={event.id} onClick={() => openEventEditor(event.id)} type="button"><CalendarDays size={18} /><span><strong>{event.title}</strong><small>{dateLabel(event.startDate)}{event.allDay ? ' · All day' : event.startTime ? ` · ${event.startTime}` : ''}</small></span></button>)}</div></section>}
          {sortedJournals.length > 0 && <section className="life-area-record-section"><div className="life-area-section-heading"><BookOpen size={18} /><h2>{sectionTitle(sortedJournals.length, 'reflection')}</h2></div><div className="life-area-record-list">{sortedJournals.map((entry) => <button className="card life-area-record" key={entry.id} onClick={() => openJournalEditor(entry.id)} type="button"><BookOpen size={18} /><span><strong>{entry.title || entry.body.slice(0, 72) || 'Reflection'}</strong><small>{dateLabel(entry.entryDate)}</small></span></button>)}</div></section>}
          {sortedExpenses.length > 0 && <section className="life-area-record-section"><div className="life-area-section-heading"><ReceiptText size={18} /><h2>{sectionTitle(sortedExpenses.length, 'expense')}</h2></div><div className="life-area-record-list">{sortedExpenses.map((expense) => <button className="card life-area-record" key={expense.id} onClick={() => navigate('/money')} type="button" aria-label={`Open spending tracker for ${expense.title}`}><ReceiptText size={18} /><span><strong>{expense.title}</strong><small>{dateLabel(expense.expenseDate)}{expense.amount !== undefined ? ` · ${new Intl.NumberFormat(undefined, { style: 'currency', currency: expense.currency }).format(expense.amount)}` : ''}</small></span></button>)}</div></section>}
          {sortedShifts.length > 0 && <section className="life-area-record-section"><div className="life-area-section-heading"><BriefcaseBusiness size={18} /><h2>{sectionTitle(sortedShifts.length, 'shift')}</h2></div><div className="life-area-record-list">{sortedShifts.map((shift) => <button className="card life-area-record" key={shift.id} onClick={() => navigate('/work')} type="button" aria-label="Open work tracker for this shift"><BriefcaseBusiness size={18} /><span><strong>{shift.endedAt ? 'Work shift' : 'Active work shift'}</strong><small>{shiftLabel(shift.startedAt, shift.endedAt)}</small></span></button>)}</div></section>}
        </div>
      )}
    </main>
  );
}
