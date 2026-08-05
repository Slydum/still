import { selectQuote } from '../content/quoteEngine';
import type { StillContext, WeatherKey } from './stillContext';
import { stillAssets } from './stillAssets';

export type HeroKind = 'companion' | 'plant' | 'weather' | 'cozy' | 'occasion';

export type StillTheme = {
  heroAsset: string;
  heroAlt: string;
  heroKind: HeroKind;
  priorityAsset: string;
  checkInAsset: string;
  checkInMessage: string;
  paletteClass: string;
};

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  // Convert to an unsigned integer rather than using Math.abs. The absolute
  // value of the smallest signed 32-bit integer is still outside the positive
  // signed range, which could otherwise produce a negative array index.
  return hash >>> 0;
}

function pick<T>(items: readonly T[], seed: string): T {
  return items[hashString(seed) % items.length];
}

const weatherAssets: Record<WeatherKey, string> = {
  'partly-sunny': stillAssets.weather.partlySunny,
  cloudy: stillAssets.weather.cloudy,
  overcast: stillAssets.weather.overcast,
  rain: stillAssets.weather.rain,
  thunderstorm: stillAssets.weather.thunderstorm,
  windy: stillAssets.weather.windy,
  rainbow: stillAssets.weather.rainbow,
  snow: stillAssets.weather.snow,
  fog: stillAssets.weather.fog,
  tornado: stillAssets.weather.tornado,
};

function occasionHero(context: StillContext): [string, string] | undefined {
  switch (context.occasion) {
    case 'new-year': return [stillAssets.celebrations.newYearFireworks, 'Pastel New Year fireworks'];
    case 'valentines-day': return [stillAssets.celebrations.valentinesHearts, 'Soft pastel hearts'];
    case 'halloween': return [stillAssets.celebrations.halloweenGhost, 'A friendly pastel ghost'];
    case 'easter-spring': return [stillAssets.celebrations.easterEgg, 'A decorated pastel Easter egg'];
    case 'birthday':
    case 'achievement': return [stillAssets.celebrations.newYearStars, 'Pastel celebration stars'];
    case 'christmas': return [stillAssets.sky.sparkles, 'Soft sparkling stars'];
    default: return undefined;
  }
}

function heroForContext(context: StillContext): [string, string, HeroKind] {
  const special = occasionHero(context);
  if (special) return [special[0], special[1], 'occasion'];

  if (context.weather) {
    return [weatherAssets[context.weather], `${context.weather.replace('-', ' ')} watercolor weather`, 'weather'];
  }

  const companions = [
    stillAssets.cats.gingerSitting,
    stillAssets.cats.gingerRestingAwake,
    stillAssets.dogs.goldenSitting,
    stillAssets.dogs.shipomSittingHappy,
    stillAssets.dogs.aspinSitting,
    stillAssets.dogs.puppySitting,
  ] as const;
  const restful = [
    stillAssets.cats.gingerSleepingCurled,
    stillAssets.dogs.goldenSleeping,
    stillAssets.dogs.shipomRestingCurled,
    stillAssets.dogs.aspinSleepingRoundBed,
  ] as const;
  const plants = [
    stillAssets.plants.lavender,
    stillAssets.plants.peaceLily,
    stillAssets.plants.pinkBlossoms,
    stillAssets.plants.succulent,
    stillAssets.plants.tallLeaves,
  ] as const;
  const cozy = [
    stillAssets.cozy.tea,
    stillAssets.cozy.coffee,
    stillAssets.cozy.candle,
    stillAssets.cozy.books,
    stillAssets.cozy.window,
  ] as const;

  if (context.energy === 'empty' || context.energy === 'low' || context.timeOfDay === 'night') {
    return [pick(restful, `${context.dateKey}:rest`), 'A cozy companion resting', 'companion'];
  }

  const rotation = hashString(`${context.dateKey}:living-canvas`) % 4;
  if (rotation === 1) return [pick(plants, `${context.dateKey}:plant`), 'A soft watercolor plant', 'plant'];
  if (rotation === 2) return [pick(cozy, `${context.dateKey}:cozy`), 'A quiet cozy object', 'cozy'];
  if (rotation === 3) {
    const timeArt = context.timeOfDay === 'evening' ? stillAssets.time.sunset
      : context.timeOfDay === 'afternoon' ? stillAssets.time.midday
      : stillAssets.time.morning;
    return [timeArt, 'A watercolor view of the sky', 'weather'];
  }
  return [pick(companions, `${context.dateKey}:companion`), 'A gentle watercolor companion', 'companion'];
}

function checkInAsset(context: StillContext) {
  if (context.mood === 'sad') return stillAssets.checkIn.mood.sad;
  if (context.mood === 'overwhelmed') return stillAssets.checkIn.mood.calm;
  if (context.mood === 'loved') return stillAssets.checkIn.mood.excited;
  if (context.energy === 'empty') return stillAssets.checkIn.energy.exhausted;
  if (context.energy === 'low') return stillAssets.checkIn.energy.low;
  if (context.energy === 'bright') return stillAssets.checkIn.energy.high;
  if (context.energy === 'full') return stillAssets.checkIn.energy.energized;
  return stillAssets.checkIn.mood.content;
}

function checkInMessage(context: StillContext) {
  if (!context.mood || !context.energy) return '';

  return selectQuote(
    context,
    [],
    `${context.dateKey}:check-in:${context.mood}:${context.energy}`,
  ).text;
}

export function buildStillTheme(context: StillContext): StillTheme {
  const [heroAsset, heroAlt, heroKind] = heroForContext(context);
  const priorityPets = [
    stillAssets.dogs.aspinPlayingBall,
    stillAssets.dogs.goldenWalking,
    stillAssets.dogs.shipomSittingHappy,
    stillAssets.cats.gingerPlayBow,
  ] as const;

  return {
    heroAsset,
    heroAlt,
    heroKind,
    priorityAsset: pick(priorityPets, `${context.dateKey}:priority`),
    checkInAsset: checkInAsset(context),
    checkInMessage: checkInMessage(context),
    paletteClass: `theme-${context.timeOfDay}${context.weather ? ` weather-${context.weather}` : ''}`,
  };
}
