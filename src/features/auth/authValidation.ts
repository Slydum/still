export type AuthMode = 'login' | 'signup' | 'forgot' | 'recovery';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string) {
  if (!email.trim()) return 'Enter your email address.';
  if (!EMAIL_PATTERN.test(email.trim())) return 'Enter a valid email address.';
  return undefined;
}

export function validatePassword(password: string) {
  if (!password) return 'Enter your password.';
  if (password.length < 8) return 'Use at least 8 characters for your password.';
  return undefined;
}

export function validatePasswordConfirmation(password: string, confirmation: string) {
  if (!confirmation) return 'Confirm your password.';
  if (password !== confirmation) return 'The passwords do not match.';
  return undefined;
}

export function friendlyAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || 'Still could not complete that request.');
  const normalized = message.toLowerCase();

  if (normalized.includes('invalid login credentials')) {
    return 'The email or password is incorrect.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Confirm your email first, then log in with your password.';
  }
  if (normalized.includes('user already registered')) {
    return 'An account with this email already exists. Try logging in instead.';
  }
  if (normalized.includes('password should be at least')) {
    return 'Use at least 8 characters for your password.';
  }
  if (normalized.includes('rate limit') || normalized.includes('too many requests')) {
    return 'Too many attempts. Wait a moment, then try again.';
  }
  if (normalized.includes('network') || normalized.includes('failed to fetch')) {
    return 'Still could not reach the server. Check your connection and try again.';
  }

  return message;
}
