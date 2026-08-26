import { ArrowLeft, FileText, Image as ImageIcon, Paperclip, Trash2, Upload } from 'lucide-react';
import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '../../components/navigation/useBackNavigation';
import {
  attachmentFromEntry,
  attachmentJournalInput,
  attachmentSizeLabel,
  isAttachmentEntry,
  MAX_ATTACHMENTS_PER_TARGET,
  prepareAttachmentFile,
  type AttachmentRecord,
  type AttachmentTarget,
} from '../../domain/attachments';
import { isGoalEntry } from '../../domain/goals';
import { isReminderEntry } from '../../domain/reminders';
import { useAppStore } from '../../stores/useAppStore';
import './attachments.css';

type TargetOption = AttachmentTarget & { detail: string };

export function AttachmentsPage() {
  const navigate = useNavigate();
  const goBack = useBackNavigation('/reminders');
  const journalEntries = useAppStore((state) => state.journalEntries);
  const expenses = useAppStore((state) => state.expenses);
  const addJournalEntry = useAppStore((state) => state.addJournalEntry);
  const deleteJournalEntry = useAppStore((state) => state.deleteJournalEntry);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [targetKey, setTargetKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const attachments = useMemo(() => journalEntries
    .map(attachmentFromEntry)
    .filter((item): item is AttachmentRecord => Boolean(item))
    .sort((a, b) => b.createdAt - a.createdAt), [journalEntries]);

  const targetOptions = useMemo<TargetOption[]>(() => {
    const options: TargetOption[] = [];
    journalEntries.forEach((entry) => {
      if (isAttachmentEntry(entry) || isReminderEntry(entry) || isGoalEntry(entry)) return;
      if (entry.tags.includes('love-person') || entry.tags.includes('love-checkin') || entry.tags.includes('health-note')) return;
      options.push({ kind: 'journal', id: entry.id, title: entry.title || 'Untitled reflection', route: '/today', detail: `Journal · ${entry.entryDate}` });
    });
    expenses.forEach((expense) => options.push({ kind: 'transaction', id: expense.id, title: expense.title, route: '/money', detail: `Money · ${expense.expenseDate}` }));
    return options.sort((a, b) => b.detail.localeCompare(a.detail) || a.title.localeCompare(b.title));
  }, [expenses, journalEntries]);

  const selectedTarget = targetOptions.find((target) => `${target.kind}:${target.id}` === targetKey);
  const selectedCount = selectedTarget
    ? attachments.filter((attachment) => attachment.target.kind === selectedTarget.kind && attachment.target.id === selectedTarget.id).length
    : 0;

  const chooseFile = () => {
    setNotice('');
    if (!selectedTarget) {
      setNotice('Choose the Journal or Money record first.');
      return;
    }
    if (selectedCount >= MAX_ATTACHMENTS_PER_TARGET) {
      setNotice(`That record already has ${MAX_ATTACHMENTS_PER_TARGET} attachments.`);
      return;
    }
    fileInputRef.current?.click();
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedTarget) return;
    setBusy(true);
    setNotice('');
    try {
      const prepared = await prepareAttachmentFile(file);
      addJournalEntry(attachmentJournalInput({
        ...prepared,
        target: {
          kind: selectedTarget.kind,
          id: selectedTarget.id,
          title: selectedTarget.title,
          route: selectedTarget.route,
        },
      }));
      setNotice('Attachment saved and queued for sync.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Still could not attach that file.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="shell attachments-page">
      <header className="attachments-header">
        <button className="btn-icon" onClick={goBack} type="button" aria-label="Go back"><ArrowLeft size={20} /></button>
        <div><p className="section-kicker">Keep the actual thing</p><h1>Attachments</h1><p className="subtle">Small photos, receipts, and PDFs can stay with the record they belong to.</p></div>
      </header>

      <section className="card attachment-add-card">
        <div className="attachment-add-copy"><Paperclip size={20} /><div><strong>Attach to an existing record</strong><p>Images are compressed before saving. PDFs stay deliberately tiny so sync remains boring.</p></div></div>
        <label><span>Record</span><select onChange={(event) => setTargetKey(event.target.value)} value={targetKey}><option value="">Choose a Journal or Money record</option>{targetOptions.map((target) => <option key={`${target.kind}:${target.id}`} value={`${target.kind}:${target.id}`}>{target.detail} · {target.title}</option>)}</select></label>
        {selectedTarget && <p className="attachment-count-note">{selectedCount} / {MAX_ATTACHMENTS_PER_TARGET} attachments on this record</p>}
        <button className="btn" disabled={busy || !selectedTarget || selectedCount >= MAX_ATTACHMENTS_PER_TARGET} onClick={chooseFile} type="button"><Upload size={17} /> {busy ? 'Preparing…' : 'Choose image or PDF'}</button>
        <input accept="image/*,application/pdf" hidden onChange={(event) => void upload(event)} ref={fileInputRef} type="file" />
        {notice && <p className="attachment-notice" role="status">{notice}</p>}
      </section>

      <section className="attachments-library" aria-labelledby="attachments-library-title">
        <div className="attachments-library-heading"><div><p className="section-kicker">Kept with context</p><h2 id="attachments-library-title">Saved attachments</h2></div><span>{attachments.length}</span></div>
        {attachments.length === 0 ? (
          <div className="attachments-empty"><Paperclip size={26} /><strong>No attachments yet.</strong><span>A receipt or one meaningful photo is enough. This is not trying to become cloud storage.</span></div>
        ) : (
          <div className="attachments-grid">
            {attachments.map((attachment) => (
              <article className="card attachment-card" key={attachment.id}>
                <a className="attachment-preview" href={attachment.dataUrl} rel="noreferrer" target="_blank" aria-label={`Open ${attachment.name}`}>
                  {attachment.mimeType.startsWith('image/') ? <img alt="" src={attachment.dataUrl} /> : <FileText size={30} />}
                </a>
                <div className="attachment-card-copy">
                  <div><span>{attachment.mimeType.startsWith('image/') ? <ImageIcon size={14} /> : <FileText size={14} />}{attachmentSizeLabel(attachment.size)}</span><strong>{attachment.name}</strong></div>
                  <button onClick={() => navigate(attachment.target.route)} type="button">{attachment.target.kind === 'transaction' ? 'Money' : 'Journal'} · {attachment.target.title}</button>
                </div>
                <button className="btn-icon" onClick={() => { if (window.confirm(`Remove “${attachment.name}”?`)) deleteJournalEntry(attachment.id); }} type="button" aria-label={`Remove ${attachment.name}`}><Trash2 size={15} /></button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
