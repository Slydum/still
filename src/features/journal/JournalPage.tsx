import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { BookOpen, FileText, Paperclip, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { attachmentFromEntry, isAttachmentEntry } from '../../domain/attachments';
import { isReminderEntry } from '../../domain/reminders';
import { useAppStore, type JournalMood } from '../../stores/useAppStore';
import { getLocalDateKey } from '../../theme/stillContext';
import './journal-attachments.css';

const writingPrompts = [
  'What felt quietly meaningful today?',
  'What are you carrying that could be set down?',
  'Where did you notice a little ease today?',
  'What deserves more of your attention tomorrow?',
  'What did this day teach you about what you need?',
  'Name one moment you would like to remember.',
  'What would kindness toward yourself look like right now?',
];

const moodDetails: Record<JournalMood, { emoji: string; label: string }> = {
  1: { emoji: '🌧️', label: 'Heavy' },
  2: { emoji: '🌫️', label: 'Low' },
  3: { emoji: '🌿', label: 'Steady' },
  4: { emoji: '🌤️', label: 'Good' },
  5: { emoji: '✨', label: 'Bright' },
};

function dateHeading(dateKey: string) {
  const date = parseISO(dateKey);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEEE, MMMM d, yyyy');
}

export function JournalPage() {
  const allEntries = useAppStore((state) => state.journalEntries);
  const entries = useMemo(() => allEntries.filter((entry) =>
    !entry.tags.includes('love-person')
    && !entry.tags.includes('love-checkin')
    && !entry.tags.includes('health-note')
    && !entry.tags.includes('still-goal')
    && !isReminderEntry(entry)
    && !isAttachmentEntry(entry)), [allEntries]);
  const attachmentsByTarget = useMemo(() => {
    const map = new Map<string, ReturnType<typeof attachmentFromEntry>[]>();
    allEntries.forEach((entry) => {
      const attachment = attachmentFromEntry(entry);
      if (!attachment || attachment.target.kind !== 'journal') return;
      const current = map.get(attachment.target.id) ?? [];
      current.push(attachment);
      map.set(attachment.target.id, current);
    });
    return map;
  }, [allEntries]);
  const openJournalEditor = useAppStore((state) => state.openJournalEditor);
  const deleteJournalEntry = useAppStore((state) => state.deleteJournalEntry);
  const todayKey = getLocalDateKey();
  const dailyPrompt = writingPrompts[Number(todayKey.replaceAll('-', '')) % writingPrompts.length];

  const groups = useMemo(() => {
    const sorted = [...entries].sort((left, right) => {
      if (left.entryDate !== right.entryDate) return right.entryDate.localeCompare(left.entryDate);
      return right.createdAt - left.createdAt;
    });
    return Array.from(sorted.reduce((grouped, entry) => {
      const existing = grouped.get(entry.entryDate) ?? [];
      existing.push(entry);
      grouped.set(entry.entryDate, existing);
      return grouped;
    }, new Map<string, typeof sorted>()).entries());
  }, [entries]);

  return (
    <main className="shell journal-page">
      <header className="journal-page-header">
        <div><p className="section-kicker">Your inner weather</p><h1>Journal</h1><p className="subtle">A quiet place for what you’re noticing.</p></div>
        <button className="btn" onClick={() => openJournalEditor()} type="button"><Plus size={18} /> New entry</button>
      </header>
      <section className="journal-prompt-card" aria-labelledby="journal-prompt-title">
        <span className="journal-prompt-icon" aria-hidden="true"><Sparkles size={19} /></span>
        <div><p className="section-kicker" id="journal-prompt-title">Today’s prompt</p><blockquote>{dailyPrompt}</blockquote></div>
        <button className="btn btn-secondary btn-compact" onClick={() => openJournalEditor(undefined, todayKey)} type="button">Write</button>
      </section>
      <section className="journal-history" aria-labelledby="journal-history-title">
        <div className="journal-history-heading"><div><p className="section-kicker">Your reflections</p><h2 id="journal-history-title">Journal history</h2></div><span>{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span></div>
        {groups.length === 0 ? (
          <button className="journal-empty" onClick={() => openJournalEditor()} type="button"><BookOpen size={30} /><strong>Your first page is open</strong><span>Write a few honest words. They don’t need to be polished.</span></button>
        ) : (
          <div className="journal-groups">
            {groups.map(([dateKey, dateEntries]) => (
              <section className="journal-date-group" key={dateKey}>
                <div className="journal-date-heading"><h3>{dateHeading(dateKey)}</h3><span>{dateEntries.length} {dateEntries.length === 1 ? 'entry' : 'entries'}</span></div>
                <div className="journal-entry-list">
                  {dateEntries.map((entry) => {
                    const mood = entry.mood ? moodDetails[entry.mood] : undefined;
                    const attachments = (attachmentsByTarget.get(entry.id) ?? []).filter(Boolean);
                    return (
                      <article className="card journal-entry-card" key={entry.id}>
                        <div className="journal-entry-content">
                          <div className="journal-entry-title-row"><div><h4>{entry.title || 'Untitled reflection'}</h4><time dateTime={new Date(entry.createdAt).toISOString()}>{format(new Date(entry.createdAt), 'h:mm a')}</time></div>{mood && <span className="journal-entry-mood" title={mood.label}>{mood.emoji} {mood.label}</span>}</div>
                          <p className="journal-entry-body">{entry.body}</p>
                          {entry.tags.length > 0 && <div className="journal-entry-tags" aria-label="Tags">{entry.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
                          {attachments.length > 0 && (
                            <div className="journal-entry-attachments" aria-label="Attachments">
                              {attachments.map((attachment) => attachment && (
                                <a href={attachment.dataUrl} key={attachment.id} rel="noreferrer" target="_blank" title={attachment.name}>
                                  {attachment.mimeType.startsWith('image/') ? <img alt="" src={attachment.dataUrl} /> : <FileText size={18} />}
                                  <span><Paperclip size={12} />{attachment.name}</span>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="journal-entry-actions">
                          <button className="btn-icon" onClick={() => openJournalEditor(entry.id)} type="button" aria-label={`Edit ${entry.title || 'journal entry'}`}><Pencil size={16} /></button>
                          <button className="btn-icon" onClick={() => { if (window.confirm('Delete this journal entry?')) deleteJournalEntry(entry.id); }} type="button" aria-label={`Delete ${entry.title || 'journal entry'}`}><Trash2 size={16} /></button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
