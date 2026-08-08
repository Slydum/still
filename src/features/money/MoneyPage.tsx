import { format, isSameMonth, isSameWeek, parseISO } from 'date-fns';
import { ArrowLeft, Pencil, Plus, ReceiptText, Trash2, WalletCards, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useBackNavigation } from '../../components/navigation/useBackNavigation';
import { ExpenseEditor } from '../../components/ui/quick-add/ExpenseEditor';
import { focusFirst, trapTabKey } from '../../components/ui/dialogAccessibility';
import { useAppStore, type ExpenseInput, type StillExpense } from '../../stores/useAppStore';

function currency(value: number, code: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(value);
}

function totalsByCurrency(expenses: StillExpense[]) {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    totals.set(expense.currency, (totals.get(expense.currency) ?? 0) + (expense.amount ?? 0));
  }
  return Array.from(totals.entries());
}

export function MoneyPage() {
  const goBack = useBackNavigation('/life/money');
  const expenses = useAppStore((state) => state.expenses);
  const deleteExpense = useAppStore((state) => state.deleteExpense);
  const updateExpense = useAppStore((state) => state.updateExpense);
  const openQuickAdd = useAppStore((state) => state.openQuickAdd);
  const expenseCurrency = useAppStore((state) => state.workProfile.currency);
  const [editingExpense, setEditingExpense] = useState<StillExpense>();
  const editDialogRef = useRef<HTMLElement | null>(null);
  const editTriggerRef = useRef<HTMLElement | null>(null);

  const sorted = useMemo(
    () => [...expenses].sort((a, b) => b.expenseDate.localeCompare(a.expenseDate) || b.createdAt - a.createdAt),
    [expenses],
  );

  const now = new Date();
  const weekly = useMemo(
    () => expenses.filter((expense) => isSameWeek(parseISO(expense.expenseDate), now, { weekStartsOn: 1 })),
    [expenses],
  );
  const monthly = useMemo(
    () => expenses.filter((expense) => isSameMonth(parseISO(expense.expenseDate), now)),
    [expenses],
  );

  const monthlyTotals = totalsByCurrency(monthly);
  const weeklyTotals = totalsByCurrency(weekly);

  const remove = (expense: StillExpense) => {
    if (!window.confirm(`Delete "${expense.title}"?`)) return;
    deleteExpense(expense.id);
  };

  const beginEdit = (expense: StillExpense, trigger: HTMLElement) => {
    editTriggerRef.current = trigger;
    setEditingExpense(expense);
  };

  const closeEdit = () => {
    setEditingExpense(undefined);
    window.requestAnimationFrame(() => editTriggerRef.current?.focus());
  };

  const saveEdit = (input: ExpenseInput) => {
    if (!editingExpense) return;
    updateExpense(editingExpense.id, input);
    closeEdit();
  };

  useEffect(() => {
    if (!editingExpense || !editDialogRef.current) return undefined;
    const dialog = editDialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    focusFirst(dialog);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeEdit();
        return;
      }
      trapTabKey(event, dialog);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [editingExpense]);

  return (
    <>
      <main className="shell checkin-history-page">
        <header className="still-page-header">
          <button className="btn-icon" onClick={goBack} type="button" aria-label="Go back"><ArrowLeft size={20} /></button>
          <div className="still-page-heading">
            <div className="still-page-heading-copy">
              <p className="section-kicker">Money area · tracker</p>
              <h1>Spending tracker</h1>
              <p className="subtle">Capture expenses now and review them gently later.</p>
            </div>
            <button className="btn btn-secondary btn-compact still-action-button" onClick={() => openQuickAdd('expense')} type="button"><Plus size={16} /> Add expense</button>
          </div>
        </header>

        <section className="checkin-summary-grid still-summary-grid" aria-label="Spending summary">
          <article className="card checkin-summary-card still-summary-tile">
            <ReceiptText size={20} />
            <strong>{expenses.length}</strong>
            <span>total expenses</span>
          </article>
          <article className="card checkin-summary-card still-summary-tile">
            <WalletCards size={20} />
            <strong>{weekly.length}</strong>
            <span>this week</span>
          </article>
          <article className="card checkin-summary-card still-summary-tile">
            <WalletCards size={20} />
            <strong>{weeklyTotals.length ? weeklyTotals.map(([code, total]) => currency(total, code)).join(', ') : '—'}</strong>
            <span>spent this week</span>
          </article>
          <article className="card checkin-summary-card still-summary-tile">
            <WalletCards size={20} />
            <strong>{monthlyTotals.length ? monthlyTotals.map(([code, total]) => currency(total, code)).join(', ') : '—'}</strong>
            <span>spent this month</span>
          </article>
        </section>

        <section className="checkin-history-list-section" aria-labelledby="money-list-title">
          <div className="checkin-list-heading">
            <div><p className="section-kicker">All expenses</p><h2 id="money-list-title">History</h2></div>
          </div>
          {sorted.length === 0 ? (
            <button className="checkin-history-empty" onClick={() => openQuickAdd('expense')} type="button">
              <strong>No expenses yet</strong>
              <span>Log your first expense to start seeing it here.</span>
            </button>
          ) : (
            <div className="checkin-history-list">
              {sorted.map((expense) => {
                const date = parseISO(expense.expenseDate);
                return (
                  <article className="card checkin-history-record" key={expense.id}>
                    <time dateTime={expense.expenseDate}><strong>{format(date, 'd')}</strong><span>{format(date, 'MMM')}</span></time>
                    <div className="checkin-record-values money-record-values">
                      <div>
                        <span><small>{expense.category || 'Uncategorized'}</small><strong>{expense.title}</strong></span>
                      </div>
                      <div>
                        <span><small>Amount</small><strong>{expense.amount !== undefined ? currency(expense.amount, expense.currency) : '—'}</strong></span>
                      </div>
                    </div>
                    <div className="checkin-record-actions">
                      <button className="btn-icon" onClick={(event) => beginEdit(expense, event.currentTarget)} type="button" aria-label={`Edit ${expense.title}`}><Pencil size={16} /></button>
                      <button className="btn-icon" onClick={() => remove(expense)} type="button" aria-label={`Delete ${expense.title}`}><Trash2 size={16} /></button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {editingExpense && (
        <div className="sheet-backdrop" onClick={closeEdit}>
          <section
            className="sheet task-sheet"
            onClick={(event) => event.stopPropagation()}
            aria-modal="true"
            role="dialog"
            aria-labelledby="expense-edit-title"
            ref={editDialogRef}
          >
            <div className="sheet-handle" />
            <div className="section-head">
              <div><h2 className="section-title" id="expense-edit-title">Edit expense</h2><p className="subtle">Correct the record without recreating it.</p></div>
              <button className="link-btn" onClick={closeEdit} aria-label="Close expense editor" type="button"><X /></button>
            </div>
            <ExpenseEditor currency={expenseCurrency} expense={editingExpense} onCancel={closeEdit} onSave={saveEdit} />
          </section>
        </div>
      )}
    </>
  );
}
