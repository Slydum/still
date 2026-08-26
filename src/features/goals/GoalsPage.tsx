import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDot,
  Heart,
  HeartPulse,
  Link2,
  NotebookPen,
  Pencil,
  Plus,
  ReceiptText,
  Sparkles,
  SquareCheckBig,
  Trash2,
  Unlink,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../../components/navigation/useBackNavigation';
import {
  goalConnections,
  goalFromEntry,
  goalJournalInput,
  goalRef,
  isGoalEntry,
  type GoalDraft,
  type GoalRecord,
} from '../../domain/goals';
import { LIFE_AREAS, type LifeAreaId, type LifeEntityKind, type LifeEntityRef } from '../../domain/lifeAreas';
import { useAppStore } from '../../stores/useAppStore';
import { getLocalDateKey } from '../../theme/stillContext';
import './goals.css';

type ConnectionCandidate = {
  ref: LifeEntityRef;
  title: string;
  detail: string;
  date?: string;
  icon: LucideIcon;
  open: () => void;
};

type GoalFormState = {
  id?: string;
  title: string;
  description: string;
  targetDate: string;
  areaId: LifeAreaId | '';
};

const emptyForm = (): GoalFormState => ({ title: '', description: '', targetDate: '', areaId: '' });

const kindLabels: Partial<Record<LifeEntityKind, string>> = {
  task: 'Task',
  event: 'Calendar',
  journal: 'Journal',
  transaction: 'Money',
  person: 'Love',
  shift: 'Work',
};

function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function dayKey(timestamp: number) {
  const date = new Date(timestamp);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function GoalForm({ form, onChange, onCancel, onSave }: {
  form: GoalFormState;
  onChange: (next: GoalFormState) => void;
  onCancel: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="card goal-form" onSubmit={onSave}>
      <div className="goal-form-head">
        <div><p className="section-kicker">{form.id ? 'Edit goal' : 'New goal'}</p><h2>{form.id ? 'Keep it true to where you are.' : 'What are you moving toward?'}</h2></div>
        <button type="button" onClick={onCancel} aria-label="Close goal editor"><X size={18} /></button>
      </div>
      <label><span>Goal</span><input autoFocus maxLength={120} required value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} placeholder="Finish my certification" /></label>
      <label><span>Why it matters <small>(optional)</small></span><textarea rows={3} maxLength={800} value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} placeholder="A little context for future you" /></label>
      <div className="goal-form-grid">
        <label><span>Target date <small>(optional)</small></span><input type="date" value={form.targetDate} onChange={(event) => onChange({ ...form, targetDate: event.target.value })} /></label>
        <label><span>Life area <small>(optional)</small></span><select value={form.areaId} onChange={(event) => onChange({ ...form, areaId: event.target.value as LifeAreaId | '' })}><option value="">Whole life / unassigned</option>{Object.values(LIFE_AREAS).map((area) => <option key={area.id} value={area.id}>{area.label}</option>)}</select></label>
      </div>
      <div className="goal-form-actions"><button type="button" onClick={onCancel}>Cancel</button><button className="goal-primary" disabled={!form.title.trim()} type="submit">{form.id ? 'Save changes' : 'Add goal'}</button></div>
    </form>
  );
}

export function GoalsPage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/');
  const journalEntries = useAppStore((state) => state.journalEntries);
  const tasks = useAppStore((state) => state.tasks);
  const events = useAppStore((state) => state.events);
  const expenses = useAppStore((state) => state.expenses);
  const workShifts = useAppStore((state) => state.workShifts);
  const entityLinks = useAppStore((state) => state.entityLinks);
  const addJournalEntry = useAppStore((state) => state.addJournalEntry);
  const updateJournalEntry = useAppStore((state) => state.updateJournalEntry);
  const deleteJournalEntry = useAppStore((state) => state.deleteJournalEntry);
  const linkEntities = useAppStore((state) => state.linkEntities);
  const unlinkEntities = useAppStore((state) => state.unlinkEntities);
  const openTaskEditor = useAppStore((state) => state.openTaskEditor);
  const openEventEditor = useAppStore((state) => state.openEventEditor);
  const openJournalEditor = useAppStore((state) => state.openJournalEditor);

  const [selectedGoalId, setSelectedGoalId] = useState<string>();
  const [form, setForm] = useState<GoalFormState>();
  const [linking, setLinking] = useState(false);
  const [linkQuery, setLinkQuery] = useState('');

  const goals = useMemo(() => journalEntries.map(goalFromEntry).filter((goal): goal is GoalRecord => Boolean(goal)), [journalEntries]);
  const activeGoals = useMemo(() => goals.filter((goal) => !goal.completed).sort((a, b) => (a.targetDate ?? '9999-12-31').localeCompare(b.targetDate ?? '9999-12-31') || b.updatedAt - a.updatedAt), [goals]);
  const completedGoals = useMemo(() => goals.filter((goal) => goal.completed).sort((a, b) => b.updatedAt - a.updatedAt), [goals]);
  const selectedGoal = goals.find((goal) => goal.id === selectedGoalId) ?? activeGoals[0] ?? completedGoals[0];

  const candidates = useMemo<ConnectionCandidate[]>(() => {
    const list: ConnectionCandidate[] = [];
    for (const task of tasks) list.push({ ref: { kind: 'task', id: task.id }, title: task.title, detail: task.completed ? 'Completed task' : 'Open task', date: task.completedAt ? dayKey(task.completedAt) : task.dueDate, icon: SquareCheckBig, open: () => openTaskEditor(task.id) });
    for (const event of events) list.push({ ref: { kind: 'event', id: event.id }, title: event.title, detail: 'Calendar event', date: event.startDate, icon: CalendarDays, open: () => openEventEditor(event.id) });
    for (const entry of journalEntries) {
      if (isGoalEntry(entry)) continue;
      const person = entry.areaId === 'love' && entry.tags.includes('love-person');
      list.push({ ref: { kind: person ? 'person' : 'journal', id: entry.id }, title: entry.title || (person ? 'Someone important' : 'Untitled reflection'), detail: person ? 'Relationship' : 'Journal entry', date: entry.entryDate, icon: person ? Heart : NotebookPen, open: () => person ? navigate('/life/love') : openJournalEditor(entry.id) });
    }
    for (const expense of expenses) list.push({ ref: { kind: 'transaction', id: expense.id }, title: expense.title, detail: 'Money record', date: expense.expenseDate, icon: ReceiptText, open: () => navigate('/money') });
    for (const shift of workShifts) list.push({ ref: { kind: 'shift', id: shift.id }, title: shift.note?.trim() || 'Work shift', detail: 'Work record', date: dayKey(shift.startedAt), icon: BriefcaseBusiness, open: () => navigate('/work') });
    return list.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.title.localeCompare(b.title));
  }, [events, expenses, journalEntries, navigate, openEventEditor, openJournalEditor, openTaskEditor, tasks, workShifts]);

  const candidateMap = useMemo(() => new Map(candidates.map((candidate) => [`${candidate.ref.kind}:${candidate.ref.id}`, candidate])), [candidates]);
  const connections = selectedGoal ? goalConnections(selectedGoal.id, entityLinks) : [];
  const connectedCandidates = connections.map((connection) => ({ ...connection, candidate: candidateMap.get(`${connection.ref.kind}:${connection.ref.id}`) }));
  const connectedTaskIds = new Set(connections.filter((connection) => connection.ref.kind === 'task').map((connection) => connection.ref.id));
  const connectedTasks = tasks.filter((task) => connectedTaskIds.has(task.id));
  const completedConnectedTasks = connectedTasks.filter((task) => task.completed).length;

  const filteredCandidates = useMemo(() => {
    if (!selectedGoal) return [];
    const linked = new Set(connections.map((connection) => `${connection.ref.kind}:${connection.ref.id}`));
    const query = linkQuery.trim().toLocaleLowerCase();
    return candidates.filter((candidate) => !linked.has(`${candidate.ref.kind}:${candidate.ref.id}`) && (!query || `${candidate.title} ${candidate.detail}`.toLocaleLowerCase().includes(query))).slice(0, 40);
  }, [candidates, connections, linkQuery, selectedGoal]);

  const startCreate = () => { setForm(emptyForm()); setLinking(false); };
  const startEdit = (goal: GoalRecord) => setForm({ id: goal.id, title: goal.title, description: goal.description ?? '', targetDate: goal.targetDate ?? '', areaId: goal.areaId ?? '' });
  const saveGoal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form?.title.trim()) return;
    const existing = form.id ? goals.find((goal) => goal.id === form.id) : undefined;
    const draft: GoalDraft = { title: form.title, description: form.description, targetDate: form.targetDate || undefined, areaId: form.areaId || undefined, completed: existing?.completed ?? false };
    const input = goalJournalInput(draft, getLocalDateKey());
    if (form.id) updateJournalEntry(form.id, input);
    else addJournalEntry(input);
    setForm(undefined);
  };

  const toggleCompleted = (goal: GoalRecord) => {
    updateJournalEntry(goal.id, goalJournalInput({ title: goal.title, description: goal.description, targetDate: goal.targetDate, areaId: goal.areaId, completed: !goal.completed }, getLocalDateKey()));
  };

  const removeGoal = (goal: GoalRecord) => {
    if (!window.confirm(`Delete goal “${goal.title}”? Connected records will stay in Still.`)) return;
    for (const connection of goalConnections(goal.id, entityLinks)) unlinkEntities(connection.linkId);
    deleteJournalEntry(goal.id);
    if (selectedGoalId === goal.id) setSelectedGoalId(undefined);
  };

  const connect = (candidate: ConnectionCandidate) => {
    if (!selectedGoal) return;
    linkEntities(goalRef(selectedGoal.id), candidate.ref, 'contributes-to');
    setLinkQuery('');
  };

  const area = selectedGoal?.areaId ? LIFE_AREAS[selectedGoal.areaId] : undefined;

  return (
    <main className="shell goals-page">
      <header className="goals-header">
        <button className="btn-icon" onClick={goBack} type="button" aria-label="Go back"><ArrowLeft size={20} /></button>
        <div className="goals-heading"><p className="section-kicker">Longer threads</p><h1>Goals</h1><p>Connect the small records in Still to something you are actually moving toward.</p></div>
        <button className="goal-add-button" onClick={startCreate} type="button"><Plus size={17} /> Add goal</button>
      </header>

      {form && <GoalForm form={form} onChange={setForm} onCancel={() => setForm(undefined)} onSave={saveGoal} />}

      {goals.length === 0 ? (
        <button className="card goals-empty" onClick={startCreate} type="button"><Sparkles size={28} /><strong>Give the little things somewhere to lead.</strong><span>A goal can connect tasks, plans, reflections, money records, people, and work without turning your life into a score.</span><b><Plus size={16} /> Add your first goal</b></button>
      ) : (
        <div className="goals-layout">
          <aside className="goals-list-column">
            <section className="goals-list-section"><div className="goals-section-head"><h2>In progress</h2><span>{activeGoals.length}</span></div>{activeGoals.length === 0 ? <p className="goals-muted">Nothing active right now.</p> : <div className="goals-list">{activeGoals.map((goal) => <button className={`goal-list-item ${selectedGoal?.id === goal.id ? 'is-selected' : ''}`} key={goal.id} onClick={() => { setSelectedGoalId(goal.id); setLinking(false); }} type="button"><CircleDot size={17} /><span><strong>{goal.title}</strong><small>{goal.targetDate ? `Target · ${formatDate(goal.targetDate)}` : goal.areaId ? LIFE_AREAS[goal.areaId].label : 'Whole life'}</small></span><ChevronRight size={16} /></button>)}</div>}</section>
            {completedGoals.length > 0 && <section className="goals-list-section"><div className="goals-section-head"><h2>Completed</h2><span>{completedGoals.length}</span></div><div className="goals-list">{completedGoals.map((goal) => <button className={`goal-list-item is-complete ${selectedGoal?.id === goal.id ? 'is-selected' : ''}`} key={goal.id} onClick={() => { setSelectedGoalId(goal.id); setLinking(false); }} type="button"><Check size={17} /><span><strong>{goal.title}</strong><small>Completed goal</small></span><ChevronRight size={16} /></button>)}</div></section>}
          </aside>

          {selectedGoal && <section className="card goal-detail" aria-labelledby="selected-goal-title">
            <div className="goal-detail-head">
              <div><div className="goal-detail-kicker">{area ? <><span style={{ background: area.color }} />{area.label}</> : 'Whole life'}</div><h2 id="selected-goal-title">{selectedGoal.title}</h2>{selectedGoal.description && <p>{selectedGoal.description}</p>}</div>
              <div className="goal-detail-actions"><button onClick={() => startEdit(selectedGoal)} type="button" aria-label="Edit goal"><Pencil size={16} /></button><button onClick={() => removeGoal(selectedGoal)} type="button" aria-label="Delete goal"><Trash2 size={16} /></button></div>
            </div>

            <div className="goal-facts">
              <div><small>Connected</small><strong>{connections.length}</strong><span>records</span></div>
              <div><small>Task steps</small><strong>{connectedTasks.length ? `${completedConnectedTasks}/${connectedTasks.length}` : '—'}</strong><span>{connectedTasks.length ? 'completed' : 'none linked'}</span></div>
              <div><small>Target</small><strong>{selectedGoal.targetDate ? formatDate(selectedGoal.targetDate) : 'Open'}</strong><span>{selectedGoal.targetDate ? 'date' : 'no deadline'}</span></div>
            </div>

            <div className="goal-status-row"><button className={selectedGoal.completed ? 'is-complete' : ''} onClick={() => toggleCompleted(selectedGoal)} type="button">{selectedGoal.completed ? <><Check size={16} /> Mark active again</> : <><CircleDot size={16} /> Mark goal complete</>}</button></div>

            <section className="goal-connections">
              <div className="goals-section-head"><div><p className="section-kicker">Connected records</p><h3>What is moving with this goal</h3></div><button className="goal-link-button" onClick={() => setLinking((value) => !value)} type="button"><Link2 size={16} /> Link something</button></div>

              {linking && <div className="goal-linker"><div className="goal-linker-search"><input autoFocus type="search" value={linkQuery} onChange={(event) => setLinkQuery(event.target.value)} placeholder="Find a task, event, entry…" /><button onClick={() => { setLinking(false); setLinkQuery(''); }} type="button" aria-label="Close linker"><X size={16} /></button></div><div className="goal-linker-results">{filteredCandidates.length === 0 ? <p>Nothing else matches.</p> : filteredCandidates.map((candidate) => { const Icon = candidate.icon; return <button key={`${candidate.ref.kind}:${candidate.ref.id}`} onClick={() => connect(candidate)} type="button"><Icon size={17} /><span><strong>{candidate.title}</strong><small>{candidate.detail}{candidate.date ? ` · ${formatDate(candidate.date)}` : ''}</small></span><Plus size={15} /></button>; })}</div></div>}

              {connectedCandidates.length === 0 ? <div className="goal-no-connections"><Link2 size={22} /><p>Nothing is connected yet. Link records that genuinely contribute instead of manufacturing busywork for the sake of a progress bar.</p></div> : <div className="goal-connection-list">{connectedCandidates.map(({ linkId, ref, candidate }) => <div className="goal-connection-row" key={linkId}><button onClick={() => candidate?.open()} disabled={!candidate} type="button"><span className="goal-connection-kind">{kindLabels[ref.kind] ?? ref.kind}</span><strong>{candidate?.title ?? 'Record no longer available'}</strong>{candidate?.date && <small>{formatDate(candidate.date)}</small>}</button><button onClick={() => unlinkEntities(linkId)} type="button" aria-label={`Unlink ${candidate?.title ?? 'record'}`}><Unlink size={15} /></button></div>)}</div>}
            </section>
          </section>}
        </div>
      )}

      <section className="goals-philosophy"><Sparkles size={17} /><p>Still counts connections and completed steps it can actually verify. It does not invent a 73% “life progress” number because mathematics has suffered enough.</p></section>
    </main>
  );
}
