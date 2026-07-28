import type { StillContext, WeatherKey } from './stillContext';
import { stillAssets } from './stillAssets';

export type StillTheme = {
  heroAsset: string;
  heroAlt: string;
  accentAsset: string;
  plantAsset: string;
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
  return Math.abs(hash);
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
    case 'new-year':
      return [stillAssets.celebrations.newYearFireworks, 'Pastel New Year fireworks'];
    case 'valentines-day':
      return [stillAssets.celebrations.valentinesHearts, 'Soft pastel hearts'];
    case 'halloween':
      return [stillAssets.celebrations.halloweenGhost, 'A friendly pastel ghost'];
    case 'easter-spring':
      return [stillAssets.celebrations.easterEgg, 'A decorated pastel Easter egg'];
    case 'birthday':
    case 'achievement':
      return [stillAssets.celebrations.newYearStars, 'Pastel celebration stars'];
    case 'christmas':
      return [stillAssets.sky.sparkles, 'Soft sparkling stars'];
    default:
      return undefined;
  }
}

function timeAccent(context: StillContext): string {
  switch (context.timeOfDay) {
    case 'morning':
      return context.weather ? weatherAssets[context.weather] : stillAssets.time.morning;
    case 'afternoon':
      return context.weather ? weatherAssets[context.weather] : stillAssets.time.midday;
    case 'evening':
      return context.weather ? weatherAssets[context.weather] : stillAssets.time.sunset;
    case 'night':
      return context.weather ? weatherAssets[context.weather] : stillAssets.time.night;
    default:
      return stillAssets.time.morning;
  }
}

function checkInAsset(context: StillContext) {
  if (context.mood === 'sad') return stillAssets.mood.sad;
  if (context.mood === 'overwhelmed') return stillAssets.mood.overwhelmed;
  if (context.mood === 'loved') return stillAssets.mood.loved;
  if (context.energy === 'empty') return stillAssets.energy.tired;
  if (context.energy === 'low') return stillAssets.energy.resting;
  if (context.energy === 'bright' || context.energy === 'full') return stillAssets.energy.motivated;
  return stillAssets.mood.calm;
}

function checkInMessage(context: StillContext) {
  if (context.mood === 'sad') return 'You do not have to carry the whole day at once.';
  if (context.mood === 'overwhelmed') return 'Let the next step be very small.';
  if (context.energy === 'empty') return 'Low energy is information, not a failure.';
  if (context.energy === 'low') return 'A slower pace still counts as moving.';
  if (context.mood === 'loved') return 'Hold on to the warmth that found you today.';
  if (context.energy === 'bright' || context.energy === 'full') return 'Use the energy gently; you do not have to spend it all.';
  return 'Noticing how you feel is already a kind act.';
}

function heroForContext(context: StillContext): [string, string] {
  const special = occasionHero(context);
  if (special) return special;

  const restful = [
    stillAssets.cats.gingerSleepingCurled,
    stillAssets.cats.gingerLoafSleeping,
    stillAssets.dogs.goldenSleeping,
    stillAssets.dogs.shipomRestingCurled,
    stillAssets.dogs.aspinSleepingRoundBed,
  ] as const;

  const calm = [
    stillAssets.cats.gingerRestingAwake,
    stillAssets.dogs.shipomRestingSphinx,
    stillAssets.dogs.aspinCuddlingPair,
    stillAssets.dogs.goldenSitting,
  ] as const;

  const active = [
    stillAssets.cats.gingerStretching,
    stillAssets.dogs.goldenWalking,
    stillAssets.dogs.shipomWalking,
    stillAssets.dogs.aspinPlayingBall,
    stillAssets.dogs.aspinStandingHappy,
  ] as const;

  if (context.energy === 'empty' || context.energy === 'low' || context.timeOfDay === 'night') {
    return [pick(restful, `${context.dateKey}:rest`), 'A cozy companion resting'];
  }

  if (context.mood === 'sad' || context.mood === 'overwhelmed' || context.timeOfDay === 'evening') {
    return [pick(calm, `${context.dateKey}:calm`), 'A calm pastel companion'];
  }

  return [pick(active, `${context.dateKey}:active`), 'A cheerful pastel companion'];
}

export function buildStillTheme(context: StillContext): StillTheme {
  const [heroAsset, heroAlt] = heroForContext(context);
  const plants = [
    stillAssets.plants.leafy,
    stillAssets.plants.lavender,
    stillAssets.plants.fern,
    stillAssets.plants.succulent,
    stillAssets.plants.pinkBlossoms,
  ] as const;

  const priorityPets = [
    stillAssets.dogs.aspinPlayingBall,
    stillAssets.dogs.goldenWalking,
    stillAssets.dogs.shipomSittingHappy,
    stillAssets.cats.gingerPlayBow,
  ] as const;

  return {
    heroAsset,
    heroAlt,
    accentAsset: timeAccent(context),
    plantAsset: pick(plants, `${context.dateKey}:plant`),
    priorityAsset: pick(priorityPets, `${context.dateKey}:priority`),
    checkInAsset: checkInAsset(context),
    checkInMessage: checkInMessage(context),
    paletteClass: `theme-${context.timeOfDay}${context.weather ? ` weather-${context.weather}` : ''}`,
  };
}
