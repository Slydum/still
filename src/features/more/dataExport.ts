import type { JournalEntry, StillEvent, StillExpense, StillTask } from '../../stores/useAppStore';

export type StillBackupPayload = {
  format: 'still-backup';
  version: 1;
  exportedAt: string;
  records: {
    tasks: unknown[];
    events: unknown[];
    journalEntries: unknown[];
    expenses: unknown[];
    entityLinks: unknown[];
    workShifts: unknown[];
    checkIns: unknown[];
    settings: unknown[];
    notifications: unknown[];
  };
};

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function rowsToCsv(headers: string[], rows: unknown[][]) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function tasksToCsv(tasks: StillTask[]) {
  return rowsToCsv(
    ['title', 'status', 'due_date', 'priority', 'repeat', 'life_area', 'note', 'created_at', 'updated_at', 'completed_at'],
    tasks.map((task) => [
      task.title,
      task.completed ? 'completed' : 'open',
      task.dueDate ?? '',
      task.priority,
      task.repeat,
      task.areaId ?? '',
      task.note ?? '',
      new Date(task.createdAt).toISOString(),
      new Date(task.updatedAt).toISOString(),
      task.completedAt ? new Date(task.completedAt).toISOString() : '',
    ]),
  );
}

export function eventsToCsv(events: StillEvent[]) {
  return rowsToCsv(
    ['title', 'start_date', 'end_date', 'all_day', 'start_time', 'end_time', 'repeat', 'category', 'life_area', 'note'],
    events.map((event) => [
      event.title,
      event.startDate,
      event.endDate,
      event.allDay ? 'yes' : 'no',
      event.startTime ?? '',
      event.endTime ?? '',
      event.repeat,
      event.category,
      event.areaId ?? '',
      event.note ?? '',
    ]),
  );
}

export function expensesToCsv(expenses: StillExpense[]) {
  return rowsToCsv(
    ['title', 'date', 'amount', 'currency', 'category', 'note'],
    expenses.map((expense) => [
      expense.title,
      expense.expenseDate,
      expense.amount ?? '',
      expense.currency,
      expense.category ?? '',
      expense.note ?? '',
    ]),
  );
}

export function journalToMarkdown(entries: JournalEntry[]) {
  if (!entries.length) return '# Still Journal\n\nNo journal entries were included in this export.\n';
  const sorted = [...entries].sort((left, right) => right.entryDate.localeCompare(left.entryDate) || right.createdAt - left.createdAt);
  return `# Still Journal\n\n${sorted.map((entry) => {
    const title = entry.title?.trim() || 'Untitled reflection';
    const tags = entry.tags.length ? `\n\nTags: ${entry.tags.map((tag) => `#${tag}`).join(' ')}` : '';
    const mood = entry.mood ? `\n\nMood: ${entry.mood}/5` : '';
    return `## ${title}\n\n${entry.entryDate}\n\n${entry.body}${mood}${tags}`;
  }).join('\n\n---\n\n')}\n`;
}

export function serializeBackup(records: StillBackupPayload['records'], exportedAt = new Date().toISOString()) {
  const payload: StillBackupPayload = {
    format: 'still-backup',
    version: 1,
    exportedAt,
    records,
  };
  return JSON.stringify(payload, null, 2);
}
