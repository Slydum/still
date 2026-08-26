import { CalendarDays, Download, FileJson, FileText, ListChecks, ReceiptText } from 'lucide-react';
import { useState } from 'react';
import { stillDb } from '../../data/stillDb';
import { isAttachmentEntry } from '../../domain/attachments';
import { isGoalEntry } from '../../domain/goals';
import { isReminderEntry } from '../../domain/reminders';
import { useAppStore } from '../../stores/useAppStore';
import { eventsToCsv, expensesToCsv, journalToMarkdown, serializeBackup, tasksToCsv } from './dataExport';
import './data-export-panel.css';

function downloadText(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function dateStamp() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}

export function DataExportPanel() {
  const tasks = useAppStore((state) => state.tasks);
  const events = useAppStore((state) => state.events);
  const journalEntries = useAppStore((state) => state.journalEntries);
  const expenses = useAppStore((state) => state.expenses);
  const [status, setStatus] = useState('');
  const [exporting, setExporting] = useState(false);

  const readableJournal = journalEntries.filter((entry) =>
    !entry.tags.includes('love-person')
    && !entry.tags.includes('love-checkin')
    && !entry.tags.includes('health-note')
    && !isGoalEntry(entry)
    && !isReminderEntry(entry)
    && !isAttachmentEntry(entry));

  const exportFullBackup = async () => {
    setExporting(true);
    setStatus('Preparing your backup…');
    try {
      const [backupTasks, backupEvents, backupJournal, backupExpenses, entityLinks, workShifts, checkIns, settings, notifications] = await Promise.all([
        stillDb.tasks.toArray(),
        stillDb.events.toArray(),
        stillDb.journalEntries.toArray(),
        stillDb.expenses.toArray(),
        stillDb.entityLinks.toArray(),
        stillDb.workShifts.toArray(),
        stillDb.checkIns.toArray(),
        stillDb.accountSettings.toArray(),
        stillDb.notifications.toArray(),
      ]);
      const json = serializeBackup({
        tasks: backupTasks,
        events: backupEvents,
        journalEntries: backupJournal,
        expenses: backupExpenses,
        entityLinks,
        workShifts,
        checkIns,
        settings,
        notifications,
      });
      downloadText(`still-backup-${dateStamp()}.json`, json, 'application/json');
      setStatus('Full JSON backup downloaded.');
    } catch (error) {
      console.error('Still could not export local data:', error);
      setStatus('Still could not create the backup on this device.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="settings-section" aria-labelledby="export-settings-title">
      <div className="settings-section-heading"><span><Download size={19} /></span><div><h2 id="export-settings-title">Export your data</h2><p>Keep a copy you control outside Still.</p></div></div>
      <div className="card settings-card data-export-card">
        <div className="data-export-primary">
          <div><strong>Complete JSON backup</strong><small>Includes synced records, goals, reminders, attachments, links, check-ins, settings, and local notification history.</small></div>
          <button className="settings-primary-action" disabled={exporting} onClick={() => void exportFullBackup()} type="button"><FileJson size={16} /> {exporting ? 'Preparing…' : 'Download backup'}</button>
        </div>
        <p className="settings-footnote">The JSON file can contain sensitive personal data and embedded attachment contents. Store it somewhere you trust. Still does not upload this export anywhere.</p>
        <div className="data-export-readable" aria-label="Readable exports">
          <button disabled={!tasks.length} onClick={() => downloadText(`still-tasks-${dateStamp()}.csv`, tasksToCsv(tasks), 'text/csv')} type="button"><ListChecks size={16} /><span><strong>Tasks CSV</strong><small>{tasks.length} records</small></span></button>
          <button disabled={!events.length} onClick={() => downloadText(`still-calendar-${dateStamp()}.csv`, eventsToCsv(events), 'text/csv')} type="button"><CalendarDays size={16} /><span><strong>Calendar CSV</strong><small>{events.length} records</small></span></button>
          <button disabled={!expenses.length} onClick={() => downloadText(`still-money-${dateStamp()}.csv`, expensesToCsv(expenses), 'text/csv')} type="button"><ReceiptText size={16} /><span><strong>Money CSV</strong><small>{expenses.length} records</small></span></button>
          <button disabled={!readableJournal.length} onClick={() => downloadText(`still-journal-${dateStamp()}.md`, journalToMarkdown(readableJournal), 'text/markdown')} type="button"><FileText size={16} /><span><strong>Journal Markdown</strong><small>{readableJournal.length} reflections</small></span></button>
        </div>
        {status && <p className="settings-message" role="status">{status}</p>}
      </div>
    </section>
  );
}
