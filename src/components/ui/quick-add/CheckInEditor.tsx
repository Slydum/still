import { useMemo, useState } from 'react';
import {
  checkInEnergyOptions,
  checkInMoodOptions,
  getCheckInAnswer,
} from '../../../features/check-ins/checkInScale';

type CompletedCheckIn = {
  mood: number;
  energy: number;
};

export function CheckInEditor({
  currentEnergy,
  currentMood,
  onCancel,
  onSave,
}: {
  currentEnergy?: number;
  currentMood?: number;
  onCancel: () => void;
  onSave: (mood?: number, energy?: number) => void;
}) {
  const [mood, setMood] = useState<number | undefined>(currentMood);
  const [energy, setEnergy] = useState<number | undefined>(currentEnergy);
  const [completedCheckIn, setCompletedCheckIn] = useState<CompletedCheckIn>();

  const resultQuote = useMemo(() => {
    if (!completedCheckIn) return undefined;
    return getCheckInAnswer(completedCheckIn.mood, completedCheckIn.energy);
  }, [completedCheckIn]);

  const chooseMood = (value: number) => {
    const nextMood = mood === value ? undefined : value;
    setMood(nextMood);

    if (nextMood && energy) {
      setCompletedCheckIn({ mood: nextMood, energy });
    }
  };

  const chooseEnergy = (value: number) => {
    const nextEnergy = energy === value ? undefined : value;
    setEnergy(nextEnergy);

    if (mood && nextEnergy) {
      setCompletedCheckIn({ mood, energy: nextEnergy });
    }
  };

  if (completedCheckIn && resultQuote) {
    return (
      <div className="checkin-quote-result" aria-live="polite">
        <blockquote>{resultQuote}</blockquote>
        <div className="task-editor-actions checkin-quote-actions">
          <button className="task-secondary-button" onClick={() => setCompletedCheckIn(undefined)} type="button">Change</button>
          <button className="task-primary-button" onClick={() => onSave(completedCheckIn.mood, completedCheckIn.energy)} type="button">Save check-in</button>
        </div>
      </div>
    );
  }

  return (
    <div className="task-editor checkin-editor">
      <fieldset className="journal-mood-field">
        <legend>Mood</legend>
        <div className="journal-mood-options">
          {checkInMoodOptions.map((option) => (
            <button aria-label={option.label} aria-pressed={mood === option.value} className={mood === option.value ? 'is-selected' : ''} key={option.value} onClick={() => chooseMood(option.value)} type="button">
              <span>{option.emoji}</span>
              <small>{option.label}</small>
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="journal-mood-field">
        <legend>Energy</legend>
        <div className="journal-mood-options">
          {checkInEnergyOptions.map((option) => (
            <button aria-label={option.label} aria-pressed={energy === option.value} className={energy === option.value ? 'is-selected' : ''} key={option.value} onClick={() => chooseEnergy(option.value)} type="button">
              <span>{option.emoji}</span>
              <small>{option.label}</small>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="task-editor-actions">
        <button className="task-secondary-button" onClick={onCancel} type="button">Cancel</button>
      </div>
    </div>
  );
}
