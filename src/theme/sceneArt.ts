import type { StillContext } from './stillContext';

export type HeroSceneKey = 'morning' | 'rain' | 'golden' | 'night';

const sceneLoaders: Record<
  HeroSceneKey,
  () => Promise<{ default: string }>
> = {
  morning: () => import('./scenes/morning'),
  rain: () => import('./scenes/rain'),
  golden: () => import('./scenes/golden'),
  night: () => import('./scenes/night'),
};

export function getHeroSceneKey(
  context: Pick<StillContext, 'timeOfDay' | 'weather'>,
): HeroSceneKey {
  if (
    context.weather === 'rain'
    || context.weather === 'thunderstorm'
    || context.weather === 'overcast'
    || context.weather === 'fog'
    || context.weather === 'tornado'
  ) {
    return 'rain';
  }

  if (context.timeOfDay === 'night') return 'night';
  if (context.timeOfDay === 'afternoon' || context.timeOfDay === 'evening') return 'golden';
  return 'morning';
}

export async function loadHeroSceneArt(key: HeroSceneKey) {
  const module = await sceneLoaders[key]();
  return module.default;
}
