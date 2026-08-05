import type { JournalMood } from '../../stores/useAppStore';

export type JournalDraftContext = {
  source: 'check-in';
  answer: string;
  prompt: string;
  suggestedMood?: JournalMood;
};

let pendingJournalDraftContext: JournalDraftContext | undefined;

function checkInJournalPrompt(mood: number, energy: number) {
  if (mood <= 2 && energy <= 2) {
    return 'What feels heaviest right now, and what can you gently set down?';
  }

  if (mood <= 2 && energy >= 4) {
    return 'What is weighing on you, and where could your energy help you feel supported?';
  }

  if (mood <= 2) {
    return 'What is asking for the most space in your mind right now?';
  }

  if (mood === 3 && energy <= 2) {
    return 'What are you noticing beneath the tiredness?';
  }

  if (mood === 3 && energy >= 4) {
    return 'What would feel meaningful to do with the energy you have?';
  }

  if (mood === 3) {
    return 'What are you noticing beneath the surface?';
  }

  if (energy <= 2) {
    return 'What is helping you feel this warmth, even at a gentler pace?';
  }

  if (energy >= 4) {
    return 'Where would you like to direct this good energy?';
  }

  return 'What would you like to remember about this feeling?';
}

export function createCheckInJournalDraft(
  answer: string,
  mood: number,
  energy: number,
): JournalDraftContext {
  return {
    source: 'check-in',
    answer,
    prompt: checkInJournalPrompt(mood, energy),
    suggestedMood: Math.min(5, Math.max(1, mood)) as JournalMood,
  };
}

export function setPendingJournalDraftContext(context: JournalDraftContext) {
  pendingJournalDraftContext = context;
}

export function takePendingJournalDraftContext() {
  const context = pendingJournalDraftContext;
  pendingJournalDraftContext = undefined;
  return context;
}
