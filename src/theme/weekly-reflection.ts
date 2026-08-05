import {
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfWeek,
} from 'date-fns';
import { getCheckInAnswer } from '../features/check-ins/checkInScale';
import { listCheckIns, type CheckInRecord } from '../data/stillDb';
import { useAppStore, type JournalEntry } from '../stores/useAppStore';
import { getLocalDateKey } from './stillContext';
import './weekly-reflection.css';

type WeeklyReflectionSource = {
  weekKey: string;
  startDate: string;
  endDate: string;
  dateLabel: string;
  summary: string;
  observations: string[];
  prompt: string;
  checkInDates: string[];
};

type WeeklyJournalEntry = JournalEntry & {
  weeklyReflectionSource?: WeeklyReflectionSource;
  checkInSource?: { date: string; answer: string };
};

type WeeklyReflectionModel = WeeklyReflectionSource & {
  checkInCount: number;
  reflectionCount: number;
};

const MINIMUM_CHECK_INS = 3;
const WEEKLY_TAG = 'weekly-reflection';
let activeWeeklyDraft: WeeklyReflectionSource | undefined;
let applyingWeeklyMetadata = false;
let enhancementScheduled = false;
let recordsLoading = false;
let recordsLoaded = false;
let cachedRecords: CheckInRecord[] = [];
let lastRecordLoad = 0;

function sourceForEntry(entry: JournalEntry) {
  return (entry as WeeklyJournalEntry).weeklyReflectionSource;
}

function average(values: number[]) {
  if (!values.length) return undefined;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function dateLabel(startDate: string, endDate: string) {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  return isSameMonth(start, end)
    ? `${format(start, 'MMM d')}–${format(end, 'd')}`
    : `${format(start, 'MMM d')}–${format(end, 'MMM d')}`;
}

function answerForRecord(record: CheckInRecord) {
  if (!record.mood || !record.energy) return '';
  return record.answerSnapshot ?? getCheckInAnswer(record.mood, record.energy);
}

function checkInReflectionsWithin(entries: JournalEntry[], startDate: string, endDate: string) {
  return entries.filter((entry) => {
    const linkedDate = (entry as WeeklyJournalEntry).checkInSource?.date;
    const date = linkedDate ?? (entry.tags.includes('check-in') ? entry.entryDate : undefined);
    return Boolean(date && date >= startDate && date <= endDate);
  });
}

function moodObservation(records: CheckInRecord[]) {
  const moods = records.flatMap((record) => record.mood ? [record.mood] : []);
  const midpoint = Math.ceil(moods.length / 2);
  const early = average(moods.slice(0, midpoint));
  const later = average(moods.slice(midpoint));
  const overall = average(moods);

  if (early !== undefined && later !== undefined && later - early >= 0.7) {
    return 'More happiness or excitement appeared as the week moved forward.';
  }
  if (early !== undefined && later !== undefined && early - later >= 0.7) {
    return 'The later part of the week felt quieter or more tender.';
  }
  if (overall !== undefined && overall < 1.5) {
    return 'Sadness was present across several days, asking for extra gentleness.';
  }
  if (overall !== undefined && overall < 2.75) {
    return 'Calmer and quieter feelings shaped much of the week.';
  }
  if (overall !== undefined && overall >= 4) {
    return 'Happiness and excitement showed up more often this week.';
  }
  return 'Contentment and steady warmth appeared across much of the week.';
}

function energyObservation(records: CheckInRecord[]) {
  const levels = records.flatMap((record) => record.energy ? [record.energy] : []);
  const midpoint = Math.ceil(levels.length / 2);
  const early = average(levels.slice(0, midpoint));
  const later = average(levels.slice(midpoint));
  const overall = average(levels);

  if (early !== undefined && later !== undefined && later - early >= 0.7) {
    return 'More energy became available as the week moved forward.';
  }
  if (early !== undefined && later !== undefined && early - later >= 0.7) {
    return 'Your energy softened toward the later part of the week.';
  }
  if (overall !== undefined && overall < 2.5) {
    return 'Your energy asked for a quieter, more restorative pace.';
  }
  if (overall !== undefined && overall >= 3.75) {
    return 'More momentum was available across much of the week.';
  }
  return 'Your energy stayed fairly balanced even as the days changed.';
}

function answerThemeObservation(records: CheckInRecord[]) {
  const answers = records.map(answerForRecord).join(' ').toLowerCase();
  const themes = [
    {
      score: ['rest', 'gentle', 'quiet', 'slow', 'exhausted'].filter((word) => answers.includes(word)).length,
      text: 'Across your answers, rest and gentleness kept returning as something worth protecting.',
    },
    {
      score: ['calm', 'content', 'balanced', 'steady'].filter((word) => answers.includes(word)).length,
      text: 'Across your answers, calm, contentment, and balance kept returning as quiet anchors.',
    },
    {
      score: ['excited', 'energized', 'momentum', 'happy', 'bright'].filter((word) => answers.includes(word)).length,
      text: 'Across your answers, happiness, possibility, and forward movement kept finding their way in.',
    },
  ].sort((left, right) => right.score - left.score);

  return themes[0].score > 0
    ? themes[0].text
    : 'Your answers made room for the week as it was, without asking it to be one thing.';
}

function summaryFor(records: CheckInRecord[]) {
  const mood = average(records.flatMap((record) => record.mood ? [record.mood] : []));
  const energy = average(records.flatMap((record) => record.energy ? [record.energy] : []));

  const feeling = mood === undefined
    ? 'still unfolding'
    : mood < 1.5
      ? 'emotionally tender'
      : mood < 2.75
        ? 'quieter and calmer'
        : mood >= 4
          ? 'happier and more excited'
          : 'content and mostly grounded';

  const pace = energy === undefined
    ? 'still finding its rhythm'
    : energy < 2.5
      ? 'asking for a slower pace'
      : energy >= 3.75
        ? 'carrying more momentum'
        : 'moving with balanced energy';

  return `Your check-ins held a week that felt ${feeling} while ${pace}. Nothing here needs to be graded—only noticed.`;
}

function buildWeeklyModel(records: CheckInRecord[], entries: JournalEntry[]): WeeklyReflectionModel {
  const now = new Date();
  const startDate = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const endDate = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const completeRecords = records
    .filter((record) => record.date >= startDate && record.date <= endDate && record.mood && record.energy)
    .sort((left, right) => left.date.localeCompare(right.date));
  const reflectionCount = checkInReflectionsWithin(entries, startDate, endDate).length;

  const observations = [
    moodObservation(completeRecords),
    energyObservation(completeRecords),
    reflectionCount > 0
      ? `You made space to reflect ${reflectionCount === 1 ? 'once' : `${reflectionCount} times`} alongside your check-ins.`
      : answerThemeObservation(completeRecords),
  ];

  return {
    weekKey: startDate,
    startDate,
    endDate,
    dateLabel: dateLabel(startDate, endDate),
    summary: summaryFor(completeRecords),
    observations,
    prompt: 'What helped you feel more like yourself this week?',
    checkInDates: completeRecords.map((record) => record.date),
    checkInCount: completeRecords.length,
    reflectionCount,
  };
}

function weeklyReflectionFor(weekKey: string) {
  return [...useAppStore.getState().journalEntries]
    .filter((entry) => sourceForEntry(entry)?.weekKey === weekKey)
    .sort((left, right) => right.updatedAt - left.updatedAt)[0];
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function openWeeklyReflection(model: WeeklyReflectionModel) {
  const existing = weeklyReflectionFor(model.weekKey);
  if (existing) {
    activeWeeklyDraft = undefined;
    useAppStore.getState().openJournalEditor(existing.id);
    return;
  }

  activeWeeklyDraft = {
    weekKey: model.weekKey,
    startDate: model.startDate,
    endDate: model.endDate,
    dateLabel: model.dateLabel,
    summary: model.summary,
    observations: [...model.observations],
    prompt: model.prompt,
    checkInDates: [...model.checkInDates],
  };
  useAppStore.getState().openJournalEditor(undefined, getLocalDateKey());
}

function buildWeeklyCard(model: WeeklyReflectionModel) {
  const section = element('section', 'card weekly-reflection-card');
  section.dataset.weekKey = model.weekKey;

  const heading = element('div', 'weekly-reflection-heading');
  const headingCopy = element('div');
  const kicker = element('p', 'section-kicker', 'Your week, gently');
  const title = element('h2', undefined, model.dateLabel);
  headingCopy.append(kicker, title);
  const count = element(
    'span',
    'weekly-reflection-count',
    `${model.checkInCount} ${model.checkInCount === 1 ? 'check-in' : 'check-ins'}`,
  );
  heading.append(headingCopy, count);
  section.append(heading);

  if (model.checkInCount < MINIMUM_CHECK_INS) {
    const empty = element('div', 'weekly-reflection-empty');
    const icon = element('span', undefined, '🌱');
    const copy = element('div');
    copy.append(
      element('strong', undefined, 'Your week is still taking shape'),
      element(
        'p',
        undefined,
        'When a few days have been checked in, Still can reflect the pattern back without turning it into a score.',
      ),
    );
    empty.append(icon, copy);
    section.append(empty);
    return section;
  }

  section.append(element('p', 'weekly-reflection-summary', model.summary));

  const observations = element('ul', 'weekly-reflection-observations');
  model.observations.forEach((observation) => {
    observations.append(element('li', undefined, observation));
  });
  section.append(observations);

  const prompt = element('blockquote', 'weekly-reflection-prompt', model.prompt);
  section.append(prompt);

  const existing = weeklyReflectionFor(model.weekKey);
  const action = element(
    'button',
    `weekly-reflection-action${existing ? ' is-existing' : ''}`,
    existing ? 'View weekly reflection' : 'Reflect on this week',
  );
  action.type = 'button';
  action.onclick = () => openWeeklyReflection(model);
  section.append(action);

  return section;
}

function renderWeeklySection() {
  const page = document.querySelector('.checkin-history-page');
  const listSection = page?.querySelector('.checkin-history-list-section');
  if (!page || !listSection || !recordsLoaded) return;

  const model = buildWeeklyModel(cachedRecords, useAppStore.getState().journalEntries);
  const dataKey = JSON.stringify({
    weekKey: model.weekKey,
    count: model.checkInCount,
    reflections: model.reflectionCount,
    existing: weeklyReflectionFor(model.weekKey)?.id,
    updated: cachedRecords.map((record) => record.updatedAt),
  });
  const current = page.querySelector<HTMLElement>('.weekly-reflection-card');
  if (current?.dataset.renderKey === dataKey) return;

  const next = buildWeeklyCard(model);
  next.dataset.renderKey = dataKey;
  current?.remove();
  listSection.insertAdjacentElement('beforebegin', next);
}

async function refreshRecords() {
  if (recordsLoading) return;
  recordsLoading = true;
  try {
    cachedRecords = await listCheckIns();
    recordsLoaded = true;
    lastRecordLoad = Date.now();
  } catch {
    recordsLoaded = true;
  } finally {
    recordsLoading = false;
    renderWeeklySection();
  }
}

function ensureRecords() {
  if (!document.querySelector('.checkin-history-page')) return;
  if (!recordsLoaded || Date.now() - lastRecordLoad > 900) void refreshRecords();
}

function createEditorContext(source: WeeklyReflectionSource) {
  const aside = element('aside', 'journal-weekly-context');
  aside.dataset.weekKey = source.weekKey;

  const label = element('div', 'journal-weekly-context-label');
  label.append(element('span', undefined, '✦'), element('strong', undefined, `Your week, gently · ${source.dateLabel}`));
  aside.append(label, element('p', 'journal-weekly-context-summary', source.summary));

  const list = element('ul');
  source.observations.forEach((observation) => list.append(element('li', undefined, observation)));
  aside.append(list, element('blockquote', undefined, source.prompt));
  return aside;
}

function replaceVisibleText(node: HTMLElement, text: string) {
  const textNode = Array.from(node.childNodes).find((child) => (
    child.nodeType === Node.TEXT_NODE && Boolean(child.textContent?.trim())
  ));
  if (textNode) textNode.textContent = text;
  else node.append(document.createTextNode(text));
}

function enhanceWeeklyEditor() {
  const form = document.querySelector<HTMLFormElement>('.journal-editor');
  if (!form || !activeWeeklyDraft || useAppStore.getState().editingJournalId) return;

  let context = form.querySelector<HTMLElement>('.journal-weekly-context');
  if (!context || context.dataset.weekKey !== activeWeeklyDraft.weekKey) {
    context?.remove();
    context = createEditorContext(activeWeeklyDraft);
    const dateField = form.querySelector('.compact-date-field');
    dateField?.insertAdjacentElement('beforebegin', context);
  }

  const textarea = form.querySelector<HTMLTextAreaElement>('textarea[required]');
  if (textarea && textarea.placeholder !== activeWeeklyDraft.prompt) {
    textarea.placeholder = activeWeeklyDraft.prompt;
  }

  const saveButton = form.querySelector<HTMLButtonElement>('.task-primary-button');
  if (saveButton) replaceVisibleText(saveButton, 'Save weekly reflection');

  const heading = document.querySelector<HTMLElement>('.task-sheet-heading');
  const title = heading?.querySelector('h2');
  const subtitle = heading?.querySelector('p.subtle');
  if (title) title.textContent = 'Weekly reflection';
  if (subtitle) subtitle.textContent = 'Write what this week helped you notice.';
}

function weeklySourceWidget(source: WeeklyReflectionSource) {
  const widget = element('div', 'journal-weekly-source-widget');
  widget.dataset.weekKey = source.weekKey;

  const toggle = element('button', 'journal-weekly-source-toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.textContent = `Weekly reflection · ${source.dateLabel}`;

  const panel = element('div', 'journal-weekly-source-panel');
  panel.hidden = true;
  panel.append(element('p', undefined, source.summary));
  const list = element('ul');
  source.observations.forEach((observation) => list.append(element('li', undefined, observation)));
  panel.append(list);
  widget.append(toggle, panel);
  return widget;
}

function enhanceJournalCards() {
  const page = document.querySelector('.journal-page');
  if (!page) return;

  const entries = [...useAppStore.getState().journalEntries].sort((left, right) => {
    if (left.entryDate !== right.entryDate) return right.entryDate.localeCompare(left.entryDate);
    return right.createdAt - left.createdAt;
  });
  const cards = page.querySelectorAll<HTMLElement>('.journal-entry-card');

  cards.forEach((card, index) => {
    const entry = entries[index];
    const source = entry ? sourceForEntry(entry) : undefined;
    const existing = card.querySelector<HTMLElement>('.journal-weekly-source-widget');

    if (!source) {
      existing?.remove();
      return;
    }

    if (existing?.dataset.weekKey === source.weekKey) return;
    existing?.remove();
    const widget = weeklySourceWidget(source);
    const titleRow = card.querySelector('.journal-entry-title-row');
    titleRow?.insertAdjacentElement('afterend', widget);
  });
}

function rewriteWeeklyToast() {
  const toast = document.querySelector<HTMLElement>('.still-toast');
  if (!toast) {
    window.setTimeout(rewriteWeeklyToast, 40);
    return;
  }
  replaceVisibleText(toast, 'You made space for your week.');
}

function reconcileWeeklyMetadata(currentEntries: JournalEntry[], previousEntries: JournalEntry[]) {
  if (applyingWeeklyMetadata || !activeWeeklyDraft) return;

  const previousIds = new Set(previousEntries.map((entry) => entry.id));
  const added = currentEntries.find((entry) => !previousIds.has(entry.id));
  if (!added) return;

  const source = activeWeeklyDraft;
  activeWeeklyDraft = undefined;
  const nextEntries = currentEntries.map((entry) => entry.id === added.id
    ? {
        ...entry,
        tags: Array.from(new Set([...entry.tags.filter((tag) => tag !== 'check-in'), WEEKLY_TAG])),
        weeklyReflectionSource: source,
      } as JournalEntry
    : entry);

  applyingWeeklyMetadata = true;
  useAppStore.setState({ journalEntries: nextEntries });
  applyingWeeklyMetadata = false;
  window.setTimeout(rewriteWeeklyToast, 0);
}

function enhance() {
  ensureRecords();
  renderWeeklySection();
  enhanceWeeklyEditor();
  enhanceJournalCards();
}

function queueEnhancement() {
  if (enhancementScheduled || typeof document === 'undefined') return;
  enhancementScheduled = true;
  window.requestAnimationFrame(() => {
    enhancementScheduled = false;
    enhance();
  });
}

useAppStore.subscribe((state, previousState) => {
  if (state.journalEntries !== previousState.journalEntries) {
    reconcileWeeklyMetadata(state.journalEntries, previousState.journalEntries);
  }

  if (previousState.quickAddOpen && !state.quickAddOpen && activeWeeklyDraft) {
    activeWeeklyDraft = undefined;
  }

  queueEnhancement();
});

if (typeof document !== 'undefined') {
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const toggle = target.closest<HTMLButtonElement>('.journal-weekly-source-toggle');
    if (!toggle) return;

    const widget = toggle.closest<HTMLElement>('.journal-weekly-source-widget');
    const panel = widget?.querySelector<HTMLElement>('.journal-weekly-source-panel');
    if (!widget || !panel) return;

    const opening = !widget.classList.contains('is-open');
    widget.classList.toggle('is-open', opening);
    panel.hidden = !opening;
    toggle.setAttribute('aria-expanded', String(opening));
  });

  const observer = new MutationObserver(queueEnhancement);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  queueEnhancement();
}
