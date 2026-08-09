import { useState, type FormEvent } from 'react';
import {
  normalizeMoneyCurrency,
  type MoneyAccount,
  type MoneyAccountInput,
  type MoneyAccountKind,
  type MoneyBill,
  type MoneyBillInput,
  type MoneySavingsGoal,
  type MoneySavingsGoalInput,
} from '../../domain/money';

const ACCOUNT_KINDS: Array<{ value: MoneyAccountKind; label: string }> = [
  { value: 'bank', label: 'Bank' },
  { value: 'cash', label: 'Cash' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'other', label: 'Other' },
];

function EditorActions({ editing, onCancel }: { editing: boolean; onCancel: () => void }) {
  return (
    <div className="task-editor-actions">
      <button className="task-secondary-button" onClick={onCancel} type="button">Cancel</button>
      <button className="task-primary-button" type="submit">{editing ? 'Save changes' : 'Add'}</button>
    </div>
  );
}

export function MoneyAccountEditor({ currency, value, onCancel, onSave }: {
  currency: string;
  value?: MoneyAccount;
  onCancel: () => void;
  onSave: (input: MoneyAccountInput) => void;
}) {
  const [name, setName] = useState(value?.name ?? '');
  const [kind, setKind] = useState<MoneyAccountKind>(value?.kind ?? 'bank');
  const [balance, setBalance] = useState(value ? String(value.balance) : '');
  const [accountCurrency, setAccountCurrency] = useState(value?.currency ?? currency);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedBalance = Number(balance || 0);
    if (!name.trim() || !Number.isFinite(parsedBalance)) return;
    onSave({
      name: name.trim(),
      kind,
      balance: parsedBalance,
      currency: normalizeMoneyCurrency(accountCurrency, currency),
    });
  };

  return (
    <form className="money-inline-editor task-editor" onSubmit={submit}>
      <div className="task-form-row">
        <label className="task-field">
          <span>Account name</span>
          <input autoFocus maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="Everyday account" required type="text" value={name} />
        </label>
        <label className="task-field">
          <span>Type</span>
          <select onChange={(event) => setKind(event.target.value as MoneyAccountKind)} value={kind}>
            {ACCOUNT_KINDS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>
      <div className="task-form-row">
        <label className="task-field">
          <span>Current balance</span>
          <input inputMode="decimal" onChange={(event) => setBalance(event.target.value)} placeholder="0.00" step="0.01" type="number" value={balance} />
        </label>
        <label className="task-field money-currency-field">
          <span>Currency</span>
          <input autoCapitalize="characters" maxLength={3} onChange={(event) => setAccountCurrency(event.target.value.toUpperCase())} pattern="[A-Za-z]{3}" required type="text" value={accountCurrency} />
        </label>
      </div>
      <EditorActions editing={Boolean(value)} onCancel={onCancel} />
    </form>
  );
}

export function MoneyBillEditor({ currency, accounts, value, onCancel, onSave }: {
  currency: string;
  accounts: MoneyAccount[];
  value?: MoneyBill;
  onCancel: () => void;
  onSave: (input: MoneyBillInput) => void;
}) {
  const [title, setTitle] = useState(value?.title ?? '');
  const [amount, setAmount] = useState(value?.amount === undefined ? '' : String(value.amount));
  const [dueDay, setDueDay] = useState(String(value?.dueDay ?? 1));
  const [billCurrency, setBillCurrency] = useState(value?.currency ?? currency);
  const [accountId, setAccountId] = useState(value?.accountId ?? '');
  const [note, setNote] = useState(value?.note ?? '');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedAmount = amount.trim() ? Number(amount) : undefined;
    const parsedDay = Number(dueDay);
    if (!title.trim() || (parsedAmount !== undefined && !Number.isFinite(parsedAmount))) return;
    onSave({
      title: title.trim(),
      amount: parsedAmount === undefined ? undefined : Math.max(0, parsedAmount),
      currency: normalizeMoneyCurrency(billCurrency, currency),
      dueDay: Math.min(31, Math.max(1, Number.isFinite(parsedDay) ? Math.round(parsedDay) : 1)),
      accountId: accountId || undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <form className="money-inline-editor task-editor" onSubmit={submit}>
      <div className="task-form-row">
        <label className="task-field">
          <span>Bill</span>
          <input autoFocus maxLength={100} onChange={(event) => setTitle(event.target.value)} placeholder="Internet" required type="text" value={title} />
        </label>
        <label className="task-field">
          <span>Amount <small>(optional)</small></span>
          <input inputMode="decimal" min="0" onChange={(event) => setAmount(event.target.value)} placeholder="0.00" step="0.01" type="number" value={amount} />
        </label>
      </div>
      <div className="task-form-row">
        <label className="task-field">
          <span>Due each month</span>
          <input inputMode="numeric" max="31" min="1" onChange={(event) => setDueDay(event.target.value)} required type="number" value={dueDay} />
        </label>
        <label className="task-field money-currency-field">
          <span>Currency</span>
          <input autoCapitalize="characters" maxLength={3} onChange={(event) => setBillCurrency(event.target.value.toUpperCase())} pattern="[A-Za-z]{3}" required type="text" value={billCurrency} />
        </label>
      </div>
      {accounts.length > 0 && (
        <label className="task-field">
          <span>Pay from <small>(optional)</small></span>
          <select onChange={(event) => setAccountId(event.target.value)} value={accountId}>
            <option value="">No account linked</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </label>
      )}
      <label className="task-field">
        <span>Note <small>(optional)</small></span>
        <textarea maxLength={300} onChange={(event) => setNote(event.target.value)} placeholder="Anything worth remembering" rows={2} value={note} />
      </label>
      <EditorActions editing={Boolean(value)} onCancel={onCancel} />
    </form>
  );
}

export function MoneySavingsGoalEditor({ currency, value, onCancel, onSave }: {
  currency: string;
  value?: MoneySavingsGoal;
  onCancel: () => void;
  onSave: (input: MoneySavingsGoalInput) => void;
}) {
  const [title, setTitle] = useState(value?.title ?? '');
  const [targetAmount, setTargetAmount] = useState(value?.targetAmount === undefined ? '' : String(value.targetAmount));
  const [savedAmount, setSavedAmount] = useState(value ? String(value.savedAmount) : '0');
  const [goalCurrency, setGoalCurrency] = useState(value?.currency ?? currency);
  const [targetDate, setTargetDate] = useState(value?.targetDate ?? '');

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedTarget = targetAmount.trim() ? Number(targetAmount) : undefined;
    const parsedSaved = Number(savedAmount || 0);
    if (!title.trim() || !Number.isFinite(parsedSaved) || (parsedTarget !== undefined && !Number.isFinite(parsedTarget))) return;
    onSave({
      title: title.trim(),
      targetAmount: parsedTarget === undefined ? undefined : Math.max(0, parsedTarget),
      savedAmount: Math.max(0, parsedSaved),
      currency: normalizeMoneyCurrency(goalCurrency, currency),
      targetDate: targetDate || undefined,
    });
  };

  return (
    <form className="money-inline-editor task-editor" onSubmit={submit}>
      <div className="task-form-row">
        <label className="task-field">
          <span>Goal</span>
          <input autoFocus maxLength={100} onChange={(event) => setTitle(event.target.value)} placeholder="Emergency cushion" required type="text" value={title} />
        </label>
        <label className="task-field">
          <span>Target <small>(optional)</small></span>
          <input inputMode="decimal" min="0" onChange={(event) => setTargetAmount(event.target.value)} placeholder="0.00" step="0.01" type="number" value={targetAmount} />
        </label>
      </div>
      <div className="task-form-row">
        <label className="task-field">
          <span>Saved so far</span>
          <input inputMode="decimal" min="0" onChange={(event) => setSavedAmount(event.target.value)} step="0.01" type="number" value={savedAmount} />
        </label>
        <label className="task-field money-currency-field">
          <span>Currency</span>
          <input autoCapitalize="characters" maxLength={3} onChange={(event) => setGoalCurrency(event.target.value.toUpperCase())} pattern="[A-Za-z]{3}" required type="text" value={goalCurrency} />
        </label>
      </div>
      <label className="task-field">
        <span>Target date <small>(optional)</small></span>
        <input onChange={(event) => setTargetDate(event.target.value)} type="date" value={targetDate} />
      </label>
      <EditorActions editing={Boolean(value)} onCancel={onCancel} />
    </form>
  );
}
