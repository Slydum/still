import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  billDueDate,
  billPaidThisMonth,
  encodeMoneyTransactionCategory,
  moneyTransactionCategory,
  moneyTransactionKind,
  savingsGoalProgress,
} from '../../src/domain/money.js';

describe('Money domain helpers', () => {
  it('treats legacy expense categories as spending', () => {
    const record = { category: 'Groceries' };
    assert.equal(moneyTransactionKind(record), 'expense');
    assert.equal(moneyTransactionCategory(record), 'Groceries');
  });

  it('round-trips income without changing the expense record shape', () => {
    const category = encodeMoneyTransactionCategory('income', 'Salary');
    const record = { category };
    assert.equal(category, 'Income · Salary');
    assert.equal(moneyTransactionKind(record), 'income');
    assert.equal(moneyTransactionCategory(record), 'Salary');
  });

  it('keeps savings progress calm and bounded', () => {
    assert.equal(savingsGoalProgress({ savedAmount: 250, targetAmount: 1000 }), 0.25);
    assert.equal(savingsGoalProgress({ savedAmount: 1200, targetAmount: 1000 }), 1);
    assert.equal(savingsGoalProgress({ savedAmount: 100, targetAmount: undefined }), 0);
  });

  it('uses a valid day for short months and recognizes this month as paid', () => {
    const reference = new Date(2026, 1, 10, 12, 0, 0);
    const due = billDueDate({ dueDay: 31 }, reference);
    assert.equal(due.getFullYear(), 2026);
    assert.equal(due.getMonth(), 1);
    assert.equal(due.getDate(), 28);
    assert.equal(billPaidThisMonth({ lastPaidDate: '2026-02-09' }, reference), true);
    assert.equal(billPaidThisMonth({ lastPaidDate: '2026-01-31' }, reference), false);
  });
});
