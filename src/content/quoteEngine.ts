import stillQuotes, { type StillQuote } from './stillQuotes';
import type { EnergyKey, MoodKey, OccasionKey, StillContext, WeatherKey } from '../theme/stillContext';

const weatherTagMap: Record<WeatherKey, string> = {
  'partly-sunny': 'partly-cloudy',
  cloudy: 'cloudy',
  overcast: 'cloudy',
  rain: 'rain',
  thunderstorm: 'storm',
  windy: 'windy',
  rainbow: 'rainbow',
  snow: 'snow',
  fog: 'fog',
  tornado: 'storm',
};

const occasionTagMap: Record<OccasionKey, string> = {
  'new-year': 'new-year',
  'valentines-day': 'valentines-day',
  halloween: 'halloween',
  'easter-spring': 'easter-spring',
  christmas: 'christmas',
  birthday: 'birthday',
  achievement: 'achievement',
};

const upliftingCheckInQuotes: Record<MoodKey, Record<EnergyKey, string>> = {
  sad: {
    empty: "I'm carrying a lot and running on empty, so I need rest and gentleness today.",
    low: "I'm feeling heavy and low on energy, but I can take today one small step at a time.",
    steady: "I'm feeling heavy, but I still have enough steadiness to keep moving gently.",
    bright: "I'm hurting, but I have some energy to care for myself and move toward a lighter moment.",
    full: "I'm feeling sad, yet I have strength in me to face today with tenderness and hope.",
  },
  overwhelmed: {
    empty: "I'm overwhelmed and drained, so I'm letting rest be the most important thing I do today.",
    low: "I'm feeling stretched thin and low on energy, so I'm choosing one manageable thing at a time.",
    steady: "I'm overwhelmed, but I feel steady enough to slow down, breathe, and find my next step.",
    bright: "My mind feels crowded, but I have energy to clear one small space and begin again.",
    full: "I'm overwhelmed, but I have strong energy today, and I can channel it into one clear, kind step.",
  },
  okay: {
    empty: "I'm okay, just very tired, and giving myself room to recharge is enough for today.",
    low: "I'm feeling okay with quiet energy, so I'm moving gently and protecting my pace.",
    steady: "I'm feeling balanced and steady, ready to meet the day as it comes.",
    bright: "I'm grounded and energized, ready to put my attention toward something meaningful.",
    full: "I'm feeling centered and full of energy, ready to make the most of today.",
  },
  good: {
    empty: "I'm feeling good, even though my energy is low, so I'm enjoying the moment and letting myself rest.",
    low: "I'm in a good place with soft energy, and I can let that warmth carry me gently.",
    steady: "I'm feeling good and steady, trusting the rhythm that is working for me.",
    bright: "I'm feeling good and ready, with enough energy to take a joyful step forward.",
    full: "I'm feeling great and full of energy, ready to make today count.",
  },
  loved: {
    empty: "I'm feeling bright inside, even though my body needs rest, so I'm letting joy be gentle today.",
    low: "I'm feeling happy with quiet energy, and I want to protect this softness instead of rushing it.",
    steady: "I'm feeling bright and grounded, ready to share some of that light without draining myself.",
    bright: "I'm feeling joyful and energized, ready to follow what makes me feel alive.",
    full: "I'm feeling radiant and full of possibility, ready to turn this energy into something beautiful.",
  },
};

export const quoteById = new Map(stillQuotes.map((quote) => [quote.id, quote]));

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function scoreQuote(quote: StillQuote, context: StillContext) {
  let score = quote.category === 'everyday' ? 8 : 0;

  if (quote.category === context.timeOfDay) score += 42;

  if (context.occasion) {
    if (quote.category === 'celebrations') score += 70;
    if (quote.tags.includes(occasionTagMap[context.occasion])) score += 110;
  }

  if (context.weather) {
    if (quote.category === 'weather') score += 52;
    if (quote.tags.includes(weatherTagMap[context.weather])) score += 76;
  }

  if (context.mood === 'sad' || context.mood === 'overwhelmed') {
    if (quote.category === 'mood-support') score += 68;
    if (quote.category === 'rest-low-energy') score += 24;
  }

  if (context.mood === 'loved') {
    if (quote.category === 'love-relationships') score += 52;
    if (quote.category === 'mood-support') score += 18;
  }

  if (context.energy === 'empty' || context.energy === 'low') {
    if (quote.category === 'rest-low-energy') score += 72;
    if (quote.category === 'health-self-care') score += 26;
  }

  if (context.energy === 'bright' || context.energy === 'full') {
    if (quote.category === 'work-focus') score += 24;
    if (quote.category === 'health-self-care') score += 12;
  }

  return score;
}

export function selectQuote(
  context: StillContext,
  recentQuoteIds: string[] = [],
  seed = context.dateKey,
): StillQuote {
  const recent = new Set(recentQuoteIds);
  let candidates = stillQuotes.filter((quote) => !recent.has(quote.id));

  if (candidates.length < 12) candidates = stillQuotes;

  const scored = candidates
    .map((quote) => ({ quote, score: scoreQuote(quote, context) }))
    .sort((left, right) => right.score - left.score || left.quote.id.localeCompare(right.quote.id));

  const bestScore = scored[0]?.score ?? 0;
  const topPool = scored
    .filter((item) => item.score >= Math.max(8, bestScore - 12))
    .slice(0, 18);

  const pool = topPool.length ? topPool : scored.slice(0, 18);
  const index = hashString(`${seed}:${context.timeOfDay}:${context.occasion ?? ''}`) % pool.length;
  return pool[index].quote;
}

export function selectUpliftingCheckInQuote(context: StillContext) {
  if (!context.mood || !context.energy) return '';
  return upliftingCheckInQuotes[context.mood][context.energy];
}

export function getSecondaryQuote(context: StillContext, excludeId?: string) {
  const excluded = excludeId ? [excludeId] : [];
  return selectQuote(context, excluded, `${context.dateKey}:secondary`);
}
