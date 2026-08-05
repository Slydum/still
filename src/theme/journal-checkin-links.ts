import { format, parseISO } from 'date-fns';
import { selectUpliftingCheckInQuote } from '../content/quoteEngine';
import { listCheckIns } from '../data/stillDb';
import {
  clearPendingJournalDraftContext,
  peekPendingJournalDraftContext,
} from '../features/journal/journalDraftContext';
import { useAppStore, type JournalEntry } from '../stores/useAppStore';
import { createStillContext } from './stillContext';
import './journal-checkin-links.css';

type CheckInSourceSnapshot = {
  date: string;
  answer: string;
};

type LinkedJournalEntry = JournalEntry & {
  checkInSource?: CheckInSourceSnapshot;
};

type ActiveCheckInDraft = CheckInSourceSnapshot;

let activeCheckInDraft: ActiveCheckInDraft | undefined;
let applyingMetadata = false;
let enhancementScheduled = false;

function sourceForEntry(entry: JournalEntry) {
  return (entry as LinkedJournalEntry).checkInSource;
}

function attachSource(entry: JournalEntry, source: CheckInSourceSnapshot): JournalEntry {
  return { ...entry, checkInSource: source } as JournalEntry;
}

function removeSource(entry: JournalEntry): JournalEntry {
  const next = { ...(entry as LinkedJournalEntry) };
  delete next.checkInSource;
  return next;
}

function reflectionForDate(date: string) {
  return [...useAppStore.getState().journalEntries]
    .filter((entry) => {
      const source = sourceForEntry(entry);
      return source?.date === date
        || (!source && entry.entryDate === date && entry.tags.includes('check-in'));
    })
    .sort((left, right) => right.updatedAt - left.updatedAt)[0];
}

function replaceButtonLabel(button: HTMLButtonElement, label: string) {
  const textNode = Array.from(button.childNodes).find((node) => (
    node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim())
  ));

  if (textNode) {
    if (textNode.textContent?.trim() !== label) textNode.textContent = ` ${label}`;
    return;
  }

  button.append(document.createTextNode(` ${label}`));
}

function dateForJournalButton(button: HTMLButtonElement) {
  const historyCard = button.closest<HTMLElement>('.checkin-history-answer-card');
  if (historyCard) {
    return historyCard
      .querySelector<HTMLTimeElement>('.checkin-history-answer-front time[datetime]')
      ?.dateTime;
  }

  if (button.closest('.checkin-answer-back')) {
    return useAppStore.getState().checkInDate;
  }

  return undefined;
}

function enhanceJournalButtons() {
  const buttons = document.querySelectorAll<HTMLButtonElement>(
    '.checkin-journal-button, .checkin-history-answer-actions button.is-primary',
  );

  buttons.forEach((button) => {
    const date = dateForJournalButton(button);
    const reflection = date ? reflectionForDate(date) : undefined;

    if (reflection) {
      button.dataset.linkedReflectionId = reflection.id;
      replaceButtonLabel(button, 'View reflection');
      button.setAttribute('aria-label', `View the reflection linked to ${date}`);
    } else {
      delete button.dataset.linkedReflectionId;
      replaceButtonLabel(button, 'Let it out');
      button.removeAttribute('aria-label');
    }
  });
}

function sortedJournalEntries() {
  return [...useAppStore.getState().journalEntries].sort((left, right) => {
    if (left.entryDate !== right.entryDate) return right.entryDate.localeCompare(left.entryDate);
    return right.createdAt - left.createdAt;
  });
}

function createSourceWidget() {
  const widget = document.createElement('div');
  widget.className = 'journal-checkin-source-widget';

  const toggle = document.createElement('button');
  toggle.className = 'journal-checkin-source-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');

  const label = document.createElement('span');
  label.textContent = 'From your check-in';
  toggle.append(label);

  const panel = document.createElement('div');
  panel.className = 'journal-checkin-source-panel';
  panel.hidden = true;

  const time = document.createElement('time');
  const quote = document.createElement('blockquote');
  panel.append(time, quote);
  widget.append(toggle, panel);

  return widget;
}

function enhanceJournalCards() {
  const page = document.querySelector('.journal-page');
  if (!page) return;

  const entries = sortedJournalEntries();
  const cards = page.querySelectorAll<HTMLElement>('.journal-entry-card');

  cards.forEach((card, index) => {
    const entry = entries[index];
    if (!entry) return;

    card.dataset.journalEntryId = entry.id;
    const source = sourceForEntry(entry);
    let widget = card.querySelector<HTMLElement>('.journal-checkin-source-widget');

    if (!source) {
      widget?.remove();
      return;
    }

    if (!widget) {
      widget = createSourceWidget();
      const body = card.querySelector<HTMLElement>('.journal-entry-body');
      body?.insertAdjacentElement('afterend', widget);
    }

    const sourceKey = `${source.date}:${source.answer}`;
    if (widget.dataset.sourceKey === sourceKey) return;

    widget.dataset.sourceKey = sourceKey;
    const time = widget.querySelector<HTMLTimeElement>('time');
    const quote = widget.querySelector<HTMLQuoteElement>('blockquote');

    if (time) {
      time.dateTime = source.date;
      time.textContent = `Check-in from ${format(parseISO(source.date), 'MMMM d, yyyy')}`;
    }

    if (quote) quote.textContent = source.answer;
  });
}

function enhanceLinkedReflections() {
  enhanceJournalButtons();
  enhanceJournalCards();
}

function queueEnhancement() {
  if (enhancementScheduled || typeof document === 'undefined') return;
  enhancementScheduled = true;

  const run = () => {
    enhancementScheduled = false;
    enhanceLinkedReflections();
  };

  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
  else window.setTimeout(run, 0);
}

function reconcileJournalMetadata(
  currentEntries: JournalEntry[],
  previousEntries: JournalEntry[],
) {
  if (applyingMetadata) return;

  const previousIds = new Set(previousEntries.map((entry) => entry.id));
  const addedEntry = currentEntries.find((entry) => !previousIds.has(entry.id));
  let changed = false;

  const nextEntries = currentEntries.map((entry) => {
    const source = sourceForEntry(entry);

    if (
      addedEntry?.id === entry.id
      && activeCheckInDraft
      && entry.tags.includes('check-in')
      && !source
    ) {
      changed = true;
      return attachSource(entry, activeCheckInDraft);
    }

    if (source && !entry.tags.includes('check-in')) {
      changed = true;
      return removeSource(entry);
    }

    return entry;
  });

  if (addedEntry) {
    activeCheckInDraft = undefined;
    clearPendingJournalDraftContext();
  }

  if (!changed) return;

  applyingMetadata = true;
  useAppStore.setState({ journalEntries: nextEntries });
  applyingMetadata = false;
}

async function migrateLegacyCheckInReflections() {
  try {
    const records = await listCheckIns();
    const recordsByDate = new Map(records.map((record) => [record.date, record]));
    const currentEntries = useAppStore.getState().journalEntries;
    let changed = false;

    const nextEntries = currentEntries.map((entry) => {
      if (sourceForEntry(entry) || !entry.tags.includes('check-in')) return entry;

      const record = recordsByDate.get(entry.entryDate);
      if (!record?.mood || !record.energy) return entry;

      const answer = selectUpliftingCheckInQuote(createStillContext({
        date: parseISO(record.date),
        mood: record.mood,
        energy: record.energy,
      }));

      changed = true;
      return attachSource(entry, { date: record.date, answer });
    });

    if (changed) useAppStore.setState({ journalEntries: nextEntries });
  } catch {
    // Existing reflections remain usable even if IndexedDB is temporarily unavailable.
  }
}

useAppStore.subscribe((state, previousState) => {
  if (
    state.quickAddOpen
    && state.quickAddMode === 'journal'
    && !state.editingJournalId
    && state.journalDraftDate
  ) {
    const context = peekPendingJournalDraftContext();
    if (context) {
      activeCheckInDraft = {
        date: state.journalDraftDate,
        answer: context.answer,
      };
    }
  }

  if (state.journalEntries !== previousState.journalEntries) {
    reconcileJournalMetadata(state.journalEntries, previousState.journalEntries);
  }

  if (previousState.quickAddOpen && !state.quickAddOpen) {
    activeCheckInDraft = undefined;
    clearPendingJournalDraftContext();
  }

  queueEnhancement();
});

if (typeof document !== 'undefined') {
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const journalButton = target.closest<HTMLButtonElement>(
      '.checkin-journal-button, .checkin-history-answer-actions button.is-primary',
    );

    const reflectionId = journalButton?.dataset.linkedReflectionId;
    if (journalButton && reflectionId) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      clearPendingJournalDraftContext();

      const backButton = journalButton.closest('.checkin-answer-back')
        ?.querySelector<HTMLButtonElement>('.checkin-back-button')
        ?? journalButton.closest('.checkin-history-answer-back')
          ?.querySelector<HTMLButtonElement>('.checkin-history-answer-close');

      backButton?.click();
      useAppStore.getState().openJournalEditor(reflectionId);
      return;
    }

    const sourceToggle = target.closest<HTMLButtonElement>('.journal-checkin-source-toggle');
    if (!sourceToggle) return;

    const widget = sourceToggle.closest<HTMLElement>('.journal-checkin-source-widget');
    const panel = widget?.querySelector<HTMLElement>('.journal-checkin-source-panel');
    if (!widget || !panel) return;

    const opening = !widget.classList.contains('is-open');
    widget.classList.toggle('is-open', opening);
    panel.hidden = !opening;
    sourceToggle.setAttribute('aria-expanded', String(opening));
  }, true);

  const observer = new MutationObserver(queueEnhancement);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  queueEnhancement();
  void migrateLegacyCheckInReflections().finally(queueEnhancement);
}
