import { useState } from 'react';
import { energyLevels, journalMoods } from './quickAddOptions';

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

  return (
    <div className="task-editor checkin-editor">
      <fieldset className="journal-mood-field">
        <legend>Mood</legend>
        <div className="journal-mood-options">
          {journalMoods.map((option) => (
            <button aria-label={option.label} aria-pressed={mood === option.value} className={mood === option.value ? 'is-selected' : ''} key={option.value} onClick={() => setMood(mood === option.value ? undefined : option.value)} type="button">
              <span>{option.emoji}</span>
              <small>{option.label}</small>
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="journal-mood-field">
        <legend>Energy</legend>
        <div className="journal-mood-options">
          {energyLevels.map((option) => (
            <button aria-label={option.label} aria-pressed={energy === option.value} className={energy === option.value ? 'is-selected' : ''} key={option.value} onClick={() => setEnergy(energy === option.value ? undefined : option.value)} type="button">
              <span>{option.emoji}</span>
              <small>{option.label}</small>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="task-editor-actions">
        <button className="task-secondary-button" onClick={onCancel} type="button">Cancel</button>
        <button className="task-primary-button" disabled={!mood && !energy} onClick={() => onSave(mood, energy)} type="button">Save check-in</button>
      </div>
    </div>
  );
}
