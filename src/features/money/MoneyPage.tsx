import { format, isSameMonth, isSameWeek, parseISO } from 'date-fns';
import { ArrowLeft, Plus, ReceiptText, Trash2, WalletCards } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore, type StillExpense } from '../../stores/useAppStore';

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
  const navigate = useNavigate();
  const expenses = useAppStore((state) => state.expenses);
  const deleteExpense = useAppStore((state) => state.deleteExpense);
  const openQuickAdd = useAppStore((state) => state.openQuickAdd);

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

  return (
    <main className="shell checkin-history-page">
      <header className="checkin-history-header">
        <button className="checkin-back-button" onClick={() => navigate('/')} type="button" aria-label="Back to Life"><ArrowLeft size={20} /></button>
        <div>
          <p className="section-kicker">Your spending</p>
          <h1>Money</h1>
          <p className="subtle">Capture it now and review it gently later.</p>
        </div>
      </header>

      <section className="checkin-summary-grid" aria-label="Spending summary">
        <article className="card checkin-summary-card">
          <ReceiptText size={20} />
          <strong>{expenses.length}</strong>
          <span>total expenses</span>
        </article>
        <article className="card checkin-summary-card">
          <WalletCards size={20} />
          <strong>{weekly.length}</strong>
          <span>this week</span>
        </article>
        <article className="card checkin-summary-card">
          <WalletCards size={20} />
          <strong>{weeklyTotals.length ? weeklyTotals.map(([code, total]) => currency(total, code)).join(', ') : '—'}</strong>
          <span>spent this week</span>
        </article>
        <article className="card checkin-summary-card">
          <WalletCards size={20} />
          <strong>{monthlyTotals.length ? monthlyTotals.map(([code, total]) => currency(total, code)).join(', ') : '—'}</strong>
          <span>spent this month</span>
        </article>
      </section>

      <section className="checkin-history-list-section" aria-labelledby="money-list-title">
        <div className="checkin-list-heading">
          <div><p className="section-kicker">All expenses</p><h2 id="money-list-title">History</h2></div>
          <button className="link-btn" onClick={() => openQuickAdd('expense')} type="button"><Plus size={16} /> Add expense</button>
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
                    <button onClick={() => remove(expense)} type="button" aria-label={`Delete ${expense.title}`}><Trash2 size={16} /></button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
