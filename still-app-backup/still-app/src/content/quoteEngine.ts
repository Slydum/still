import stillQuotes, { type StillQuote } from './stillQuotes';
import type { OccasionKey, StillContext, WeatherKey } from '../theme/stillContext';

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

export function getSecondaryQuote(context: StillContext, excludeId?: string) {
  const excluded = excludeId ? [excludeId] : [];
  return selectQuote(context, excluded, `${context.dateKey}:secondary`);
}
