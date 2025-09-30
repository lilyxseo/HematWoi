import clsx from 'clsx';
import {
  ChangeEvent,
  FormEvent,
  InputHTMLAttributes,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  resetPassword,
  resolveEmailByUsername,
  signInWithPassword,
} from '../../lib/auth';

type LoginCardProps = {
  defaultIdentifier?: string;
  onSuccess?: (identifier: string) => void;
  onPasswordSignInStart?: () => void;
  onPasswordSignInError?: () => void;
};

type ModeKey = 'login' | 'reset';

type StatusState = {
  type: 'success' | 'error' | 'info';
  message: string;
} | null;

const MIN_PASSWORD_LENGTH = 6;
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,30}$/;
const GENERIC_ERROR = 'Terjadi kesalahan. Silakan coba lagi nanti.';

function normalizeIdentifier(value: string) {
  return value.trim();
}

function isLikelyEmail(value: string) {
  return value.includes('@');
}

function isUsernameValid(value: string) {
  return USERNAME_PATTERN.test(value);
}

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

export default function LoginCard({
  defaultIdentifier = '',
  onSuccess,
  onPasswordSignInStart,
  onPasswordSignInError,
}: LoginCardProps) {
  const [mode, setMode] = useState<ModeKey>('login');
  const [identifier, setIdentifier] = useState(defaultIdentifier);
  const [password, setPassword] = useState('');
  const [rememberIdentifier, setRememberIdentifier] = useState(() => Boolean(defaultIdentifier));
  const [status, setStatus] = useState<StatusState>(null);
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitGuardRef = useRef(0);

  useEffect(() => {
    setIdentifier(defaultIdentifier);
    if (defaultIdentifier) {
      setRememberIdentifier(true);
    }
  }, [defaultIdentifier]);

  const resetFieldErrors = () => {
    setIdentifierError(null);
    setPasswordError(null);
  };

  const persistIdentifierPreference = (value: string, shouldRemember: boolean) => {
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

    const trimmedIdentifier = normalizeIdentifier(identifier);
    if (!trimmedIdentifier) {
      setIdentifierError('Masukkan email atau username.');
      return;
    }

    const looksLikeEmail = isLikelyEmail(trimmedIdentifier);
    const normalizedEmail = looksLikeEmail ? normalizeEmail(trimmedIdentifier) : '';

    if (mode === 'reset') {
      if (!looksLikeEmail || !isEmailValid(normalizedEmail)) {
        setIdentifierError('Masukkan email yang valid.');
        return;
      }

      setIsSubmitting(true);
      try {
        await resetPassword(normalizedEmail);
        setStatus({
          type: 'success',
          message: `Kami telah mengirim tautan reset ke ${normalizedEmail}.`,
        });
        setMode('login');
      } catch (error) {
        const message = error instanceof Error ? error.message : GENERIC_ERROR;
        setStatus({ type: 'error', message });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (looksLikeEmail) {
      if (!isEmailValid(normalizedEmail)) {
        setIdentifierError('Masukkan email yang valid.');
        return;
      }
    } else if (!isUsernameValid(trimmedIdentifier)) {
      setIdentifierError('Username hanya boleh huruf, angka, atau underscore (3-30 karakter).');
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`);
      return;
    }

    setIsSubmitting(true);

    try {
      let emailForSignIn = normalizedEmail;
      onPasswordSignInStart?.();
      if (!looksLikeEmail) {
        const resolvedEmail = await resolveEmailByUsername(trimmedIdentifier);
        if (!resolvedEmail) {
          throw new Error('Username atau email tidak ditemukan.');
        }
        emailForSignIn = normalizeEmail(resolvedEmail);
      }

      await signInWithPassword({ email: emailForSignIn, password });
      const rememberedValue = looksLikeEmail ? emailForSignIn : trimmedIdentifier;
      persistIdentifierPreference(rememberedValue, rememberIdentifier);
      setStatus({ type: 'success', message: 'Berhasil masuk. Mengalihkan…' });
      onSuccess?.(emailForSignIn);
    } catch (error) {
      onPasswordSignInError?.();
      const message = error instanceof Error ? error.message : GENERIC_ERROR;
      if (!looksLikeEmail) {
        if (message === 'Username atau email tidak ditemukan.' || message === 'Username tidak ditemukan.') {
          setIdentifierError(message);
        }
      }
      setStatus({ type: 'error', message });
    } finally {
      setIsSubmitting(false);
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
      <div role="status" aria-live="polite" className={clsx('rounded-2xl border px-4 py-3 text-sm font-medium', colorClass)}>
        {status.message}
      </div>
    );
  };

  const actionLabel = useMemo(() => {
    if (mode === 'reset') return 'Kirim tautan reset';
    return isSubmitting ? 'Menghubungkan…' : 'Masuk';
  }, [isSubmitting, mode]);

  const rememberLabelId = useId();

  return (
    <div className="flex h-full flex-col justify-between rounded-3xl border border-border-subtle bg-surface p-6 shadow-sm">
      <div className="space-y-6">
        <div className="space-y-2 text-center md:text-left">
          <h2 className="text-xl font-semibold text-text">Masuk dengan Email</h2>
          <p className="text-sm text-muted">
            Gunakan email dan kata sandi untuk mengakses dashboard keuangan kamu.
          </p>
        </div>

        <div className="rounded-2xl bg-primary/5 p-4 text-sm text-primary md:text-left">
          <p className="font-semibold">Tips keamanan</p>
          <p className="mt-1 text-primary/80">Jangan bagikan kata sandi kamu dan aktifkan verifikasi ganda segera setelah masuk.</p>
        </div>

        {renderStatus()}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <TextInput
            label="Email atau Username"
            type="text"
            name="identifier"
            inputMode="text"
            autoComplete="username"
            placeholder="nama@hematwoi.app"
            value={identifier}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setIdentifier(event.target.value)}
            onBlur={() => {
              const trimmed = normalizeIdentifier(identifier);
              if (!trimmed) return;
              if (isLikelyEmail(trimmed)) {
                if (!isEmailValid(trimmed)) {
                  setIdentifierError('Masukkan email yang valid.');
                }
              } else if (!isUsernameValid(trimmed)) {
                setIdentifierError('Username hanya boleh huruf, angka, atau underscore (3-30 karakter).');
              }
            }}
            error={identifierError}
            required
          />

          {mode === 'login' ? (
            <PasswordInput
              label="Kata sandi"
              name="password"
              placeholder="••••••••"
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
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/60 border-t-transparent" aria-hidden="true" />
            ) : null}
            <span>{actionLabel}</span>
          </button>
        </form>

        {mode === 'login' ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <label htmlFor={rememberLabelId} className="flex items-center gap-2 text-sm text-text">
              <input
                id={rememberLabelId}
                type="checkbox"
                className="h-4 w-4 rounded border-border-subtle text-primary focus:ring-primary/45"
                checked={rememberIdentifier}
                onChange={(event) => setRememberIdentifier(event.target.checked)}
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
        ) : (
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
        )}
      </div>
    </div>
  );
}
