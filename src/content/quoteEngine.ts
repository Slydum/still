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
    empty: 'You do not have to carry everything today; resting is still a way forward.',
    low: 'Go gently—one small breath and one small step are enough for now.',
    steady: 'Even with a heavy heart, your steady strength is still carrying you.',
    bright: 'Your feelings can be heavy and your courage can still move with you.',
    full: 'There is strength in you today, even while your heart asks for tenderness.',
  },
  overwhelmed: {
    empty: 'This low moment is not the whole story; let rest be the first hopeful step.',
    low: 'You are allowed to move slowly—small care can still lift the day.',
    steady: 'You may feel low, but your steady energy shows that you are still moving forward.',
    bright: 'Let the energy you have carry you toward one kind, manageable next step.',
    full: 'Your spark is still here; use it gently and let the day open up again.',
  },
  okay: {
    empty: 'Being steady can mean pausing; your energy can return without being rushed.',
    low: 'A quiet pace is still progress, and today can brighten one small moment at a time.',
    steady: 'You are grounded, capable, and exactly where your next good step can begin.',
    bright: 'Your steady mood and ready energy make room for something meaningful today.',
    full: 'You have a strong, balanced rhythm—let it carry you toward something that feels good.',
  },
  good: {
    empty: 'A good feeling does not need high energy; enjoy it softly and let yourself recharge.',
    low: 'There is warmth in this moment—protect it, move gently, and let it grow.',
    steady: 'You are in a good place with steady energy; trust the pace that is working for you.',
    bright: 'You feel good and ready—take one joyful step toward what matters.',
    full: 'Your good mood and bright energy are a beautiful invitation to make today count.',
  },
  loved: {
    empty: 'Your light is still yours, even when your body needs rest; let joy be gentle today.',
    low: 'Hold on to the brightness you feel and give it a soft, unhurried pace.',
    steady: 'Your inner light feels grounded today—share it in a way that also nourishes you.',
    bright: 'You are bright and ready; follow the energy toward something that makes you feel alive.',
    full: 'You are glowing with possibility—let that joy become a bold, beautiful step forward.',
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
