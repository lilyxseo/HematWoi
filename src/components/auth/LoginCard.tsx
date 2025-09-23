import clsx from 'clsx';
import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  ChangeEvent,
  useId,
  InputHTMLAttributes,
} from 'react';
import {
  getAvailableSocialProviders,
  resetPassword,
  signInWithMagicLink,
  signInWithPassword,
  signInWithProvider,
  verifyOtp,
} from '../../lib/auth';
import SocialButtons from './SocialButtons';

type LoginCardProps = {
  defaultEmail?: string;
  onSuccess?: (email: string) => void;
};

type TabKey = 'password' | 'magic';
type ModeKey = 'login' | 'reset';

type StatusState = {
  type: 'success' | 'error' | 'info';
  message: string;
} | null;

const MIN_PASSWORD_LENGTH = 6;
const MAGIC_LINK_COOLDOWN = 45; // seconds
const GENERIC_ERROR = 'Terjadi kesalahan. Silakan coba lagi nanti.';

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isEmailValid(value: string) {
  const email = normalizeEmail(value);
  if (!email) return false;
  return /[^\s@]+@[^\s@]+\.[^\s@]+/.test(email);
}

type InputProps = {
  label: string;
  error?: string | null;
  hint?: string | null;
  trailing?: JSX.Element | null;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'className'>;

function TextInput({ label, error, hint, trailing = null, id, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  const hasTrailing = Boolean(trailing);

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-text">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          {...props}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={clsx(
            'h-11 w-full rounded-2xl border border-border-subtle bg-surface-alt px-3 text-sm text-text placeholder:text-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 disabled:cursor-not-allowed disabled:opacity-60',
            hasTrailing ? 'pr-12' : 'pr-3'
          )}
        />
        {trailing ? <div className="pointer-events-auto absolute inset-y-0 right-3 flex items-center">{trailing}</div> : null}
      </div>
      {hint ? (
        <p id={hintId} className="text-xs text-muted" aria-live="polite">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-danger" aria-live="polite">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function PasswordInput({ error, hint, ...props }: Omit<InputProps, 'trailing'>) {
  const [visible, setVisible] = useState(false);
  return (
    <TextInput
      {...props}
      type={visible ? 'text' : 'password'}
      autoComplete={props.autoComplete ?? 'current-password'}
      error={error}
      hint={hint}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          className="rounded-full p-1 text-muted transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
        >
          <span className="sr-only">{visible ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}</span>
          {visible ? (
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 5c-7 0-11 7-11 7s2.3 4.2 6.6 6l-2 2 1.4 1.4 3-3c.6.1 1.2.1 1.9.1 7 0 11-7 11-7s-1.2-2.2-3.5-4.2l2.1-2.1L19.6 4 16 7.6C14.6 6.6 13.2 6 12 6zm0 2c1.8 0 3.5.8 5 2.1 1 .8 1.7 1.7 2.1 2.3-.7 1-3.6 4.6-7.1 4.6-.5 0-1-.1-1.6-.2l1.9-1.9c.5-.4.8-.9.8-1.4 0-1.1-.9-2-2-2-.5 0-1 .2-1.4.6l-2.7 2.7C5.7 13.3 4.2 11 4.2 11S7 8 12 8z"
              />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 5c7 0 11 7 11 7s-4 7-11 7S1 12 1 12s4-7 11-7zm0 2C7 7 4.1 10.7 3.2 12c.8 1.3 3.7 5 8.8 5s8-3.7 8.8-5c-.8-1.3-3.7-5-8.8-5zm0 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"
              />
            </svg>
          )}
        </button>
      }
    />
  );
}

export default function LoginCard({ defaultEmail = '', onSuccess }: LoginCardProps) {
  const [tab, setTab] = useState<TabKey>('password');
  const [mode, setMode] = useState<ModeKey>('login');
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [rememberEmail, setRememberEmail] = useState(() => Boolean(defaultEmail));
  const [status, setStatus] = useState<StatusState>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [otpValue, setOtpValue] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOtpSubmitting, setIsOtpSubmitting] = useState(false);
  const [magicState, setMagicState] = useState<'idle' | 'sent'>('idle');
  const [otpVisible, setOtpVisible] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'github' | null>(null);

  const availableSocial = useMemo(() => getAvailableSocialProviders(), []);
  const hasSocialProviders = availableSocial.google || availableSocial.github;

  const submitGuardRef = useRef(0);
  const otpGuardRef = useRef(0);

  useEffect(() => {
    setEmail(defaultEmail);
    if (defaultEmail) {
      setRememberEmail(true);
    }
  }, [defaultEmail]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const resetFieldErrors = () => {
    setEmailError(null);
    setPasswordError(null);
    setOtpError(null);
  };

  const handleTabChange = (next: TabKey) => {
    if (tab === next) return;
    setTab(next);
    setMode('login');
    setStatus(null);
    resetFieldErrors();
    if (next === 'password') {
      setMagicState('idle');
      setOtpVisible(false);
    }
  };

  const persistEmailPreference = (value: string, shouldRemember: boolean) => {
    try {
      if (shouldRemember) {
        localStorage.setItem('hw:lastEmail', value);
      } else {
        localStorage.removeItem('hw:lastEmail');
      }
    } catch {
      /* ignore */
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const now = Date.now();
    if (now - submitGuardRef.current < 300) return;
    submitGuardRef.current = now;
    if (isSubmitting) return;

    resetFieldErrors();
    setStatus(null);

    const normalizedEmail = normalizeEmail(email);
    const validEmail = isEmailValid(normalizedEmail);
    if (!validEmail) {
      setEmailError('Masukkan email yang valid.');
      return;
    }

    if (mode === 'reset') {
      setIsSubmitting(true);
      try {
        await resetPassword(normalizedEmail);
        setStatus({
          type: 'success',
          message: `Kami telah mengirim tautan reset ke ${normalizedEmail}.`,
        });
        setMode('login');
        setMagicState('idle');
        setOtpVisible(false);
      } catch (error) {
        const message = error instanceof Error ? error.message : GENERIC_ERROR;
        setStatus({ type: 'error', message });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (tab === 'password' && password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`);
      return;
    }

    setIsSubmitting(true);

    try {
      if (tab === 'password') {
        await signInWithPassword({ email: normalizedEmail, password });
        persistEmailPreference(normalizedEmail, rememberEmail);
        setStatus({ type: 'success', message: 'Berhasil masuk. Mengalihkan…' });
        onSuccess?.(normalizedEmail);
      } else {
        if (magicState === 'sent' && cooldown > 0) {
          setStatus({
            type: 'info',
            message: `Tunggu ${cooldown} detik sebelum mengirim ulang magic link.`,
          });
          return;
        }
        await signInWithMagicLink(normalizedEmail);
        setMagicState('sent');
        setOtpVisible(true);
        setCooldown(MAGIC_LINK_COOLDOWN);
        setStatus({
          type: 'success',
          message: 'Tautan login telah dikirim ke email kamu. Periksa kotak masuk dan folder spam.',
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : GENERIC_ERROR;
      setStatus({ type: 'error', message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtpSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const now = Date.now();
    if (now - otpGuardRef.current < 300) return;
    otpGuardRef.current = now;
    if (isOtpSubmitting) return;

    resetFieldErrors();
    setStatus(null);

    const normalizedEmail = normalizeEmail(email);
    if (!isEmailValid(normalizedEmail)) {
      setEmailError('Masukkan email yang valid.');
      return;
    }

    const token = otpValue.trim();
    if (token.length !== 6 || !/^\d{6}$/.test(token)) {
      setOtpError('Masukkan kode OTP 6 digit.');
      return;
    }

    setIsOtpSubmitting(true);
    try {
      await verifyOtp({ email: normalizedEmail, token });
      persistEmailPreference(normalizedEmail, rememberEmail);
      setStatus({ type: 'success', message: 'Kode OTP terverifikasi. Mengalihkan…' });
      onSuccess?.(normalizedEmail);
    } catch (error) {
      const message = error instanceof Error ? error.message : GENERIC_ERROR;
      setOtpError(message);
      setStatus({ type: 'error', message });
    } finally {
      setIsOtpSubmitting(false);
    }
  };

  const handleProviderClick = async (provider: 'google' | 'github') => {
    if (loadingProvider) return;
    setLoadingProvider(provider);
    setStatus(null);
    try {
      await signInWithProvider(provider);
    } catch (error) {
      const message = error instanceof Error ? error.message : GENERIC_ERROR;
      setStatus({ type: 'error', message });
    } finally {
      setLoadingProvider(null);
    }
  };

  const renderStatus = () => {
    if (!status) return null;
    const colorClass =
      status.type === 'success'
        ? 'border-success/30 bg-success/10 text-success'
        : status.type === 'error'
          ? 'border-danger/30 bg-danger/10 text-danger'
          : 'border-primary/30 bg-primary/10 text-primary';
    return (
      <div
        role="status"
        aria-live="polite"
        className={clsx('rounded-2xl border px-4 py-3 text-sm font-medium', colorClass)}
      >
        {status.message}
      </div>
    );
  };

  const actionLabel = useMemo(() => {
    if (mode === 'reset') return 'Kirim tautan reset';
    if (tab === 'password') return 'Masuk';
    if (magicState === 'sent' && cooldown > 0) {
      return `Kirim ulang dalam ${cooldown}s`;
    }
    return magicState === 'sent' ? 'Kirim ulang magic link' : 'Kirim Magic Link';
  }, [cooldown, magicState, mode, tab]);

  const isActionDisabled = useMemo(() => {
    if (mode === 'reset') return isSubmitting;
    if (tab === 'password') return isSubmitting;
    return isSubmitting || (magicState === 'sent' && cooldown > 0);
  }, [cooldown, isSubmitting, magicState, mode, tab]);

  const rememberLabelId = useId();

  return (
    <div className="w-full max-w-md rounded-3xl border border-border-subtle bg-surface p-8 shadow-sm">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-text">Masuk ke HematWoi</h1>
          <p className="text-sm text-muted">
            Kelola keuanganmu dengan lebih cerdas. Gunakan metode masuk yang paling nyaman.
          </p>
        </div>

        <div role="tablist" className="flex items-center gap-2">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'password'}
            onClick={() => handleTabChange('password')}
            className={clsx(
              'flex-1 rounded-2xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45',
              tab === 'password'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border-subtle bg-surface-alt text-muted hover:text-text'
            )}
          >
            Email &amp; Password
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'magic'}
            onClick={() => handleTabChange('magic')}
            className={clsx(
              'flex-1 rounded-2xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45',
              tab === 'magic'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border-subtle bg-surface-alt text-muted hover:text-text'
            )}
          >
            Magic Link
          </button>
        </div>

        {renderStatus()}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <TextInput
            label="Email"
            type="email"
            name="email"
            inputMode="email"
            autoComplete="email"
            placeholder="nama@email.com"
            value={email}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
            onBlur={() => {
              if (email && !isEmailValid(email)) {
                setEmailError('Masukkan email yang valid.');
              }
            }}
            error={emailError}
            required
          />

          {mode === 'login' && tab === 'password' ? (
            <PasswordInput
              label="Kata sandi"
              name="password"
              placeholder="Kata sandi"
              value={password}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
              minLength={MIN_PASSWORD_LENGTH}
              error={passwordError}
              required
            />
          ) : null}

          {mode === 'reset' ? (
            <p className="text-sm text-muted" aria-live="polite">
              Kami akan mengirim tautan untuk mengatur ulang kata sandi kamu. Buka email dan ikuti instruksinya.
            </p>
          ) : null}

          <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isActionDisabled}
          >
            {isSubmitting ? (
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/60 border-t-transparent"
                aria-hidden="true"
              />
            ) : null}
            <span>{actionLabel}</span>
          </button>
        </form>

        {mode === 'login' && tab === 'password' ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <label htmlFor={rememberLabelId} className="flex items-center gap-2 text-sm text-text">
              <input
                id={rememberLabelId}
                type="checkbox"
                className="h-4 w-4 rounded border-border-subtle text-primary focus:ring-primary/45"
                checked={rememberEmail}
                onChange={(event) => setRememberEmail(event.target.checked)}
              />
              Ingat saya
            </label>
            <button
              type="button"
              onClick={() => {
                setMode('reset');
                setStatus(null);
              }}
              className="text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
            >
              Lupa kata sandi?
            </button>
          </div>
        ) : null}

        {mode === 'reset' ? (
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setStatus(null);
            }}
            className="text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
          >
            &larr; Kembali ke masuk
          </button>
        ) : null}

        {tab === 'magic' && magicState === 'sent' ? (
          <div className="space-y-3 rounded-2xl border border-success/40 bg-success/10 p-4 text-sm text-success" aria-live="polite">
            <p className="font-semibold">Tautan login telah dikirim ke email kamu.</p>
            <p className="text-success/80">
              Buka email dan klik tautan untuk melanjutkan. {cooldown > 0 ? `Kamu bisa kirim ulang dalam ${cooldown} detik.` : 'Belum menerima? Kamu bisa kirim ulang sekarang.'}
            </p>
          </div>
        ) : null}

        {tab === 'magic' && otpVisible ? (
          <div className="space-y-3 rounded-2xl border border-border-subtle bg-surface-alt/60 p-4">
            <p className="text-sm font-semibold text-text">Masukkan kode OTP 6 digit</p>
            <form onSubmit={handleOtpSubmit} className="space-y-3" noValidate>
              <TextInput
                label="Kode OTP"
                name="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={otpValue}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  const value = event.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                  setOtpValue(value);
                }}
                error={otpError}
                required
              />
              <button
                type="submit"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-primary bg-primary/10 px-4 text-sm font-semibold text-primary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isOtpSubmitting}
              >
                {isOtpSubmitting ? (
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"
                    aria-hidden="true"
                  />
                ) : null}
                Verifikasi kode
              </button>
            </form>
          </div>
        ) : null}

        {hasSocialProviders ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                atau lanjut dengan
              </span>
              <span className="h-px flex-1 bg-border-subtle" aria-hidden="true" />
            </div>
            <SocialButtons
              onProviderClick={handleProviderClick}
              loadingProvider={loadingProvider}
              disabled={isSubmitting || isOtpSubmitting}
              availability={availableSocial}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
