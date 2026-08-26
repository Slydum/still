import {
  ArrowLeft,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Heart,
  HeartPulse,
  NotebookPen,
  Paperclip,
  Search,
  SquareCheckBig,
  Target,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../../components/navigation/useBackNavigation';
import { attachmentFromEntry } from '../../domain/attachments';
import { reminderFromEntry } from '../../domain/reminders';
import { useAppStore } from '../../stores/useAppStore';
import './search.css';

type SearchKind = 'task' | 'event' | 'journal' | 'person' | 'money' | 'work' | 'health' | 'goal' | 'reminder' | 'attachment';

type SearchResult = {
  id: string;
  kind: SearchKind;
  title: string;
  detail: string;
  searchable: string;
  updatedAt: number;
  open: () => void;
};

type HealthRoutineSearchRecord = { id: string; title: string; note?: string; updatedAt?: number };
type MoneyAccountSearchRecord = { id: string; name: string; type?: string; currency?: string; updatedAt?: number };
type MoneyBillSearchRecord = { id: string; title: string; amount?: number; currency?: string; updatedAt?: number };
type MoneyGoalSearchRecord = { id: string; title: string; targetAmount?: number; currency?: string; updatedAt?: number };

type SearchSupplementState = {
  healthRoutines?: HealthRoutineSearchRecord[];
  moneyAccounts?: MoneyAccountSearchRecord[];
  moneyBills?: MoneyBillSearchRecord[];
  moneySavingsGoals?: MoneyGoalSearchRecord[];
};

const EMPTY_HEALTH_ROUTINES: HealthRoutineSearchRecord[] = [];
const EMPTY_MONEY_ACCOUNTS: MoneyAccountSearchRecord[] = [];
const EMPTY_MONEY_BILLS: MoneyBillSearchRecord[] = [];
const EMPTY_MONEY_GOALS: MoneyGoalSearchRecord[] = [];

const KIND_LABELS: Record<SearchKind, string> = {
  task: 'Task',
  event: 'Calendar',
  journal: 'Journal',
  person: 'Love',
  money: 'Money',
  work: 'Work',
  health: 'Health',
  goal: 'Goal',
  reminder: 'Reminder',
  attachment: 'Attachment',
};

const KIND_ICONS: Record<SearchKind, LucideIcon> = {
  task: SquareCheckBig,
  event: CalendarDays,
  journal: NotebookPen,
  person: Heart,
  money: WalletCards,
  work: BriefcaseBusiness,
  health: HeartPulse,
  goal: Target,
  reminder: Bell,
  attachment: Paperclip,
};

function normalize(value: string | number | undefined) {
  return String(value ?? '').toLocaleLowerCase().trim();
}

function includesQuery(result: SearchResult, terms: string[]) {
  const haystack = normalize(`${result.title} ${result.detail} ${result.searchable}`);
  return terms.every((term) => haystack.includes(term));
}

function dateDetail(value?: string) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

export function SearchPage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/');
  const [query, setQuery] = useState('');
  const tasks = useAppStore((state) => state.tasks);
  const events = useAppStore((state) => state.events);
  const journalEntries = useAppStore((state) => state.journalEntries);
  const expenses = useAppStore((state) => state.expenses);
  const workShifts = useAppStore((state) => state.workShifts);
  const openTaskEditor = useAppStore((state) => state.openTaskEditor);
  const openEventEditor = useAppStore((state) => state.openEventEditor);
  const openJournalEditor = useAppStore((state) => state.openJournalEditor);
  const healthRoutines = useAppStore((state) => (state as unknown as SearchSupplementState).healthRoutines ?? EMPTY_HEALTH_ROUTINES);
  const moneyAccounts = useAppStore((state) => (state as unknown as SearchSupplementState).moneyAccounts ?? EMPTY_MONEY_ACCOUNTS);
  const moneyBills = useAppStore((state) => (state as unknown as SearchSupplementState).moneyBills ?? EMPTY_MONEY_BILLS);
  const moneySavingsGoals = useAppStore((state) => (state as unknown as SearchSupplementState).moneySavingsGoals ?? EMPTY_MONEY_GOALS);

  const allResults = useMemo<SearchResult[]>(() => {
    const results: SearchResult[] = [];

    for (const task of tasks) {
      results.push({
        id: `task:${task.id}`,
        kind: 'task',
        title: task.title,
        detail: [task.completed ? 'Completed' : 'Open task', task.dueDate ? dateDetail(task.dueDate) : ''].filter(Boolean).join(' · '),
        searchable: `${task.note ?? ''} ${task.priority} ${task.repeat} ${task.areaId ?? ''}`,
        updatedAt: task.updatedAt,
        open: () => openTaskEditor(task.id),
      });
    }

    for (const event of events) {
      results.push({
        id: `event:${event.id}`,
        kind: 'event',
        title: event.title,
        detail: `${dateDetail(event.startDate)}${event.allDay ? ' · All day' : event.startTime ? ` · ${event.startTime}` : ''}`,
        searchable: `${event.note ?? ''} ${event.category} ${event.repeat} ${event.areaId ?? ''}`,
        updatedAt: event.updatedAt,
        open: () => openEventEditor(event.id),
      });
    }

    for (const entry of journalEntries) {
      const reminder = reminderFromEntry(entry);
      if (reminder) {
        results.push({
          id: `reminder:${entry.id}`,
          kind: 'reminder',
          title: reminder.title,
          detail: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(reminder.remindAt)),
          searchable: `${reminder.note ?? ''} ${reminder.repeat} ${reminder.target?.title ?? ''}`,
          updatedAt: entry.updatedAt,
          open: () => navigate('/reminders'),
        });
        continue;
      }

      const attachment = attachmentFromEntry(entry);
      if (attachment) {
        results.push({
          id: `attachment:${entry.id}`,
          kind: 'attachment',
          title: attachment.name,
          detail: `${attachment.target.kind === 'transaction' ? 'Money' : 'Journal'} attachment`,
          searchable: `${attachment.mimeType} ${attachment.target.title}`,
          updatedAt: entry.updatedAt,
          open: () => navigate('/attachments'),
        });
        continue;
      }

      const isGoal = entry.tags.includes('still-goal');
      const isPerson = !isGoal && entry.areaId === 'love' && entry.tags.includes('love-person');
      const kind: SearchKind = isGoal ? 'goal' : isPerson ? 'person' : 'journal';
      results.push({
        id: `${kind}:${entry.id}`,
        kind,
        title: entry.title || (isPerson ? 'Someone important' : isGoal ? 'Untitled goal' : 'Untitled entry'),
        detail: isGoal ? 'Life goal' : isPerson ? 'Relationship' : dateDetail(entry.entryDate),
        searchable: `${entry.body} ${entry.tags.join(' ')} ${entry.areaId ?? ''}`,
        updatedAt: entry.updatedAt,
        open: () => {
          if (isGoal) navigate('/goals');
          else if (isPerson) navigate('/life/love');
          else openJournalEditor(entry.id);
        },
      });
    }

    for (const expense of expenses) {
      results.push({
        id: `money:transaction:${expense.id}`,
        kind: 'money',
        title: expense.title,
        detail: [dateDetail(expense.expenseDate), expense.amount === undefined ? '' : `${expense.currency} ${expense.amount}`].filter(Boolean).join(' · '),
        searchable: `${expense.category ?? ''} ${expense.note ?? ''} ${expense.currency} ${expense.amount ?? ''}`,
        updatedAt: expense.updatedAt,
        open: () => navigate('/money'),
      });
    }

    for (const shift of workShifts) {
      if (!shift.note?.trim()) continue;
      results.push({
        id: `work:${shift.id}`,
        kind: 'work',
        title: shift.note.trim(),
        detail: new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(shift.startedAt)),
        searchable: 'work shift note',
        updatedAt: shift.endedAt ?? shift.startedAt,
        open: () => navigate('/work'),
      });
    }

    for (const routine of healthRoutines) {
      results.push({
        id: `health:routine:${routine.id}`,
        kind: 'health',
        title: routine.title,
        detail: 'Health routine',
        searchable: routine.note ?? '',
        updatedAt: routine.updatedAt ?? 0,
        open: () => navigate('/health'),
      });
    }

    for (const account of moneyAccounts) {
      results.push({
        id: `money:account:${account.id}`,
        kind: 'money',
        title: account.name,
        detail: 'Money account',
        searchable: `${account.type ?? ''} ${account.currency ?? ''}`,
        updatedAt: account.updatedAt ?? 0,
        open: () => navigate('/money'),
      });
    }

    for (const bill of moneyBills) {
      results.push({
        id: `money:bill:${bill.id}`,
        kind: 'money',
        title: bill.title,
        detail: 'Bill',
        searchable: `${bill.amount ?? ''} ${bill.currency ?? ''}`,
        updatedAt: bill.updatedAt ?? 0,
        open: () => navigate('/money'),
      });
    }

    for (const goal of moneySavingsGoals) {
      results.push({
        id: `money:goal:${goal.id}`,
        kind: 'money',
        title: goal.title,
        detail: 'Savings goal',
        searchable: `${goal.targetAmount ?? ''} ${goal.currency ?? ''}`,
        updatedAt: goal.updatedAt ?? 0,
        open: () => navigate('/money'),
      });
    }

    return results;
  }, [events, expenses, healthRoutines, journalEntries, moneyAccounts, moneyBills, moneySavingsGoals, navigate, openEventEditor, openJournalEditor, openTaskEditor, tasks, workShifts]);

  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const matches = useMemo(
    () => terms.length === 0
      ? []
      : allResults.filter((result) => includesQuery(result, terms)).sort((left, right) => right.updatedAt - left.updatedAt).slice(0, 80),
    [allResults, terms],
  );

  return (
    <main className="shell search-page">
      <header className="search-header">
        <button className="btn-icon" onClick={goBack} type="button" aria-label="Go back"><ArrowLeft size={20} /></button>
        <div>
          <p className="section-kicker">Across Still</p>
          <h1>Find anything you kept.</h1>
        </div>
      </header>

      <section className="search-field-wrap" role="search">
        <Search size={20} aria-hidden="true" />
        <input
          autoFocus
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search tasks, reminders, goals, people, journal…"
          type="search"
          value={query}
          aria-label="Search Still"
        />
        {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={17} /></button>}
      </section>

      {terms.length === 0 ? (
        <section className="card search-empty-state">
          <Search size={25} />
          <strong>Your records are searchable together.</strong>
          <p>Try a reminder, goal, person, task, attachment, bill, category, or something you remember writing.</p>
        </section>
      ) : matches.length === 0 ? (
        <section className="card search-empty-state" aria-live="polite">
          <strong>Nothing matched “{query.trim()}”.</strong>
          <p>Try fewer words or a detail from the record.</p>
        </section>
      ) : (
        <section className="search-results" aria-label={`${matches.length} search results`}>
          <div className="search-results-heading"><strong>{matches.length} {matches.length === 1 ? 'match' : 'matches'}</strong><span>Newest relevant records first</span></div>
          <div className="card search-results-card">
            {matches.map((result) => {
              const Icon = KIND_ICONS[result.kind];
              return (
                <button className="search-result-row" key={result.id} onClick={result.open} type="button">
                  <span className={`search-result-icon is-${result.kind}`}><Icon size={18} /></span>
                  <span className="search-result-copy">
                    <small>{KIND_LABELS[result.kind]}</small>
                    <strong>{result.title}</strong>
                    {result.detail && <span>{result.detail}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
