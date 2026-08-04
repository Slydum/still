export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';
export type MoodKey = 'sad' | 'overwhelmed' | 'okay' | 'good' | 'loved';
export type EnergyKey = 'empty' | 'low' | 'steady' | 'bright' | 'full';
export type WeatherKey =
  | 'partly-sunny'
  | 'cloudy'
  | 'overcast'
  | 'rain'
  | 'thunderstorm'
  | 'windy'
  | 'rainbow'
  | 'snow'
  | 'fog'
  | 'tornado';
export type OccasionKey =
  | 'new-year'
  | 'valentines-day'
  | 'halloween'
  | 'easter-spring'
  | 'christmas'
  | 'birthday'
  | 'achievement';

export type StillContext = {
  dateKey: string;
  timeOfDay: TimeOfDay;
  mood?: MoodKey;
  energy?: EnergyKey;
  weather?: WeatherKey;
  occasion?: OccasionKey;
};

const moodMap: Record<number, MoodKey> = {
  1: 'sad',
  2: 'overwhelmed',
  3: 'okay',
  4: 'good',
  5: 'loved',
};

const energyMap: Record<number, EnergyKey> = {
  1: 'empty',
  2: 'low',
  3: 'steady',
  4: 'bright',
  5: 'full',
};

export function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTimeOfDay(date = new Date()): TimeOfDay {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

export function getGreeting(timeOfDay: TimeOfDay) {
  if (timeOfDay === 'morning') return 'Good morning.';
  if (timeOfDay === 'afternoon') return 'Good afternoon.';
  if (timeOfDay === 'evening') return 'Good evening.';
  return 'Good night.';
}

export function getOccasion(date = new Date(), custom?: OccasionKey): OccasionKey | undefined {
  if (custom) return custom;

  const month = date.getMonth() + 1;
  const day = date.getDate();

  if ((month === 12 && day === 31) || (month === 1 && day === 1)) return 'new-year';
  if (month === 2 && day === 14) return 'valentines-day';
  if (month === 10 && day === 31) return 'halloween';
  if (month === 12 && day === 25) return 'christmas';

  return undefined;
}

export function createStillContext({
  date = new Date(),
  mood,
  energy,
  weather,
  occasion,
}: {
  date?: Date;
  mood?: number;
  energy?: number;
  weather?: WeatherKey;
  occasion?: OccasionKey;
}): StillContext {
  return {
    dateKey: getLocalDateKey(date),
    timeOfDay: getTimeOfDay(date),
    mood: mood ? moodMap[mood] : undefined,
    energy: energy ? energyMap[energy] : undefined,
    weather,
    occasion: getOccasion(date, occasion),
  };
}
