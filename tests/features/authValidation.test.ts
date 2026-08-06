import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  friendlyAuthError,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
} from '../../src/features/auth/authValidation.js';

describe('authentication validation', () => {
  it('accepts a normal email and rejects incomplete addresses', () => {
    assert.equal(validateEmail('person@example.com'), undefined);
    assert.equal(validateEmail('person@'), 'Enter a valid email address.');
    assert.equal(validateEmail(''), 'Enter your email address.');
  });

  it('requires passwords with at least eight characters', () => {
    assert.equal(validatePassword('quietday'), undefined);
    assert.equal(validatePassword('short'), 'Use at least 8 characters for your password.');
  });

  it('requires matching password confirmation', () => {
    assert.equal(validatePasswordConfirmation('quietday', 'quietday'), undefined);
    assert.equal(validatePasswordConfirmation('quietday', 'different'), 'The passwords do not match.');
  });

  it('turns Supabase authentication errors into clear user messages', () => {
    assert.equal(
      friendlyAuthError(new Error('Invalid login credentials')),
      'The email or password is incorrect.',
    );
    assert.equal(
      friendlyAuthError(new Error('Email not confirmed')),
      'Confirm your email first, then log in with your password.',
    );
  });
});
