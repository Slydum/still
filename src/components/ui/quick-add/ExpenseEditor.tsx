import { useState, type FormEvent } from 'react';
import type { ExpenseInput } from '../../../stores/useAppStore';
import { getLocalDateKey } from '../../../theme/stillContext';

export function ExpenseEditor({
  currency,
  onCancel,
  onSave,
}: {
  currency: string;
  onCancel: () => void;
  onSave: (input: ExpenseInput) => void;
}) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [expenseDate, setExpenseDate] = useState(getLocalDateKey());

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) return;

    const parsedAmount = amount.trim() ? Number(amount) : undefined;

    onSave({
      title,
      amount: parsedAmount,
      currency,
      category,
      note,
      expenseDate,
      areaId: 'money',
    });
  };

  return (
    <form className="task-editor" onSubmit={submit}>
      <label className="task-field">
        <span>Expense</span>
        <input autoFocus maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="What did you spend on?" required type="text" value={title} />
      </label>
      <div className="task-form-row">
        <label className="task-field">
          <span>Amount <small>(optional)</small></span>
          <input inputMode="decimal" min="0" onChange={(event) => setAmount(event.target.value)} placeholder="24.50" step="0.01" type="number" value={amount} />
        </label>
        <label className="task-field">
          <span>Date</span>
          <input onChange={(event) => setExpenseDate(event.target.value)} required type="date" value={expenseDate} />
        </label>
      </div>
      <label className="task-field">
        <span>Category <small>(optional)</small></span>
        <input maxLength={80} onChange={(event) => setCategory(event.target.value)} placeholder="Groceries" type="text" value={category} />
      </label>
      <label className="task-field">
        <span>Note <small>(optional)</small></span>
        <textarea maxLength={500} onChange={(event) => setNote(event.target.value)} placeholder="Anything to remember before you reconcile it" rows={3} value={note} />
      </label>
      <div className="task-editor-actions">
        <button className="task-secondary-button" onClick={onCancel} type="button">Cancel</button>
        <button className="task-primary-button" disabled={!title.trim()} type="submit">Save expense</button>
      </div>
    </form>
  );
}
