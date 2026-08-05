import { addWeeks, format, parseISO, startOfWeek } from 'date-fns';
import { useAppStore, type JournalEntry } from '../stores/useAppStore';
import './weekly-intention.css';

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

type IntentionStatus = 'active' | 'made-space' | 'not-today';
type IntentionSupport = 'yes' | 'a-little' | 'not-really';

type WeeklyIntention = {
  text: string;
  sourceReflectionId: string;
  sourceWeekKey: string;
  targetWeekKey: string;
  status: IntentionStatus;
  createdAt: number;
  updatedAt: number;
  statusUpdatedAt?: number;
  supportResponse?: IntentionSupport;
  supportAnsweredAt?: number;
};

type IntentionJournalEntry = JournalEntry & {
  weeklyReflectionSource?: WeeklyReflectionSource;
  weeklyIntention?: WeeklyIntention;
};

const AUTO_PROMPT_SESSION_KEY = 'still-weekly-intention-prompted-v1';
const SUPPORT_OBSERVATION_PREFIX = 'Your last intention';
let applyingMetadata = false;
let enhancementScheduled = false;

function sourceForEntry(entry: JournalEntry) {
  return (entry as IntentionJournalEntry).weeklyReflectionSource;
}

function intentionForEntry(entry: JournalEntry) {
  return (entry as IntentionJournalEntry).weeklyIntention;
}

function currentWeekKey() {
  return format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function entriesWithIntentions(entries = useAppStore.getState().journalEntries) {
  return entries
    .filter((entry) => Boolean(intentionForEntry(entry)))
    .sort((left, right) => {
      const leftIntention = intentionForEntry(left)!;
      const rightIntention = intentionForEntry(right)!;
      if (leftIntention.targetWeekKey !== rightIntention.targetWeekKey) {
        return rightIntention.targetWeekKey.localeCompare(leftIntention.targetWeekKey);
      }
      return rightIntention.updatedAt - leftIntention.updatedAt;
    });
}

function intentionForTargetWeek(weekKey: string, entries = useAppStore.getState().journalEntries) {
  return entriesWithIntentions(entries).find((entry) => intentionForEntry(entry)?.targetWeekKey === weekKey);
}

function dashboardIntention(entries = useAppStore.getState().journalEntries) {
  const weekKey = currentWeekKey();
  return entriesWithIntentions(entries).find((entry) => {
    const intention = intentionForEntry(entry)!;
    return intention.targetWeekKey >= weekKey;
  });
}

function personalizedSuggestions(source: WeeklyReflectionSource) {
  const words = `${source.summary} ${source.observations.join(' ')}`.toLowerCase();
  const suggestions = [
    'Make space for rest',
    'Keep one steady routine',
    'Use my energy somewhere meaningful',
  ];

  if (/(rest|quiet|slower|tender|gentle)/.test(words)) {
    return suggestions;
  }
  if (/(momentum|energy|bright|forward)/.test(words)) {
    return [suggestions[2], suggestions[1], suggestions[0]];
  }
  return [suggestions[1], suggestions[0], suggestions[2]];
}

function supportObservation(intention: WeeklyIntention) {
  if (intention.supportResponse === 'yes') {
    return `${SUPPORT_OBSERVATION_PREFIX} — “${intention.text}” — felt supportive this week.`;
  }
  if (intention.supportResponse === 'a-little') {
    return `${SUPPORT_OBSERVATION_PREFIX} — “${intention.text}” — helped in a small or partial way.`;
  }
  return `${SUPPORT_OBSERVATION_PREFIX} — “${intention.text}” — did not feel supportive, and noticing that is useful too.`;
}

function updateEntry(entryId: string, update: (entry: IntentionJournalEntry) => IntentionJournalEntry) {
  const state = useAppStore.getState();
  const journalEntries = state.journalEntries.map((entry) => (
    entry.id === entryId ? update(entry as IntentionJournalEntry) as JournalEntry : entry
  ));

  applyingMetadata = true;
  useAppStore.setState({ journalEntries });
  applyingMetadata = false;
  queueEnhancement();
}

function showIntentionToast(message: string) {
  document.querySelector('.weekly-intention-toast')?.remove();
  const toast = element('div', 'weekly-intention-toast', message);
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  document.body.append(toast);

  window.setTimeout(() => {
    toast.classList.add('is-leaving');
    window.setTimeout(() => toast.remove(), 220);
  }, 2500);
}

function saveIntention(entry: JournalEntry, text: string) {
  const source = sourceForEntry(entry);
  if (!source) return;

  const existing = intentionForEntry(entry);
  const now = Date.now();
  const targetWeekKey = format(addWeeks(parseISO(source.weekKey), 1), 'yyyy-MM-dd');

  updateEntry(entry.id, (current) => ({
    ...current,
    weeklyIntention: {
      text: text.trim(),
      sourceReflectionId: entry.id,
      sourceWeekKey: source.weekKey,
      targetWeekKey,
      status: existing?.status ?? 'active',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      statusUpdatedAt: existing?.statusUpdatedAt,
      supportResponse: existing?.supportResponse,
      supportAnsweredAt: existing?.supportAnsweredAt,
    },
  }));

  document.querySelector('.weekly-intention-backdrop')?.remove();
  showIntentionToast(existing ? 'Your intention was updated.' : 'Your intention has a place to land.');
}

function openIntentionComposer(entry: JournalEntry) {
  const source = sourceForEntry(entry);
  if (!source) return;

  document.querySelector('.weekly-intention-backdrop')?.remove();
  const existing = intentionForEntry(entry);
  const backdrop = element('div', 'weekly-intention-backdrop');
  const dialog = element('section', 'weekly-intention-sheet');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'weekly-intention-title');

  const handle = element('div', 'weekly-intention-handle');
  const header = element('div', 'weekly-intention-sheet-header');
  const headerCopy = element('div');
  headerCopy.append(
    element('p', 'section-kicker', 'A gentle intention'),
    element('h2', undefined, 'What would you like to protect next week?'),
    element('p', undefined, 'Choose one small direction. It will never become overdue.'),
  );
  headerCopy.querySelector('h2')!.id = 'weekly-intention-title';
  const close = element('button', 'weekly-intention-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close intention editor');
  header.append(headerCopy, close);

  const form = element('form', 'weekly-intention-form');
  const suggestions = element('div', 'weekly-intention-suggestions');
  suggestions.setAttribute('aria-label', 'Suggested intentions');
  const inputLabel = element('label', 'weekly-intention-field');
  inputLabel.append(element('span', undefined, 'Your intention'));
  const input = element('input');
  input.type = 'text';
  input.maxLength = 120;
  input.placeholder = 'Something gentle you want to protect';
  input.value = existing?.text ?? '';
  inputLabel.append(input);

  personalizedSuggestions(source).forEach((suggestion) => {
    const button = element('button', undefined, suggestion);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(input.value === suggestion));
    button.onclick = () => {
      input.value = suggestion;
      suggestions.querySelectorAll('button').forEach((item) => {
        item.setAttribute('aria-pressed', String(item === button));
      });
      save.disabled = false;
      input.focus();
    };
    suggestions.append(button);
  });

  const actions = element('div', 'weekly-intention-form-actions');
  const cancel = element('button', 'is-secondary', 'Not right now');
  cancel.type = 'button';
  const save = element('button', 'is-primary', existing ? 'Save change' : 'Keep this intention');
  save.type = 'submit';
  save.disabled = !input.value.trim();
  actions.append(cancel, save);
  form.append(suggestions, inputLabel, actions);
  dialog.append(handle, header, form);
  backdrop.append(dialog);
  document.body.append(backdrop);

  const dismiss = () => backdrop.remove();
  close.onclick = dismiss;
  cancel.onclick = dismiss;
  backdrop.onclick = (event) => { if (event.target === backdrop) dismiss(); };
  input.oninput = () => {
    save.disabled = !input.value.trim();
    suggestions.querySelectorAll('button').forEach((item) => item.setAttribute('aria-pressed', 'false'));
  };
  form.onsubmit = (event) => {
    event.preventDefault();
    if (input.value.trim()) saveIntention(entry, input.value);
  };

  window.setTimeout(() => input.focus(), 40);
}

function setIntentionStatus(entryId: string, status: IntentionStatus) {
  updateEntry(entryId, (entry) => {
    if (!entry.weeklyIntention) return entry;
    return {
      ...entry,
      weeklyIntention: {
        ...entry.weeklyIntention,
        status,
        statusUpdatedAt: Date.now(),
        updatedAt: Date.now(),
      },
    };
  });

  if (status === 'made-space') showIntentionToast('You made some room for this. That counts.');
  if (status === 'not-today') showIntentionToast('Not today is allowed.');
}

function buildDashboardIntention(entry: JournalEntry) {
  const intention = intentionForEntry(entry)!;
  const source = sourceForEntry(entry);
  const current = currentWeekKey();
  const card = element('section', 'card weekly-intention-dashboard');
  card.dataset.entryId = entry.id;

  const heading = element('div', 'weekly-intention-dashboard-heading');
  const headingCopy = element('div');
  headingCopy.append(
    element('p', 'section-kicker', intention.targetWeekKey === current ? "This week's intention" : 'For next week'),
    element('h2', undefined, 'One gentle direction'),
  );
  heading.append(headingCopy, element('span', undefined, '✦'));
  card.append(heading, element('blockquote', undefined, intention.text));

  if (source) {
    const sourceButton = element('button', 'weekly-intention-source-link', `From your weekly reflection · ${source.dateLabel}`);
    sourceButton.type = 'button';
    sourceButton.onclick = () => useAppStore.getState().openJournalEditor(entry.id);
    card.append(sourceButton);
  }

  const actions = element('div', 'weekly-intention-dashboard-actions');
  if (intention.status === 'active') {
    const madeSpace = element('button', 'is-primary', 'I made space for this');
    madeSpace.type = 'button';
    madeSpace.onclick = () => setIntentionStatus(entry.id, 'made-space');
    const notToday = element('button', undefined, 'Not today');
    notToday.type = 'button';
    notToday.onclick = () => setIntentionStatus(entry.id, 'not-today');
    actions.append(madeSpace, notToday);
  } else {
    const message = element(
      'p',
      'weekly-intention-status',
      intention.status === 'made-space'
        ? 'You made some room for this. That counts.'
        : 'Not today is allowed. This can wait without becoming overdue.',
    );
    card.append(message);

    if (intention.status === 'not-today') {
      const returnButton = element('button', undefined, 'Return when ready');
      returnButton.type = 'button';
      returnButton.onclick = () => setIntentionStatus(entry.id, 'active');
      actions.append(returnButton);
    }
  }

  const change = element('button', 'is-quiet', 'Change intention');
  change.type = 'button';
  change.onclick = () => openIntentionComposer(entry);
  actions.append(change);
  card.append(actions);
  return card;
}

function renderDashboardIntention() {
  const dashboard = document.querySelector('.dashboard-v2');
  const anchor = dashboard?.querySelector('.dashboard-two-column');
  if (!dashboard || !anchor) return;

  const entry = dashboardIntention();
  const current = dashboard.querySelector<HTMLElement>('.weekly-intention-dashboard');
  if (!entry) {
    current?.remove();
    return;
  }

  const intention = intentionForEntry(entry)!;
  const renderKey = JSON.stringify({
    entryId: entry.id,
    text: intention.text,
    status: intention.status,
    target: intention.targetWeekKey,
    updated: intention.updatedAt,
  });
  if (current?.dataset.renderKey === renderKey) return;

  const next = buildDashboardIntention(entry);
  next.dataset.renderKey = renderKey;
  current?.remove();
  anchor.insertAdjacentElement('beforebegin', next);
}

function answerSupport(entry: JournalEntry, response: IntentionSupport) {
  updateEntry(entry.id, (current) => {
    if (!current.weeklyIntention) return current;
    return {
      ...current,
      weeklyIntention: {
        ...current.weeklyIntention,
        supportResponse: response,
        supportAnsweredAt: Date.now(),
        updatedAt: Date.now(),
      },
    };
  });
  showIntentionToast('Thank you for noticing what helped.');
}

function renderSupportFollowUp() {
  const card = document.querySelector<HTMLElement>('.checkin-history-page .weekly-reflection-card');
  if (!card || card.querySelector('.weekly-reflection-empty')) return;

  const weekKey = card.dataset.weekKey;
  if (!weekKey) return;
  const entry = intentionForTargetWeek(weekKey);
  const intention = entry ? intentionForEntry(entry) : undefined;
  const current = card.querySelector<HTMLElement>('.weekly-intention-support');

  if (!entry || !intention || intention.supportResponse) {
    current?.remove();
    renderSupportObservation(card, intention);
    return;
  }

  if (current?.dataset.entryId === entry.id && current.dataset.text === intention.text) return;
  current?.remove();

  const followUp = element('fieldset', 'weekly-intention-support');
  followUp.dataset.entryId = entry.id;
  followUp.dataset.text = intention.text;
  const legend = element('legend', undefined, 'Did this intention support you?');
  const quote = element('blockquote', undefined, intention.text);
  const choices = element('div', 'weekly-intention-support-choices');
  const options: Array<{ value: IntentionSupport; label: string }> = [
    { value: 'yes', label: 'Yes, it did' },
    { value: 'a-little', label: 'A little' },
    { value: 'not-really', label: 'Not really' },
  ];
  options.forEach((option) => {
    const button = element('button', undefined, option.label);
    button.type = 'button';
    button.onclick = () => answerSupport(entry, option.value);
    choices.append(button);
  });
  followUp.append(legend, quote, choices);
  card.append(followUp);
}

function renderSupportObservation(card: HTMLElement, intention?: WeeklyIntention) {
  const list = card.querySelector('.weekly-reflection-observations');
  if (!list) return;
  const current = list.querySelector<HTMLElement>('.weekly-intention-support-observation');
  if (!intention?.supportResponse) {
    current?.remove();
    return;
  }

  const text = supportObservation(intention);
  if (current?.textContent === text) return;
  current?.remove();
  const item = element('li', 'weekly-intention-support-observation', text);
  list.append(item);
}

function enhanceJournalIntentionLinks() {
  const page = document.querySelector('.journal-page');
  if (!page) return;

  const entries = [...useAppStore.getState().journalEntries].sort((left, right) => {
    if (left.entryDate !== right.entryDate) return right.entryDate.localeCompare(left.entryDate);
    return right.createdAt - left.createdAt;
  });
  const cards = page.querySelectorAll<HTMLElement>('.journal-entry-card');

  cards.forEach((card, index) => {
    const entry = entries[index];
    const intention = entry ? intentionForEntry(entry) : undefined;
    const current = card.querySelector<HTMLElement>('.journal-weekly-intention-line');
    if (!intention) {
      current?.remove();
      return;
    }

    const text = `Intention for ${format(parseISO(intention.targetWeekKey), 'MMM d')}: ${intention.text}`;
    if (current?.dataset.updated === String(intention.updatedAt)) return;
    current?.remove();
    const line = element('div', 'journal-weekly-intention-line');
    line.dataset.updated = String(intention.updatedAt);
    line.append(element('span', undefined, '✦'), element('p', undefined, text));
    const widget = card.querySelector('.journal-weekly-source-widget');
    widget?.insertAdjacentElement('afterend', line);
  });
}

function appendSupportObservationToNewReflection(
  currentEntries: JournalEntry[],
  previousEntries: JournalEntry[],
) {
  const previousById = new Map(previousEntries.map((entry) => [entry.id, entry]));
  let changed = false;
  const journalEntries = currentEntries.map((entry) => {
    const source = sourceForEntry(entry);
    const previousSource = sourceForEntry(previousById.get(entry.id) ?? entry);
    if (!source || previousSource) return entry;

    const priorIntentionEntry = intentionForTargetWeek(source.weekKey, currentEntries);
    const priorIntention = priorIntentionEntry ? intentionForEntry(priorIntentionEntry) : undefined;
    if (!priorIntention?.supportResponse) return entry;

    const observation = supportObservation(priorIntention);
    if (source.observations.some((item) => item.startsWith(SUPPORT_OBSERVATION_PREFIX))) return entry;
    changed = true;
    return {
      ...entry,
      weeklyReflectionSource: {
        ...source,
        observations: [...source.observations, observation],
      },
    } as JournalEntry;
  });

  if (!changed) return currentEntries;
  applyingMetadata = true;
  useAppStore.setState({ journalEntries });
  applyingMetadata = false;
  return journalEntries;
}

function maybePromptForNewReflection(currentEntries: JournalEntry[], previousEntries: JournalEntry[]) {
  const previousById = new Map(previousEntries.map((entry) => [entry.id, entry]));
  const entry = currentEntries.find((item) => {
    const source = sourceForEntry(item);
    const previousSource = sourceForEntry(previousById.get(item.id) ?? item);
    return Boolean(source && !previousSource && !intentionForEntry(item) && Date.now() - item.createdAt < 12_000);
  });
  if (!entry) return;

  const prompted = sessionStorage.getItem(AUTO_PROMPT_SESSION_KEY);
  if (prompted === entry.id) return;
  sessionStorage.setItem(AUTO_PROMPT_SESSION_KEY, entry.id);
  window.setTimeout(() => openIntentionComposer(entry), 260);
}

function enhance() {
  renderDashboardIntention();
  renderSupportFollowUp();
  enhanceJournalIntentionLinks();
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
  if (!applyingMetadata && state.journalEntries !== previousState.journalEntries) {
    const entries = appendSupportObservationToNewReflection(state.journalEntries, previousState.journalEntries);
    maybePromptForNewReflection(entries, previousState.journalEntries);
  }
  queueEnhancement();
});

if (typeof document !== 'undefined') {
  const observer = new MutationObserver(queueEnhancement);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  queueEnhancement();
}
