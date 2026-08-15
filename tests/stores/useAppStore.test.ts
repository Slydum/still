import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

function installMemoryStorage() {
  const values = new Map<string, string>();
  globalThis.localStorage = {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size;
    },
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe('quick add store modes', () => {
  it('opens directly into a requested quick-add mode', async () => {
    installMemoryStorage();
    const { useAppStore } = await import('../../src/stores/useAppStore.js');

    useAppStore.getState().openQuickAdd('expense');

    assert.equal(useAppStore.getState().quickAddOpen, true);
    assert.equal(useAppStore.getState().quickAddMode, 'expense');
  });

  it('resets editing context when reopening the quick-add menu', async () => {
    installMemoryStorage();
    const { useAppStore } = await import('../../src/stores/useAppStore.js');

    useAppStore.getState().openEventEditor('event-1', '2026-08-05');
    useAppStore.getState().openQuickAdd();

    const state = useAppStore.getState();
    assert.equal(state.quickAddOpen, true);
    assert.equal(state.quickAddMode, 'menu');
    assert.equal(state.editingEventId, undefined);
    assert.equal(state.eventDraftDate, undefined);
  });

  it('closes the sheet and clears transient quick-add fields', async () => {
    installMemoryStorage();
    const { useAppStore } = await import('../../src/stores/useAppStore.js');

    useAppStore.getState().openJournalEditor('journal-1', '2026-08-05');
    useAppStore.getState().closeQuickAdd();

    const state = useAppStore.getState();
    assert.equal(state.quickAddOpen, false);
    assert.equal(state.quickAddMode, 'menu');
    assert.equal(state.editingJournalId, undefined);
    assert.equal(state.journalDraftDate, undefined);
  });

  it('adds expenses as first-class money records', async () => {
    installMemoryStorage();
    const { useAppStore } = await import('../../src/stores/useAppStore.js');
    const before = useAppStore.getState().expenses.length;

    useAppStore.getState().addExpense({
      title: '  Coffee  ',
      amount: 4.5,
      currency: 'USD',
      category: ' cafe ',
      note: ' morning treat ',
      expenseDate: '2026-08-05',
    });

    const expense = useAppStore.getState().expenses.at(-1);
    assert.equal(useAppStore.getState().expenses.length, before + 1);
    assert.equal(expense?.title, 'Coffee');
    assert.equal(expense?.amount, 4.5);
    assert.equal(expense?.currency, 'USD');
    assert.equal(expense?.category, 'cafe');
    assert.equal(expense?.note, 'morning treat');
    assert.equal(expense?.expenseDate, '2026-08-05');
    assert.equal(expense?.areaId, 'money');
  });

  it('updates and deletes expenses by id', async () => {
    installMemoryStorage();
    const { useAppStore } = await import('../../src/stores/useAppStore.js');

    useAppStore.getState().addExpense({
      title: 'Lunch',
      amount: 12,
      currency: 'USD',
      expenseDate: '2026-08-05',
    });

    const created = useAppStore.getState().expenses.at(-1);
    if (!created) throw new Error('Expected expense to be created');
    assert.ok(created.id);

    useAppStore.getState().updateExpense(created.id, {
      title: 'Lunch with team',
      amount: 18,
      currency: 'USD',
      category: 'Meals',
      expenseDate: '2026-08-06',
    });

    assert.equal(useAppStore.getState().expenses.find((expense) => expense.id === created.id)?.title, 'Lunch with team');
    assert.equal(useAppStore.getState().expenses.find((expense) => expense.id === created.id)?.amount, 18);

    useAppStore.getState().deleteExpense(created.id);

    assert.equal(useAppStore.getState().expenses.some((expense) => expense.id === created.id), false);
  });

  it('deduplicates notification ids and keeps read/clear semantics explicit', async () => {
    installMemoryStorage();
    const { useAppStore } = await import('../../src/stores/useAppStore.js');
    useAppStore.getState().clearNotifications();

    useAppStore.getState().addNotification({
      id: 'release-notification',
      title: 'First',
      body: 'One notification',
      kind: 'system',
    });
    useAppStore.getState().addNotification({
      id: 'release-notification',
      title: 'Duplicate',
      body: 'Must not create another row',
      kind: 'system',
    });

    assert.equal(useAppStore.getState().notifications.length, 1);
    assert.equal(useAppStore.getState().notifications[0]?.title, 'First');
    assert.equal(useAppStore.getState().notifications[0]?.read, false);

    useAppStore.getState().markAllNotificationsRead();
    assert.equal(useAppStore.getState().notifications.every((notification) => notification.read), true);

    useAppStore.getState().clearNotifications();
    assert.equal(useAppStore.getState().notifications.length, 0);
  });
});
