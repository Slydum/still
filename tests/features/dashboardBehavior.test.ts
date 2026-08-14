import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  dashboardGreeting,
  shouldAutoRequestLocationWeather,
  shouldShowNotificationDot,
} from '../../src/features/dashboard/dashboardBehavior.js';

describe('dashboard behavior', () => {
  it('does not automatically request location without remembered consent', () => {
    assert.equal(shouldAutoRequestLocationWeather(true, false), false);
    assert.equal(shouldAutoRequestLocationWeather(false, true), false);
    assert.equal(shouldAutoRequestLocationWeather(true, true), true);
  });

  it('renders a complete greeting when no display name exists', () => {
    assert.deepEqual(dashboardGreeting('Good evening.', ''), {
      firstLine: 'Good evening.',
      secondLine: undefined,
    });
  });

  it('renders the personalized two-line greeting when a display name exists', () => {
    assert.deepEqual(dashboardGreeting('Good morning.', ' Mina '), {
      firstLine: 'Good morning,',
      secondLine: 'Mina.',
    });
  });

  it('uses the notification dot only for unread notifications', () => {
    assert.equal(shouldShowNotificationDot(false), false);
    assert.equal(shouldShowNotificationDot(true), true);
  });
});
