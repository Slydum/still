export type MoneyTransactionKind = 'expense' | 'income';
export type MoneyAccountKind = 'cash' | 'bank' | 'wallet' | 'other';

export type MoneyAccount = {
  id: string;
  name: string;
  kind: MoneyAccountKind;
  balance: number;
  currency: string;
  createdAt: number;
  updatedAt: number;
};

export type MoneyBill = {
  id: string;
  title: string;
  amount?: number;
  currency: string;
  dueDay: number;
  accountId?: string;
  note?: string;
  lastPaidDate?: string;
  createdAt: number;
  updatedAt: number;
};

export type MoneySavingsGoal = {
  id: string;
  title: string;
  targetAmount?: number;
  savedAmount: number;
  currency: string;
  targetDate?: string;
  createdAt: number;
  updatedAt: number;
};

export type MoneyAccountInput = Pick<MoneyAccount, 'name' | 'kind' | 'balance' | 'currency'>;
export type MoneyBillInput = Pick<
  MoneyBill,
  'title' | 'amount' | 'currency' | 'dueDay' | 'accountId' | 'note'
>;
export type MoneySavingsGoalInput = Pick<
  MoneySavingsGoal,
  'title' | 'targetAmount' | 'savedAmount' | 'currency' | 'targetDate'
>;

export type MoneySettingsState = {
  moneyAccounts: MoneyAccount[];
  moneyBills: MoneyBill[];
  moneySavingsGoals: MoneySavingsGoal[];
  moneyPrivacyHidden: boolean;
};

export const EMPTY_MONEY_ACCOUNTS: MoneyAccount[] = [];
export const EMPTY_MONEY_BILLS: MoneyBill[] = [];
export const EMPTY_MONEY_SAVINGS_GOALS: MoneySavingsGoal[] = [];

const INCOME_CATEGORY_PREFIX = 'Income · ';

export function createMoneyRecordId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function normalizeMoneyCurrency(value: string | undefined, fallback = 'PHP') {
  const normalized = value?.trim().toUpperCase();
  return normalized && /^[A-Z]{3}$/.test(normalized) ? normalized : fallback;
}

export function encodeMoneyTransactionCategory(kind: MoneyTransactionKind, category: string | undefined) {
  const normalized = category?.trim();
  if (kind === 'income') return `${INCOME_CATEGORY_PREFIX}${normalized || 'Income'}`;
  return normalized || undefined;
}

export function moneyTransactionKind(record: { category?: string }): MoneyTransactionKind {
  return record.category?.startsWith(INCOME_CATEGORY_PREFIX) ? 'income' : 'expense';
}

export function moneyTransactionCategory(record: { category?: string }) {
  if (!record.category) return undefined;
  if (!record.category.startsWith(INCOME_CATEGORY_PREFIX)) return record.category;
  const category = record.category.slice(INCOME_CATEGORY_PREFIX.length).trim();
  return category === 'Income' ? undefined : category || undefined;
}

export function savingsGoalProgress(goal: Pick<MoneySavingsGoal, 'savedAmount' | 'targetAmount'>) {
  if (!goal.targetAmount || goal.targetAmount <= 0) return 0;
  return Math.min(1, Math.max(0, goal.savedAmount / goal.targetAmount));
}

export function billDueDate(bill: Pick<MoneyBill, 'dueDay'>, reference: Date) {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(Math.max(1, bill.dueDay), lastDay), 12, 0, 0, 0);
}

export function billPaidThisMonth(bill: Pick<MoneyBill, 'lastPaidDate'>, reference: Date) {
  if (!bill.lastPaidDate) return false;
  const monthKey = `${reference.getFullYear()}-${String(reference.getMonth() + 1).padStart(2, '0')}`;
  return bill.lastPaidDate.startsWith(monthKey);
}
