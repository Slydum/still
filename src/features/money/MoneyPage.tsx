import {
  differenceInCalendarDays,
  format,
  isSameMonth,
  parseISO,
} from 'date-fns';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CalendarClock,
  Check,
  Eye,
  EyeOff,
  Landmark,
  Pencil,
  PiggyBank,
  Plus,
  ReceiptText,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toAppPath } from '../../app/appLocation';
import { useBackNavigation } from '../../components/navigation/useBackNavigation';
import { ExpenseEditor } from '../../components/ui/quick-add/ExpenseEditor';
import { focusFirst, trapTabKey } from '../../components/ui/dialogAccessibility';
import {
  billDueDate,
  billPaidThisMonth,
  createMoneyRecordId,
  EMPTY_MONEY_ACCOUNTS,
  EMPTY_MONEY_BILLS,
  EMPTY_MONEY_SAVINGS_GOALS,
  moneyTransactionCategory,
  moneyTransactionKind,
  savingsGoalProgress,
  type MoneyAccountInput,
  type MoneyBill,
  type MoneyBillInput,
  type MoneySavingsGoalInput,
  type MoneySettingsState,
} from '../../domain/money';
import { useAppStore, type ExpenseInput, type StillExpense } from '../../stores/useAppStore';
import { getLocalDateKey } from '../../theme/stillContext';
import {
  MoneyAccountEditor,
  MoneyBillEditor,
  MoneySavingsGoalEditor,
} from './MoneyProfileEditors';
import './money.css';

type StoreWithMoney = ReturnType<typeof useAppStore.getState> & Partial<MoneySettingsState>;
type EditorId = string | 'new' | undefined;

type CurrencyTotal = [code: string, total: number];

function currency(value: number, code: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: code }).format(value);
  } catch {
    return `${code} ${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)}`;
  }
}

function totalsByCurrency<T>(records: T[], value: (record: T) => number | undefined, code: (record: T) => string) {
  const totals = new Map<string, number>();
  for (const record of records) {
    const amount = value(record);
    if (amount === undefined || !Number.isFinite(amount)) continue;
    totals.set(code(record), (totals.get(code(record)) ?? 0) + amount);
  }
  return Array.from(totals.entries()) as CurrencyTotal[];
}

function displayTotals(totals: CurrencyTotal[], hidden: boolean) {
  if (!totals.length) return '—';
  if (hidden) return '••••';
  return totals.map(([code, total]) => currency(total, code)).join(' · ');
}

function setMoneyState(patch: Partial<MoneySettingsState>) {
  const setState = useAppStore.setState as unknown as (value: Partial<MoneySettingsState>) => void;
  setState(patch);
}

function billStatus(bill: MoneyBill, now: Date) {
  if (billPaidThisMonth(bill, now)) return 'Paid this month';
  const due = billDueDate(bill, now);
  const days = differenceInCalendarDays(due, now);
  if (days < 0) return `${Math.abs(days)}d past due`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due ${format(due, 'MMM d')}`;
}

function TransactionRows({ records, hidden, onEdit, onDelete }: {
  records: StillExpense[];
  hidden: boolean;
  onEdit: (expense: StillExpense, trigger: HTMLElement) => void;
  onDelete: (expense: StillExpense) => void;
}) {
  return (
    <div className="money-transaction-list">
      {records.map((expense) => {
        const kind = moneyTransactionKind(expense);
        const category = moneyTransactionCategory(expense);
        return (
          <article className="money-transaction-row" key={expense.id}>
            <div className={`money-transaction-icon is-${kind}`} aria-hidden="true">
              {kind === 'income' ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
            </div>
            <div className="money-transaction-copy">
              <strong>{expense.title}</strong>
              <span>{category || (kind === 'income' ? 'Income' : 'Uncategorized')} · {format(parseISO(expense.expenseDate), 'MMM d')}</span>
            </div>
            <strong className="money-transaction-amount">
              {hidden ? '••••' : expense.amount === undefined ? '—' : `${kind === 'income' ? '+' : '−'}${currency(expense.amount, expense.currency)}`}
            </strong>
            <div className="money-row-actions">
              <button className="btn-icon" onClick={(event) => onEdit(expense, event.currentTarget)} type="button" aria-label={`Edit ${expense.title}`}><Pencil size={15} /></button>
              <button className="btn-icon" onClick={() => onDelete(expense)} type="button" aria-label={`Delete ${expense.title}`}><Trash2 size={15} /></button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function MoneyPage() {
  const goBack = useBackNavigation('/life/money');
  const expenses = useAppStore((state) => state.expenses);
  const addExpense = useAppStore((state) => state.addExpense);
  const deleteExpense = useAppStore((state) => state.deleteExpense);
  const updateExpense = useAppStore((state) => state.updateExpense);
  const defaultCurrency = useAppStore((state) => state.workProfile.currency);
  const accounts = useAppStore((state) => (state as StoreWithMoney).moneyAccounts ?? EMPTY_MONEY_ACCOUNTS);
  const bills = useAppStore((state) => (state as StoreWithMoney).moneyBills ?? EMPTY_MONEY_BILLS);
  const savingsGoals = useAppStore((state) => (state as StoreWithMoney).moneySavingsGoals ?? EMPTY_MONEY_SAVINGS_GOALS);
  const privacyHidden = useAppStore((state) => (state as StoreWithMoney).moneyPrivacyHidden ?? true);

  const [transactionEditor, setTransactionEditor] = useState<StillExpense | 'new'>();
  const [billEditorId, setBillEditorId] = useState<EditorId>();
  const [goalEditorId, setGoalEditorId] = useState<EditorId>();
  const [accountEditorId, setAccountEditorId] = useState<EditorId>();
  const editDialogRef = useRef<HTMLElement | null>(null);
  const editTriggerRef = useRef<HTMLElement | null>(null);
  const now = new Date();

  const sortedTransactions = useMemo(
    () => [...expenses].sort((a, b) => b.expenseDate.localeCompare(a.expenseDate) || b.createdAt - a.createdAt),
    [expenses],
  );
  const monthlyTransactions = useMemo(
    () => expenses.filter((expense) => isSameMonth(parseISO(expense.expenseDate), now)),
    [expenses],
  );
  const monthlyIncome = useMemo(
    () => totalsByCurrency(
      monthlyTransactions.filter((expense) => moneyTransactionKind(expense) === 'income'),
      (expense) => expense.amount,
      (expense) => expense.currency,
    ),
    [monthlyTransactions],
  );
  const monthlySpending = useMemo(
    () => totalsByCurrency(
      monthlyTransactions.filter((expense) => moneyTransactionKind(expense) === 'expense'),
      (expense) => expense.amount,
      (expense) => expense.currency,
    ),
    [monthlyTransactions],
  );
  const accountTotals = useMemo(
    () => totalsByCurrency(accounts, (account) => account.balance, (account) => account.currency),
    [accounts],
  );
  const unpaidBills = useMemo(
    () => bills
      .filter((bill) => !billPaidThisMonth(bill, now))
      .sort((a, b) => billDueDate(a, now).getTime() - billDueDate(b, now).getTime()),
    [bills],
  );
  const paidBills = useMemo(
    () => bills.filter((bill) => billPaidThisMonth(bill, now)).sort((a, b) => a.dueDay - b.dueDay),
    [bills],
  );
  const trackedGoals = savingsGoals.filter((goal) => Boolean(goal.targetAmount));
  const averageSavingsProgress = trackedGoals.length
    ? trackedGoals.reduce((total, goal) => total + savingsGoalProgress(goal), 0) / trackedGoals.length
    : undefined;

  const closeTransactionEditor = () => {
    setTransactionEditor(undefined);
    window.requestAnimationFrame(() => editTriggerRef.current?.focus());
  };

  const openTransactionEditor = (expense: StillExpense | 'new', trigger?: HTMLElement) => {
    editTriggerRef.current = trigger ?? null;
    setTransactionEditor(expense);
  };

  const saveTransaction = (input: ExpenseInput) => {
    if (!transactionEditor) return;
    if (transactionEditor === 'new') addExpense(input);
    else updateExpense(transactionEditor.id, input);
    closeTransactionEditor();
  };

  const removeTransaction = (expense: StillExpense) => {
    if (!window.confirm(`Delete "${expense.title}"?`)) return;
    deleteExpense(expense.id);
  };

  const saveBill = (input: MoneyBillInput) => {
    const timestamp = Date.now();
    if (billEditorId === 'new') {
      setMoneyState({
        moneyBills: [...bills, {
          id: createMoneyRecordId('bill'),
          ...input,
          createdAt: timestamp,
          updatedAt: timestamp,
        }],
      });
    } else if (billEditorId) {
      setMoneyState({
        moneyBills: bills.map((bill) => bill.id === billEditorId
          ? { ...bill, ...input, updatedAt: timestamp }
          : bill),
      });
    }
    setBillEditorId(undefined);
  };

  const saveGoal = (input: MoneySavingsGoalInput) => {
    const timestamp = Date.now();
    if (goalEditorId === 'new') {
      setMoneyState({
        moneySavingsGoals: [...savingsGoals, {
          id: createMoneyRecordId('goal'),
          ...input,
          createdAt: timestamp,
          updatedAt: timestamp,
        }],
      });
    } else if (goalEditorId) {
      setMoneyState({
        moneySavingsGoals: savingsGoals.map((goal) => goal.id === goalEditorId
          ? { ...goal, ...input, updatedAt: timestamp }
          : goal),
      });
    }
    setGoalEditorId(undefined);
  };

  const saveAccount = (input: MoneyAccountInput) => {
    const timestamp = Date.now();
    if (accountEditorId === 'new') {
      setMoneyState({
        moneyAccounts: [...accounts, {
          id: createMoneyRecordId('account'),
          ...input,
          createdAt: timestamp,
          updatedAt: timestamp,
        }],
      });
    } else if (accountEditorId) {
      setMoneyState({
        moneyAccounts: accounts.map((account) => account.id === accountEditorId
          ? { ...account, ...input, updatedAt: timestamp }
          : account),
      });
    }
    setAccountEditorId(undefined);
  };

  const toggleBillPaid = (bill: MoneyBill) => {
    const paid = billPaidThisMonth(bill, now);
    setMoneyState({
      moneyBills: bills.map((item) => item.id === bill.id
        ? { ...item, lastPaidDate: paid ? undefined : getLocalDateKey(), updatedAt: Date.now() }
        : item),
    });
  };

  const removeBill = (bill: MoneyBill) => {
    if (!window.confirm(`Remove "${bill.title}" from bills?`)) return;
    setMoneyState({ moneyBills: bills.filter((item) => item.id !== bill.id) });
  };

  const removeGoal = (goalId: string, title: string) => {
    if (!window.confirm(`Remove savings goal "${title}"?`)) return;
    setMoneyState({ moneySavingsGoals: savingsGoals.filter((goal) => goal.id !== goalId) });
  };

  const removeAccount = (accountId: string, name: string) => {
    if (!window.confirm(`Remove account "${name}"?`)) return;
    setMoneyState({
      moneyAccounts: accounts.filter((account) => account.id !== accountId),
      moneyBills: bills.map((bill) => bill.accountId === accountId
        ? { ...bill, accountId: undefined, updatedAt: Date.now() }
        : bill),
    });
  };

  useEffect(() => {
    if (!transactionEditor || !editDialogRef.current) return undefined;
    const dialog = editDialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    focusFirst(dialog);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeTransactionEditor();
        return;
      }
      trapTabKey(event, dialog);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [transactionEditor]);

  const renderBill = (bill: MoneyBill) => {
    const account = accounts.find((item) => item.id === bill.accountId);
    const paid = billPaidThisMonth(bill, now);
    return (
      <article className={`money-list-row money-bill-row ${paid ? 'is-paid' : ''}`} key={bill.id}>
        <div className="money-row-icon"><CalendarClock size={18} /></div>
        <div className="money-row-copy">
          <strong>{bill.title}</strong>
          <span>{billStatus(bill, now)}{account ? ` · ${account.name}` : ''}</span>
        </div>
        <strong className="money-row-value">{privacyHidden ? '••••' : bill.amount === undefined ? '—' : currency(bill.amount, bill.currency)}</strong>
        <div className="money-row-actions">
          <button className={`money-paid-button ${paid ? 'is-paid' : ''}`} onClick={() => toggleBillPaid(bill)} type="button" aria-label={paid ? `Mark ${bill.title} unpaid` : `Mark ${bill.title} paid`}>
            <Check size={14} /> {paid ? 'Paid' : 'Mark paid'}
          </button>
          <button className="btn-icon" onClick={() => setBillEditorId(bill.id)} type="button" aria-label={`Edit ${bill.title}`}><Pencil size={15} /></button>
          <button className="btn-icon" onClick={() => removeBill(bill)} type="button" aria-label={`Remove ${bill.title}`}><Trash2 size={15} /></button>
        </div>
      </article>
    );
  };

  return (
    <>
      <main className="shell money-page">
        <header className="money-header still-page-header">
          <button className="btn-icon money-back" onClick={goBack} type="button" aria-label="Go back"><ArrowLeft size={20} /></button>
          <div className="money-heading-copy">
            <p className="section-kicker">Money</p>
            <h1>Where your money stands.</h1>
            <p>Just the useful parts, without turning your life into a spreadsheet.</p>
          </div>
          <div className="money-header-actions">
            <button className="btn-icon money-privacy-toggle" onClick={() => setMoneyState({ moneyPrivacyHidden: !privacyHidden })} type="button" aria-label={privacyHidden ? 'Show financial amounts' : 'Hide financial amounts'}>
              {privacyHidden ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
            <button className="btn btn-secondary btn-compact still-action-button" onClick={(event) => openTransactionEditor('new', event.currentTarget)} type="button"><Plus size={16} /> Transaction</button>
          </div>
        </header>

        <section className="card money-hero" aria-label="Money snapshot">
          <div className="money-hero-copy">
            <span>Current position</span>
            <strong>{displayTotals(accountTotals, privacyHidden)}</strong>
            <p>{accounts.length ? `Across ${accounts.length} ${accounts.length === 1 ? 'account' : 'accounts'}.` : 'Add an account when you want a current balance here.'}</p>
          </div>
          <img alt="" aria-hidden="true" className="money-hero-art" src={toAppPath('/assets/cozy/money-piggy-bank.png')} />
          <div className="money-snapshot-strip">
            <div><span>This month in</span><strong>{displayTotals(monthlyIncome, privacyHidden)}</strong></div>
            <div><span>This month out</span><strong>{displayTotals(monthlySpending, privacyHidden)}</strong></div>
            <div><span>Bills waiting</span><strong>{unpaidBills.length || '—'}</strong></div>
            <div><span>Savings</span><strong>{averageSavingsProgress === undefined ? (savingsGoals.length || '—') : `${Math.round(averageSavingsProgress * 100)}%`}</strong></div>
          </div>
        </section>

        <section className="money-section" aria-labelledby="money-month-title">
          <div className="money-section-head">
            <div><p className="section-kicker">This month</p><h2 id="money-month-title">A simple pulse</h2></div>
          </div>
          <div className="money-month-grid still-summary-grid">
            <article className="card money-month-card still-summary-tile">
              <ArrowDownLeft size={18} />
              <span>Income</span>
              <strong>{displayTotals(monthlyIncome, privacyHidden)}</strong>
              <small>{monthlyTransactions.filter((expense) => moneyTransactionKind(expense) === 'income').length} recorded</small>
            </article>
            <article className="card money-month-card still-summary-tile">
              <ArrowUpRight size={18} />
              <span>Spending</span>
              <strong>{displayTotals(monthlySpending, privacyHidden)}</strong>
              <small>{monthlyTransactions.filter((expense) => moneyTransactionKind(expense) === 'expense').length} recorded</small>
            </article>
            <article className="card money-month-card money-month-note still-summary-tile">
              <ReceiptText size={18} />
              <span>Records</span>
              <strong>{monthlyTransactions.length || '—'}</strong>
              <small>No score. Just what happened.</small>
            </article>
          </div>
        </section>

        <section className="money-section" aria-labelledby="money-bills-title">
          <div className="money-section-head">
            <div><p className="section-kicker">Upcoming bills</p><h2 id="money-bills-title">What needs attention</h2></div>
            <button className="money-text-action" onClick={() => setBillEditorId(billEditorId ? undefined : 'new')} type="button"><Plus size={15} /> Add bill</button>
          </div>
          {billEditorId && (
            <MoneyBillEditor
              key={billEditorId}
              accounts={accounts}
              currency={defaultCurrency}
              value={billEditorId === 'new' ? undefined : bills.find((bill) => bill.id === billEditorId)}
              onCancel={() => setBillEditorId(undefined)}
              onSave={saveBill}
            />
          )}
          {bills.length === 0 ? (
            <button className="money-empty-state" onClick={() => setBillEditorId('new')} type="button">
              <CalendarClock size={19} /><span><strong>No bills saved</strong><small>Add the recurring things you want Still to remember.</small></span>
            </button>
          ) : (
            <div className="card money-list-card">
              {unpaidBills.map(renderBill)}
              {paidBills.length > 0 && <div className="money-list-divider"><span>Paid this month</span></div>}
              {paidBills.map(renderBill)}
            </div>
          )}
        </section>

        <section className="money-section" aria-labelledby="money-transactions-title">
          <div className="money-section-head">
            <div><p className="section-kicker">Transactions</p><h2 id="money-transactions-title">Recent activity</h2></div>
            <button className="money-text-action" onClick={(event) => openTransactionEditor('new', event.currentTarget)} type="button"><Plus size={15} /> Add</button>
          </div>
          {sortedTransactions.length === 0 ? (
            <button className="money-empty-state" onClick={(event) => openTransactionEditor('new', event.currentTarget)} type="button">
              <ReceiptText size={19} /><span><strong>No transactions yet</strong><small>Add spending or income in a few taps.</small></span>
            </button>
          ) : (
            <div className="card money-list-card">
              <TransactionRows records={sortedTransactions.slice(0, 8)} hidden={privacyHidden} onDelete={removeTransaction} onEdit={openTransactionEditor} />
              {sortedTransactions.length > 8 && (
                <details className="money-more-records">
                  <summary>Show {sortedTransactions.length - 8} earlier</summary>
                  <TransactionRows records={sortedTransactions.slice(8)} hidden={privacyHidden} onDelete={removeTransaction} onEdit={openTransactionEditor} />
                </details>
              )}
            </div>
          )}
        </section>

        <section className="money-section" aria-labelledby="money-savings-title">
          <div className="money-section-head">
            <div><p className="section-kicker">Savings</p><h2 id="money-savings-title">Goals at your pace</h2></div>
            <button className="money-text-action" onClick={() => setGoalEditorId(goalEditorId ? undefined : 'new')} type="button"><Plus size={15} /> Add goal</button>
          </div>
          {goalEditorId && (
            <MoneySavingsGoalEditor
              key={goalEditorId}
              currency={defaultCurrency}
              value={goalEditorId === 'new' ? undefined : savingsGoals.find((goal) => goal.id === goalEditorId)}
              onCancel={() => setGoalEditorId(undefined)}
              onSave={saveGoal}
            />
          )}
          {savingsGoals.length === 0 ? (
            <button className="money-empty-state" onClick={() => setGoalEditorId('new')} type="button">
              <PiggyBank size={19} /><span><strong>No savings goals</strong><small>Only add one if it would feel useful, not pressuring.</small></span>
            </button>
          ) : (
            <div className="money-savings-grid">
              {savingsGoals.map((goal) => {
                const progress = savingsGoalProgress(goal);
                return (
                  <article className="card money-goal-card" key={goal.id}>
                    <div className="money-goal-head">
                      <div><strong>{goal.title}</strong><span>{goal.targetDate ? `By ${format(parseISO(goal.targetDate), 'MMM d, yyyy')}` : 'No deadline'}</span></div>
                      <div className="money-row-actions">
                        <button className="btn-icon" onClick={() => setGoalEditorId(goal.id)} type="button" aria-label={`Edit ${goal.title}`}><Pencil size={15} /></button>
                        <button className="btn-icon" onClick={() => removeGoal(goal.id, goal.title)} type="button" aria-label={`Remove ${goal.title}`}><Trash2 size={15} /></button>
                      </div>
                    </div>
                    <div className="money-goal-values"><strong>{privacyHidden ? '••••' : currency(goal.savedAmount, goal.currency)}</strong><span>{goal.targetAmount && !privacyHidden ? `of ${currency(goal.targetAmount, goal.currency)}` : goal.targetAmount ? 'of ••••' : 'saved'}</span></div>
                    {goal.targetAmount && (
                      <div className="money-progress" role="progressbar" aria-label={`${goal.title} savings progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
                        <span style={{ width: `${Math.round(progress * 100)}%` }} />
                      </div>
                    )}
                    <small>{goal.targetAmount ? `${Math.round(progress * 100)}% of the way there` : 'Track the amount without a target.'}</small>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="money-section money-accounts-section" aria-labelledby="money-accounts-title">
          <div className="money-section-head">
            <div><p className="section-kicker">Accounts & settings</p><h2 id="money-accounts-title">Where money lives</h2></div>
            <button className="money-text-action" onClick={() => setAccountEditorId(accountEditorId ? undefined : 'new')} type="button"><Plus size={15} /> Add account</button>
          </div>
          {accountEditorId && (
            <MoneyAccountEditor
              key={accountEditorId}
              currency={defaultCurrency}
              value={accountEditorId === 'new' ? undefined : accounts.find((account) => account.id === accountEditorId)}
              onCancel={() => setAccountEditorId(undefined)}
              onSave={saveAccount}
            />
          )}
          {accounts.length === 0 ? (
            <button className="money-empty-state" onClick={() => setAccountEditorId('new')} type="button">
              <Landmark size={19} /><span><strong>No accounts added</strong><small>Cash, bank accounts, wallets—only what you want to track.</small></span>
            </button>
          ) : (
            <div className="card money-list-card">
              {accounts.map((account) => (
                <article className="money-list-row" key={account.id}>
                  <div className="money-row-icon"><WalletCards size={18} /></div>
                  <div className="money-row-copy"><strong>{account.name}</strong><span>{account.kind[0].toUpperCase() + account.kind.slice(1)} · {account.currency}</span></div>
                  <strong className="money-row-value">{privacyHidden ? '••••' : currency(account.balance, account.currency)}</strong>
                  <div className="money-row-actions">
                    <button className="btn-icon" onClick={() => setAccountEditorId(account.id)} type="button" aria-label={`Edit ${account.name}`}><Pencil size={15} /></button>
                    <button className="btn-icon" onClick={() => removeAccount(account.id, account.name)} type="button" aria-label={`Remove ${account.name}`}><Trash2 size={15} /></button>
                  </div>
                </article>
              ))}
            </div>
          )}
          <button className="card money-privacy-setting" onClick={() => setMoneyState({ moneyPrivacyHidden: !privacyHidden })} type="button">
            <span className="money-row-icon">{privacyHidden ? <Eye size={18} /> : <EyeOff size={18} />}</span>
            <span><strong>Financial amounts</strong><small>{privacyHidden ? 'Hidden until you choose to reveal them.' : 'Visible on this screen.'}</small></span>
            <span className="money-setting-value">{privacyHidden ? 'Hidden' : 'Visible'}</span>
          </button>
        </section>
      </main>

      {transactionEditor && (
        <div className="sheet-backdrop" onClick={closeTransactionEditor}>
          <section
            className="sheet task-sheet money-transaction-sheet"
            onClick={(event) => event.stopPropagation()}
            aria-modal="true"
            role="dialog"
            aria-labelledby="money-transaction-editor-title"
            ref={editDialogRef}
          >
            <div className="sheet-handle" />
            <div className="section-head">
              <div><h2 className="section-title" id="money-transaction-editor-title">{transactionEditor === 'new' ? 'Add transaction' : 'Edit transaction'}</h2><p className="subtle">Spending and income live in one quiet history.</p></div>
              <button className="link-btn" onClick={closeTransactionEditor} aria-label="Close transaction editor" type="button"><X /></button>
            </div>
            <ExpenseEditor allowIncome currency={defaultCurrency} expense={transactionEditor === 'new' ? undefined : transactionEditor} onCancel={closeTransactionEditor} onSave={saveTransaction} />
          </section>
        </div>
      )}
    </>
  );
}
