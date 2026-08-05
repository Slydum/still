import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CHECK_IN_SCALE_VERSION,
  checkInEnergyOptions,
  checkInMoodOptions,
  createCheckInSnapshot,
  getCheckInAnswer,
  getCheckInEnergy,
  getCheckInMood,
} from '../../src/features/check-ins/checkInScale.js';
import { createStillContext } from '../../src/theme/stillContext.js';

describe('canonical check-in scale', () => {
  it('matches every visible mood and energy label to its internal key', () => {
    assert.deepEqual(
      checkInMoodOptions.map(({ value, key, label }) => ({ value, key, label })),
      [
        { value: 1, key: 'sad', label: 'Sad' },
        { value: 2, key: 'calm', label: 'Calm' },
        { value: 3, key: 'content', label: 'Content' },
        { value: 4, key: 'happy', label: 'Happy' },
        { value: 5, key: 'excited', label: 'Excited' },
      ],
    );
    assert.deepEqual(
      checkInEnergyOptions.map(({ value, key, label }) => ({ value, key, label })),
      [
        { value: 1, key: 'exhausted', label: 'Exhausted' },
        { value: 2, key: 'low', label: 'Low' },
        { value: 3, key: 'balanced', label: 'Balanced' },
        { value: 4, key: 'high', label: 'High' },
        { value: 5, key: 'energized', label: 'Energized' },
      ],
    );
  });

  it('provides a distinct first-person answer for all 25 combinations', () => {
    const answers = checkInMoodOptions.flatMap((mood) => (
      checkInEnergyOptions.map((energy) => getCheckInAnswer(mood.value, energy.value))
    ));

    assert.equal(answers.length, 25);
    assert.equal(new Set(answers).size, 25);
    answers.forEach((answer) => {
      assert.ok(answer.startsWith("I'm "));
      assert.ok(answer.length > 45);
    });
  });

  it('never interprets Calm as overwhelmed or Excited as loved', () => {
    const calmAnswers = checkInEnergyOptions.map((energy) => getCheckInAnswer(2, energy.value).toLowerCase());
    const excitedAnswers = checkInEnergyOptions.map((energy) => getCheckInAnswer(5, energy.value).toLowerCase());

    calmAnswers.forEach((answer) => {
      assert.ok(answer.includes('calm'));
      assert.equal(answer.includes('overwhelmed'), false);
    });
    excitedAnswers.forEach((answer) => {
      assert.ok(answer.includes('excited'));
    });

    assert.equal(createStillContext({ mood: 2, energy: 3 }).mood, 'calm');
    assert.equal(createStillContext({ mood: 5, energy: 5 }).mood, 'excited');
  });

  it('creates versioned answer snapshots and rejects invalid values', () => {
    const snapshot = createCheckInSnapshot(2, 3);
    assert.equal(snapshot.scaleVersion, CHECK_IN_SCALE_VERSION);
    assert.equal(snapshot.answerSnapshot, getCheckInAnswer(2, 3));
    assert.equal(getCheckInMood(0), undefined);
    assert.equal(getCheckInEnergy(6), undefined);
    assert.deepEqual(createCheckInSnapshot(undefined, 3), {});
  });
});
