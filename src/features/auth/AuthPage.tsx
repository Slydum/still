import {
  ArrowLeft,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import {
  getSupabaseConfigurationError,
  isSupabaseAvailable,
  requestCloudPasswordReset,
  signInCloudAccount,
  signUpCloudAccount,
  updateCloudPassword,
} from '../../data/supabaseClient';
import {
  friendlyAuthError,
  type AuthMode,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
} from './authValidation';

type AuthPageProps = {
  recoveryMode?: boolean;
  initialNotice?: string;
  onRecoveryComplete?: () => void;
};

const modeCopy: Record<AuthMode, { eyebrow: string; title: string; subtitle: string; action: string }> = {
  login: {
    eyebrow: 'Welcome back',
    title: 'Return to your quiet space.',
    subtitle: 'Log in to keep your Still data connected across your devices.',
    action: 'Log in',
  },
  signup: {
    eyebrow: 'Create your space',
    title: 'A calmer day starts here.',
    subtitle: 'Create an account so your tasks, journal, and calendar stay yours.',
    action: 'Create account',
  },
  forgot: {
    eyebrow: 'Reset your password',
    title: 'We will help you return.',
    subtitle: 'Enter your email and we will send a secure password reset link.',
    action: 'Send reset email',
  },
  recovery: {
    eyebrow: 'Choose a new password',
    title: 'Make your account secure again.',
    subtitle: 'Use a password with at least 8 characters.',
    action: 'Save new password',
  },
};

export function AuthPage({ recoveryMode = false, initialNotice = '', onRecoveryComplete }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>(recoveryMode ? 'recovery' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(initialNotice);
  const [error, setError] = useState('');
  const available = isSupabaseAvailable();
  const copy = modeCopy[mode];

  useEffect(() => {
    if (recoveryMode) setMode('recovery');
  }, [recoveryMode]);

  useEffect(() => {
    if (initialNotice) setMessage(initialNotice);
  }, [initialNotice]);

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setPassword('');
    setConfirmation('');
    setError('');
    setMessage('');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (mode !== 'recovery') {
      const emailError = validateEmail(email);
      if (emailError) {
        setError(emailError);
        return;
      }
    }

    if (mode === 'login' || mode === 'signup' || mode === 'recovery') {
      const passwordError = validatePassword(password);
      if (passwordError) {
        setError(passwordError);
        return;
      }
    }

    if (mode === 'signup' || mode === 'recovery') {
      const confirmationError = validatePasswordConfirmation(password, confirmation);
      if (confirmationError) {
        setError(confirmationError);
        return;
      }
    }

    if (mode === 'signup' && !name.trim()) {
      setError('Enter the name Still should use for you.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        await signInCloudAccount(email.trim(), password);
        setMessage('Opening your Still space…');
      } else if (mode === 'signup') {
        const result = await signUpCloudAccount(email.trim(), password, name.trim());
        if (result.session) {
          setMessage('Your account is ready. Opening Still…');
        } else {
          setMode('login');
          setPassword('');
          setConfirmation('');
          setMessage('Account created. Check your email to confirm it, then return here and log in with your password.');
        }
      } else if (mode === 'forgot') {
        await requestCloudPasswordReset(email.trim());
        setMode('login');
        setMessage('Check your email for the password reset link. After saving a password, return here to log in.');
      } else {
        await updateCloudPassword(password);
        setMessage('Password updated. Opening your Still space…');
        onRecoveryComplete?.();
      }
    } catch (submitError) {
      setError(friendlyAuthError(submitError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <section className="auth-intro" aria-label="About Still">
          <div className="auth-brand">Still.</div>
          <div className="auth-intro-copy">
            <p className="section-kicker">A private place for your days</p>
            <h1>Everything important, held gently together.</h1>
            <p>Your tasks, journal, calendar, money notes, and check-ins stay available offline and can follow you across signed-in devices.</p>
          </div>
          <div className="auth-art" aria-hidden="true">
            <img src="/assets/cozy/shared-little-house.png" alt="" />
          </div>
          <div className="auth-assurance"><ShieldCheck size={17} /><span>Your account owns its cloud records. Still also keeps a local copy on this device.</span></div>
        </section>

        <section className="auth-card" aria-labelledby="auth-title">
          {!recoveryMode && mode !== 'forgot' && (
            <div className="auth-tabs" role="tablist" aria-label="Account access">
              <button
                aria-selected={mode === 'login'}
                className={mode === 'login' ? 'is-active' : ''}
                onClick={() => changeMode('login')}
                role="tab"
                type="button"
              >
                Log in
              </button>
              <button
                aria-selected={mode === 'signup'}
                className={mode === 'signup' ? 'is-active' : ''}
                onClick={() => changeMode('signup')}
                role="tab"
                type="button"
              >
                Sign up
              </button>
            </div>
          )}

          {(mode === 'forgot' || mode === 'recovery') && (
            <button className="auth-back" onClick={() => changeMode('login')} type="button">
              <ArrowLeft size={16} /> Back to login
            </button>
          )}

          <header className="auth-card-header">
            <p className="section-kicker">{copy.eyebrow}</p>
            <h2 id="auth-title">{copy.title}</h2>
            <p>{copy.subtitle}</p>
          </header>

          <form className="auth-form" onSubmit={submit}>
            {mode === 'signup' && (
              <label>
                <span>Your name</span>
                <div className="auth-input-wrap">
                  <UserRound size={18} />
                  <input
                    autoComplete="name"
                    disabled={busy}
                    maxLength={40}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="What should Still call you?"
                    required
                    type="text"
                    value={name}
                  />
                </div>
              </label>
            )}

            {mode !== 'recovery' && (
              <label>
                <span>Email address</span>
                <div className="auth-input-wrap">
                  <Mail size={18} />
                  <input
                    autoCapitalize="none"
                    autoComplete="email"
                    disabled={busy}
                    inputMode="email"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    required
                    spellCheck={false}
                    type="email"
                    value={email}
                  />
                </div>
              </label>
            )}

            {mode !== 'forgot' && (
              <label>
                <span>{mode === 'recovery' ? 'New password' : 'Password'}</span>
                <div className="auth-input-wrap">
                  <LockKeyhole size={18} />
                  <input
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    disabled={busy}
                    minLength={8}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="At least 8 characters"
                    required
                    type="password"
                    value={password}
                  />
                </div>
              </label>
            )}

            {(mode === 'signup' || mode === 'recovery') && (
              <label>
                <span>Confirm password</span>
                <div className="auth-input-wrap">
                  <KeyRound size={18} />
                  <input
                    autoComplete="new-password"
                    disabled={busy}
                    minLength={8}
                    onChange={(event) => setConfirmation(event.target.value)}
                    placeholder="Type it again"
                    required
                    type="password"
                    value={confirmation}
                  />
                </div>
              </label>
            )}

            {mode === 'login' && (
              <button className="auth-text-action" onClick={() => changeMode('forgot')} type="button">
                Forgot password?
              </button>
            )}

            {!available && (
              <p className="auth-status is-error" role="alert">
                {getSupabaseConfigurationError() ?? 'Account access is not configured for this deployment.'}
              </p>
            )}
            {error && <p className="auth-status is-error" role="alert">{error}</p>}
            {message && <p className="auth-status" role="status">{message}</p>}

            <button className="auth-submit" disabled={busy || !available} type="submit">
              {busy ? 'Please wait…' : copy.action}
            </button>
          </form>

          {mode === 'login' && (
            <p className="auth-help">Used the old email-link login? Choose <strong>Forgot password</strong> once to create a password for the same account.</p>
          )}
        </section>
      </div>
    </main>
  );
}
