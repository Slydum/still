import type { OccasionKey, WeatherKey } from '../theme/stillContext';

export type DevicePersistedState = {
  notificationsEnabled: boolean;
  autoWeather: boolean;
  weather?: WeatherKey;
  occasion?: OccasionKey;
};

export function devicePersistedState(state: DevicePersistedState): DevicePersistedState {
  return {
    notificationsEnabled: state.notificationsEnabled,
    autoWeather: state.autoWeather,
    weather: state.weather,
    occasion: state.occasion,
  };
}

export const DEVICE_PERSISTED_STATE_KEYS = [
  'notificationsEnabled',
  'autoWeather',
  'weather',
  'occasion',
] as const;
