import coffeeArt from './companions/coffee';
import type { StillContext } from './stillContext';

export type CloudCompanionKey =
  | 'coffee'
  | 'reading'
  | 'sleeping'
  | 'stretching'
  | 'flower'
  | 'waving'
  | 'scarf'
  | 'lantern'
  | 'umbrella';

const companionLoaders: Record<
  Exclude<CloudCompanionKey, 'coffee'>,
  () => Promise<{ default: string }>
> = {
  reading: () => import('./companions/reading'),
  sleeping: () => import('./companions/sleeping'),
  stretching: () => import('./companions/stretching'),
  flower: () => import('./companions/flower'),
  waving: () => import('./companions/waving'),
  scarf: () => import('./companions/scarf'),
  lantern: () => import('./companions/lantern'),
  umbrella: () => import('./companions/umbrella'),
};

export const cloudCompanionArt = coffeeArt;

export function getCloudCompanionKey(
  context: Pick<StillContext, 'timeOfDay' | 'weather' | 'mood' | 'energy'>,
): CloudCompanionKey {
  if (context.weather === 'rain' || context.weather === 'thunderstorm' || context.weather === 'tornado') {
    return 'umbrella';
  }

  if (context.weather === 'snow' || context.weather === 'windy' || context.weather === 'fog') {
    return 'scarf';
  }

  if (context.timeOfDay === 'night' && (context.energy === 'empty' || context.energy === 'low')) {
    return 'sleeping';
  }

  if (context.timeOfDay === 'night' || context.timeOfDay === 'evening') {
    return 'lantern';
  }

  if (context.energy === 'full') return 'stretching';
  if (context.energy === 'bright') return 'waving';
  if (context.mood === 'loved' || context.mood === 'good') return 'flower';
  if (context.timeOfDay === 'afternoon') return 'reading';
  return 'coffee';
}

export async function loadCloudCompanionArt(key: CloudCompanionKey) {
  if (key === 'coffee') return coffeeArt;
  const module = await companionLoaders[key]();
  return module.default;
}

