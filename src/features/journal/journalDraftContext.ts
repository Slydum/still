import type { JournalMood } from '../../stores/useAppStore';

export type JournalDraftContext = {
  source: 'check-in';
  answer: string;
  prompt: string;
  suggestedMood?: JournalMood;
};

let pendingJournalDraftContext: JournalDraftContext | undefined;

function checkInJournalPrompt(mood: number, energy: number) {
  if (mood === 1 && energy <= 2) {
    return 'What feels heaviest right now, and what can you gently set down?';
  }

  if (mood === 1 && energy >= 4) {
    return 'What is hurting, and where could your energy help you feel supported?';
  }

  if (mood === 1) {
    return 'What is asking for the most care in your mind right now?';
  }

  if (mood === 2 && energy <= 2) {
    return 'What is helping you feel calm, and what kind of rest would protect it?';
  }

  if (mood === 2 && energy >= 4) {
    return 'Where would you like to direct this clear, calm energy?';
  }

  if (mood === 2) {
    return 'What helped create this sense of calm?';
  }

  if (mood === 3 && energy <= 2) {
    return 'What feels quietly satisfying, even while your body asks for rest?';
  }

  if (mood === 3 && energy >= 4) {
    return 'What would feel meaningful to do with this content, steady energy?';
  }

  if (mood === 3) {
    return 'What would you like to remember about this sense of contentment?';
  }

  if (mood === 4 && energy <= 2) {
    return 'What is bringing you happiness, even at a gentler pace?';
  }

  if (mood === 4 && energy >= 4) {
    return 'Where would you like to carry this happy energy?';
  }

  if (mood === 4) {
    return 'What made this moment feel happy?';
  }

  if (energy <= 2) {
    return 'What are you excited about, and how can you hold that spark without pushing yourself?';
  }

  if (energy >= 4) {
    return 'What would you love to begin with this excited energy?';
  }

  return 'What possibility feels most exciting right now?';
}

function suggestedJournalMood(mood: number): JournalMood {
  if (mood === 1) return 1;
  if (mood === 2) return 3;
  if (mood === 3) return 4;
  if (mood === 4) return 4;
  return 5;
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
    suggestedMood: suggestedJournalMood(mood),
  };
}

export function setPendingJournalDraftContext(context: JournalDraftContext) {
  pendingJournalDraftContext = context;
}

export function peekPendingJournalDraftContext() {
  return pendingJournalDraftContext;
}

export function clearPendingJournalDraftContext() {
  pendingJournalDraftContext = undefined;
}

export function takePendingJournalDraftContext() {
  const context = pendingJournalDraftContext;
  pendingJournalDraftContext = undefined;
  return context;
}
