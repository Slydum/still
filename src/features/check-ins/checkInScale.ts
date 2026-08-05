import { stillAssets } from '../../theme/stillAssets';

export const CHECK_IN_SCALE_VERSION = 2 as const;

export type CheckInMoodValue = 1 | 2 | 3 | 4 | 5;
export type CheckInEnergyValue = 1 | 2 | 3 | 4 | 5;
export type CheckInMoodKey = 'sad' | 'calm' | 'content' | 'happy' | 'excited';
export type CheckInEnergyKey = 'exhausted' | 'low' | 'balanced' | 'high' | 'energized';

export type CheckInOption<Value extends number, Key extends string> = {
  value: Value;
  key: Key;
  label: string;
  emoji: string;
  asset: string;
};

export const checkInMoodOptions: ReadonlyArray<CheckInOption<CheckInMoodValue, CheckInMoodKey>> = [
  { value: 1, key: 'sad', label: 'Sad', emoji: '🌧️', asset: stillAssets.checkIn.mood.sad },
  { value: 2, key: 'calm', label: 'Calm', emoji: '🌙', asset: stillAssets.checkIn.mood.calm },
  { value: 3, key: 'content', label: 'Content', emoji: '🌿', asset: stillAssets.checkIn.mood.content },
  { value: 4, key: 'happy', label: 'Happy', emoji: '🌤️', asset: stillAssets.checkIn.mood.happy },
  { value: 5, key: 'excited', label: 'Excited', emoji: '✨', asset: stillAssets.checkIn.mood.excited },
];

export const checkInEnergyOptions: ReadonlyArray<CheckInOption<CheckInEnergyValue, CheckInEnergyKey>> = [
  { value: 1, key: 'exhausted', label: 'Exhausted', emoji: '🪫', asset: stillAssets.checkIn.energy.exhausted },
  { value: 2, key: 'low', label: 'Low', emoji: '🕯️', asset: stillAssets.checkIn.energy.low },
  { value: 3, key: 'balanced', label: 'Balanced', emoji: '🌿', asset: stillAssets.checkIn.energy.balanced },
  { value: 4, key: 'high', label: 'High', emoji: '🌤️', asset: stillAssets.checkIn.energy.high },
  { value: 5, key: 'energized', label: 'Energized', emoji: '⚡', asset: stillAssets.checkIn.energy.energized },
];

const answers: Record<CheckInMoodKey, Record<CheckInEnergyKey, string>> = {
  sad: {
    exhausted: "I'm feeling sad and exhausted, so I need a very gentle pace and real rest today.",
    low: "I'm feeling sad with low energy, and taking one small step at a time is enough.",
    balanced: "I'm feeling sad, but my energy feels balanced enough to move through today with care.",
    high: "I'm feeling sad with a lot of energy, and I can use some of it to support myself kindly.",
    energized: "I'm feeling sad but energized, and I want to direct that energy toward something that helps me feel held.",
  },
  calm: {
    exhausted: "I'm feeling calm but exhausted, so I'm letting this quiet feeling make room for rest.",
    low: "I'm feeling calm with low energy, and a soft, unhurried pace feels right today.",
    balanced: "I'm feeling calm and balanced, able to meet the day without rushing it.",
    high: "I'm feeling calm with high energy, and I can move forward without losing my steadiness.",
    energized: "I'm feeling calm and energized, ready to use this clear energy with intention.",
  },
  content: {
    exhausted: "I'm feeling content even though I'm exhausted, and I can enjoy this ease while giving my body rest.",
    low: "I'm feeling content with low energy, happy to keep things simple and gentle.",
    balanced: "I'm feeling content and balanced, comfortable with the rhythm I have today.",
    high: "I'm feeling content with high energy, ready to give my attention to something meaningful.",
    energized: "I'm feeling content and energized, with enough ease and momentum to enjoy what comes next.",
  },
  happy: {
    exhausted: "I'm feeling happy even though I'm exhausted, so I want to enjoy the warmth without pushing myself.",
    low: "I'm feeling happy with low energy, and I can let this good feeling stay soft and unhurried.",
    balanced: "I'm feeling happy and balanced, grateful for the steady warmth in this moment.",
    high: "I'm feeling happy with high energy, ready to take a joyful step forward.",
    energized: "I'm feeling happy and energized, ready to bring this bright energy into something I care about.",
  },
  excited: {
    exhausted: "I'm feeling excited but exhausted, so I want to hold onto the spark while still choosing rest.",
    low: "I'm feeling excited with low energy, and I can enjoy the anticipation without rushing myself.",
    balanced: "I'm feeling excited and balanced, ready to follow this feeling at a steady pace.",
    high: "I'm feeling excited with high energy, eager to move toward what is calling me.",
    energized: "I'm feeling excited and energized, full of momentum and ready to begin.",
  },
};

export function isCheckInMoodValue(value?: number): value is CheckInMoodValue {
  return Number.isInteger(value) && value !== undefined && value >= 1 && value <= 5;
}

export function isCheckInEnergyValue(value?: number): value is CheckInEnergyValue {
  return Number.isInteger(value) && value !== undefined && value >= 1 && value <= 5;
}

export function getCheckInMood(value?: number) {
  return isCheckInMoodValue(value) ? checkInMoodOptions[value - 1] : undefined;
}

export function getCheckInEnergy(value?: number) {
  return isCheckInEnergyValue(value) ? checkInEnergyOptions[value - 1] : undefined;
}

export function getCheckInAnswer(mood?: number, energy?: number) {
  const moodOption = getCheckInMood(mood);
  const energyOption = getCheckInEnergy(energy);
  if (!moodOption || !energyOption) return '';
  return answers[moodOption.key][energyOption.key];
}

export function createCheckInSnapshot(mood?: number, energy?: number) {
  const answerSnapshot = getCheckInAnswer(mood, energy);
  return answerSnapshot
    ? { answerSnapshot, scaleVersion: CHECK_IN_SCALE_VERSION }
    : {};
}
