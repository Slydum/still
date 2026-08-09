import { ChevronDown } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  encodeMoneyTransactionCategory,
  moneyTransactionCategory,
  moneyTransactionKind,
  type MoneyTransactionKind,
} from '../../../domain/money';
import type { ExpenseInput, StillExpense } from '../../../stores/useAppStore';
import { getLocalDateKey } from '../../../theme/stillContext';

export function ExpenseEditor({ currency, expense, allowIncome = false, onCancel, onSave }: {
  currency: string;
  expense?: StillExpense;
  allowIncome?: boolean;
  onCancel: () => void;
  onSave: (input: ExpenseInput) => void;
}) {
  const [title, setTitle] = useState(expense?.title ?? '');
  const [amount, setAmount] = useState(expense?.amount === undefined ? '' : String(expense.amount));
  const [kind, setKind] = useState<MoneyTransactionKind>(allowIncome && expense ? moneyTransactionKind(expense) : 'expense');
  const [category, setCategory] = useState(allowIncome ? moneyTransactionCategory(expense ?? {}) ?? '' : expense?.category ?? '');
  const [note, setNote] = useState(expense?.note ?? '');
  const [expenseDate, setExpenseDate] = useState(expense?.expenseDate ?? getLocalDateKey());
  const resolvedCurrency = expense?.currency || currency;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) return;
    const parsedAmount = amount.trim() ? Number(amount) : undefined;
    onSave({
      title,
      amount: parsedAmount,
      currency: resolvedCurrency,
      category: allowIncome ? encodeMoneyTransactionCategory(kind, category) : category,
      note,
      expenseDate,
      areaId: 'money',
    });
  };

  const noun = allowIncome ? 'transaction' : 'expense';

  return (
    <form className="task-editor" onSubmit={submit}>
      {allowIncome && (
        <fieldset className="money-kind-picker">
          <legend>Type</legend>
          <label>
            <input checked={kind === 'expense'} name="money-transaction-kind" onChange={() => setKind('expense')} type="radio" />
            <span>Spending</span>
          </label>
          <label>
            <input checked={kind === 'income'} name="money-transaction-kind" onChange={() => setKind('income')} type="radio" />
            <span>Income</span>
          </label>
        </fieldset>
      )}
      <label className="task-field">
        <span>{allowIncome ? 'Transaction' : 'Expense'}</span>
        <input data-autofocus maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder={kind === 'income' ? 'Where did it come from?' : 'What did you spend on?'} required type="text" value={title} />
      </label>
      <div className="task-form-row">
        <label className="task-field">
          <span>Amount</span>
          <input inputMode="decimal" min="0" onChange={(event) => setAmount(event.target.value)} placeholder="24.50" step="0.01" type="number" value={amount} />
        </label>
        <label className="task-field">
          <span>Date</span>
          <input onChange={(event) => setExpenseDate(event.target.value)} required type="date" value={expenseDate} />
        </label>
      </div>
      <p className="subtle">{allowIncome ? 'Transactions stay in Money and use your existing expense history.' : 'Expenses connect to Money automatically.'}</p>

      <details className="editor-more-options" open={Boolean(category || expense?.note)}>
        <summary><span>More options</span><ChevronDown size={16} aria-hidden="true" /></summary>
        <div className="editor-more-options-content">
          <label className="task-field">
            <span>Category <small>(optional)</small></span>
            <input maxLength={80} onChange={(event) => setCategory(event.target.value)} placeholder={kind === 'income' ? 'Salary' : 'Groceries'} type="text" value={category} />
          </label>
          <label className="task-field">
            <span>Note <small>(optional)</small></span>
            <textarea maxLength={500} onChange={(event) => setNote(event.target.value)} placeholder="Anything worth remembering" rows={2} value={note} />
          </label>
        </div>
      </details>

      <div className="task-editor-actions">
        <button className="task-secondary-button" onClick={onCancel} type="button">Cancel</button>
        <button className="task-primary-button" disabled={!title.trim()} type="submit">{expense ? 'Save changes' : `Save ${noun}`}</button>
      </div>
    </form>
  );
}
