import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { toAppPath } from '../../app/appLocation';
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

const modeCopy: Record<AuthMode, { title: string; subtitle: string; action: string }> = {
  login: {
    title: 'Welcome back',
    subtitle: 'Good to see you again.',
    action: 'Log in',
  },
  signup: {
    title: 'Create your space',
    subtitle: 'A gentle place for everything that matters.',
    action: 'Create account',
  },
  forgot: {
    title: 'Find your way back',
    subtitle: 'We will send a secure password reset link.',
    action: 'Send reset email',
  },
  recovery: {
    title: 'Choose a new password',
    subtitle: 'Make it something only you know.',
    action: 'Save new password',
  },
};

export function AuthPage({ recoveryMode = false, initialNotice = '', onRecoveryComplete }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>(recoveryMode ? 'recovery' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    setShowPassword(false);
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

  const passwordType = showPassword ? 'text' : 'password';

  return (
    <main className={`auth-page auth-page--${mode}`}>
      <div className="auth-native-shell">
        <header className="auth-hero">
          <div className="auth-brand" aria-label="Still">Still</div>
          <div className="auth-art" aria-hidden="true">
            <img
              alt=""
              className="auth-mascot"
              decoding="async"
              draggable={false}
              fetchPriority="high"
              height="360"
              src={toAppPath('/assets/auth/still-cloud-mascot.svg')}
              width="640"
            />
          </div>
          <div className="auth-hero-copy">
            <h1 id="auth-title">{copy.title}</h1>
            <p>{copy.subtitle}</p>
          </div>
        </header>

        <section className="auth-card" aria-labelledby="auth-title">
          {(mode === 'forgot' || mode === 'recovery') && (
            <button className="auth-back" onClick={() => changeMode('login')} type="button">
              <ArrowLeft size={17} /> Back to login
            </button>
          )}

          <form className="auth-form" onSubmit={submit}>
            {mode === 'signup' && (
              <label>
                <span>Your name</span>
                <div className="auth-input-wrap">
                  <UserRound size={20} />
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
                <span>Email</span>
                <div className="auth-input-wrap">
                  <Mail size={20} />
                  <input
                    autoCapitalize="none"
                    autoComplete="email"
                    disabled={busy}
                    inputMode="email"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@still.app"
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
                  <LockKeyhole size={20} />
                  <input
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    disabled={busy}
                    minLength={8}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    required
                    type={passwordType}
                    value={password}
                  />
                  <button
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="auth-password-toggle"
                    disabled={busy}
                    onClick={() => setShowPassword((visible) => !visible)}
                    type="button"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </label>
            )}

            {(mode === 'signup' || mode === 'recovery') && (
              <label>
                <span>Confirm password</span>
                <div className="auth-input-wrap">
                  <KeyRound size={20} />
                  <input
                    autoComplete="new-password"
                    disabled={busy}
                    minLength={8}
                    onChange={(event) => setConfirmation(event.target.value)}
                    placeholder="Type it again"
                    required
                    type={passwordType}
                    value={confirmation}
                  />
                </div>
              </label>
            )}

            {mode === 'login' && (
              <div className="auth-login-tools">
                <span>Securely remembered on this device</span>
                <button className="auth-text-action" onClick={() => changeMode('forgot')} type="button">
                  Forgot password?
                </button>
              </div>
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
        </section>

        {mode === 'login' && (
          <p className="auth-switch">
            Don’t have an account?{' '}
            <button onClick={() => changeMode('signup')} type="button">Create account</button>
          </p>
        )}

        {mode === 'signup' && (
          <p className="auth-switch">
            Already have an account?{' '}
            <button onClick={() => changeMode('login')} type="button">Log in</button>
          </p>
        )}

        {mode === 'login' && (
          <p className="auth-help">Used the old email-link login? Choose <strong>Forgot password</strong> once to create a password for the same account.</p>
        )}

        <p className="auth-privacy"><ShieldCheck size={16} /> Your Still data stays private to your account.</p>
      </div>
    </main>
  );
}
