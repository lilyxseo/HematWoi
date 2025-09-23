import clsx from 'clsx';
import {
  FormEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  loginWithPassword,
  sendMagicLink,
  verifyMagicOtp,
  resetPassword,
  signInWithProvider,
} from '../../lib/auth';
import SocialButtons, { getAvailableSocialProviders } from './SocialButtons';

type Provider = 'google' | 'github';

type LoginCardProps = {
  onSuccess: () => void;
  initialEmail?: string;
};

type StatusState = {
  type: 'success' | 'error' | 'info';
  message: string;
};

const MIN_PASSWORD_LENGTH = 6;
const MAGIC_LINK_COOLDOWN = 45;

const emailPattern = /^(?:[a-zA-Z0-9_.'%+-]+)@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;

function validateEmail(email: string) {
  return emailPattern.test(email.trim().toLowerCase());
}

function setConnectionModeOnline() {
  try {
    localStorage.setItem('hw:connectionMode', 'online');
    localStorage.setItem('hw:mode', 'online');
  } catch {
    /* ignore */
  }
}

export default function LoginCard({ onSuccess, initialEmail = '' }: LoginCardProps) {
  const [activeTab, setActiveTab] = useState<'password' | 'magic'>('password');
  const [view, setView] = useState<'login' | 'reset'>('login');
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [status, setStatus] = useState<StatusState | null>(null);
  const [loadingAction, setLoadingAction] = useState<
    'login' | 'magic' | 'reset' | 'otp' | null
  >(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicEmail, setMagicEmail] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [otpVisible, setOtpVisible] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);
  const [resetEmail, setResetEmail] = useState(initialEmail);
  const socialProviders = useMemo(() => getAvailableSocialProviders(), []);

  const statusId = useId();
  const otpInputId = useId();
  const loginEmailId = useId();
  const passwordInputId = useId();
  const magicEmailId = useId();
  const resetEmailId = useId();

  const submitLockRef = useRef(false);
  const submitLockTimeout = useRef<number>();
  const cooldownTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    setEmail(initialEmail);
    setResetEmail(initialEmail);
  }, [initialEmail]);

  useEffect(() => {
    try {
      const remembered = localStorage.getItem('hw:rememberMe');
      if (remembered) {
        setRemember(remembered === 'true');
      }
    } catch {
      setRemember(false);
    }
  }, []);

  useEffect(() => {
    if (cooldown <= 0) {
      if (cooldownTimer.current) {
        window.clearInterval(cooldownTimer.current);
        cooldownTimer.current = undefined;
      }
      return;
    }

    if (cooldownTimer.current) {
      return;
    }

    cooldownTimer.current = window.setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownTimer.current) {
            window.clearInterval(cooldownTimer.current);
            cooldownTimer.current = undefined;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (cooldownTimer.current) {
        window.clearInterval(cooldownTimer.current);
        cooldownTimer.current = undefined;
      }
    };
  }, [cooldown]);

  useEffect(() => {
    return () => {
      if (submitLockTimeout.current) {
        window.clearTimeout(submitLockTimeout.current);
      }
      if (cooldownTimer.current) {
        window.clearInterval(cooldownTimer.current);
        cooldownTimer.current = undefined;
      }
    };
  }, []);

  const resetStatus = useCallback(() => setStatus(null), []);

  const preventRapidSubmit = () => {
    if (submitLockRef.current) {
      return true;
    }
    submitLockRef.current = true;
    window.clearTimeout(submitLockTimeout.current);
    submitLockTimeout.current = window.setTimeout(() => {
      submitLockRef.current = false;
    }, 300);
    return false;
  };

  const handleRememberChange = (value: boolean, currentEmail: string) => {
    setRemember(value);
    try {
      localStorage.setItem('hw:rememberMe', value ? 'true' : 'false');
      if (!value) {
        localStorage.removeItem('hw:lastEmail');
      } else if (currentEmail) {
        localStorage.setItem('hw:lastEmail', currentEmail);
      }
    } catch {
      /* ignore */
    }
  };

  const persistLastEmail = (value: string) => {
    try {
      if (remember) {
        localStorage.setItem('hw:lastEmail', value);
      }
    } catch {
      /* ignore */
    }
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (preventRapidSubmit() || loadingAction) {
      return;
    }

    resetStatus();
    const sanitizedEmail = email.trim().toLowerCase();

    if (!validateEmail(sanitizedEmail)) {
      setStatus({ type: 'error', message: 'Masukkan email yang valid.' });
      return;
    }

    if (password.trim().length < MIN_PASSWORD_LENGTH) {
      setStatus({
        type: 'error',
        message: `Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`,
      });
      return;
    }

    setLoadingAction('login');
    try {
      const { error } = await loginWithPassword({
        email: sanitizedEmail,
        password: password.trim(),
      });
      if (error) {
        setStatus({ type: 'error', message: error });
        return;
      }

      persistLastEmail(sanitizedEmail);
      setConnectionModeOnline();
      setStatus({ type: 'success', message: 'Berhasil masuk. Mengalihkan…' });
      onSuccess();
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[HW][auth] handleLogin', err);
      }
      setStatus({ type: 'error', message: 'Terjadi kesalahan. Coba lagi.' });
    } finally {
      setLoadingAction(null);
    }
  };

  const executeMagicLink = async (sanitizedEmail: string) => {
    setLoadingAction('magic');
    try {
      const { error } = await sendMagicLink({ email: sanitizedEmail });
      if (error) {
        setStatus({ type: 'error', message: error });
        return;
      }

      persistLastEmail(sanitizedEmail);
      setMagicLinkSent(true);
      setMagicEmail(sanitizedEmail);
      setStatus({
        type: 'success',
        message: 'Tautan login telah dikirim ke email kamu.',
      });
      setCooldown(MAGIC_LINK_COOLDOWN);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[HW][auth] executeMagicLink', err);
      }
      setStatus({ type: 'error', message: 'Terjadi kesalahan. Coba lagi.' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleMagicLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (preventRapidSubmit() || loadingAction) {
      return;
    }

    resetStatus();
    const sanitizedEmail = email.trim().toLowerCase();

    if (!validateEmail(sanitizedEmail)) {
      setStatus({ type: 'error', message: 'Masukkan email yang valid.' });
      return;
    }

    await executeMagicLink(sanitizedEmail);
  };

  const handleResendMagicLink = async () => {
    if (preventRapidSubmit() || loadingAction) {
      return;
    }

    resetStatus();
    const targetEmail = email.trim().toLowerCase() || magicEmail;

    if (!validateEmail(targetEmail)) {
      setStatus({ type: 'error', message: 'Masukkan email yang valid sebelum mengirim ulang.' });
      return;
    }

    await executeMagicLink(targetEmail);
  };

  const handleResetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (preventRapidSubmit() || loadingAction) {
      return;
    }

    resetStatus();
    const sanitizedEmail = resetEmail.trim().toLowerCase();

    if (!validateEmail(sanitizedEmail)) {
      setStatus({ type: 'error', message: 'Masukkan email yang valid.' });
      return;
    }

    setLoadingAction('reset');
    try {
      const { error } = await resetPassword({ email: sanitizedEmail });
      if (error) {
        setStatus({ type: 'error', message: error });
        return;
      }

      if (remember) {
        persistLastEmail(sanitizedEmail);
      }

      setStatus({
        type: 'success',
        message:
          'Kami telah mengirim tautan reset ke email kamu. Ikuti instruksinya untuk membuat kata sandi baru.',
      });
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[HW][auth] handleResetPassword', err);
      }
      setStatus({ type: 'error', message: 'Terjadi kesalahan. Coba lagi.' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleVerifyOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (preventRapidSubmit() || loadingAction) {
      return;
    }

    resetStatus();

    if (!magicEmail) {
      setStatus({
        type: 'error',
        message: 'Kirim magic link terlebih dahulu sebelum memasukkan kode OTP.',
      });
      return;
    }

    if (otpCode.trim().length !== 6) {
      setStatus({ type: 'error', message: 'Masukkan 6 digit kode OTP.' });
      return;
    }

    setLoadingAction('otp');
    try {
      const { data, error } = await verifyMagicOtp({
        email: magicEmail,
        token: otpCode.trim(),
        type: 'magiclink',
      });

      if (error) {
        setStatus({ type: 'error', message: error });
        return;
      }

      if (data?.session) {
        setConnectionModeOnline();
        setStatus({ type: 'success', message: 'Berhasil diverifikasi. Mengalihkan…' });
        onSuccess();
        return;
      }

      setStatus({
        type: 'info',
        message:
          'Kode OTP berhasil diterima. Jika tidak otomatis masuk, buka tautan magic link dari email kamu.',
      });
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('[HW][auth] handleVerifyOtp', err);
      }
      setStatus({ type: 'error', message: 'Terjadi kesalahan. Coba lagi.' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSocialSelect = useCallback(
    async (provider: Provider) => {
      if (loadingProvider || loadingAction) {
        return;
      }

      resetStatus();
      setLoadingProvider(provider);
      try {
        const { error } = await signInWithProvider(provider);
        if (error) {
          setStatus({ type: 'error', message: error });
          return;
        }

        setStatus({
          type: 'info',
          message: 'Mengarahkan ke penyedia login… Jika tidak muncul, cek popup di browser.',
        });
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('[HW][auth] handleSocialSelect', err);
        }
        setStatus({ type: 'error', message: 'Terjadi kesalahan. Coba lagi.' });
      } finally {
        setLoadingProvider(null);
      }
    },
    [loadingAction, loadingProvider, resetStatus]
  );

  const isLoginBusy = loadingAction === 'login';
  const isMagicBusy = loadingAction === 'magic';
  const isResetBusy = loadingAction === 'reset';
  const isOtpBusy = loadingAction === 'otp';

  const statusClassName = useMemo(() => {
    if (!status) return '';
    if (status.type === 'success') {
      return 'bg-success/10 text-success border border-success/30';
    }
    if (status.type === 'error') {
      return 'bg-danger/10 text-danger border border-danger/30';
    }
    return 'bg-info/10 text-info border border-info/30';
  }, [status]);

  const togglePasswordLabel = showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi';

  const renderLoginForm = () => (
    <form
      onSubmit={activeTab === 'password' ? handleLogin : handleMagicLink}
      className="space-y-4"
      noValidate
    >
      <div className="space-y-1">
        <label htmlFor={activeTab === 'password' ? loginEmailId : magicEmailId} className="form-label">
          Email
        </label>
        <input
          id={activeTab === 'password' ? loginEmailId : magicEmailId}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            const value = event.target.value;
            setEmail(value);
            if (remember) {
              try {
                localStorage.setItem('hw:lastEmail', value.trim().toLowerCase());
              } catch {
                /* ignore */
              }
            }
          }}
          required
          aria-invalid={status?.type === 'error' && status.message.toLowerCase().includes('email')}
          aria-describedby={status ? statusId : undefined}
          className="form-control"
        />
      </div>

      {activeTab === 'password' ? (
        <div className="space-y-1">
          <label htmlFor={passwordInputId} className="form-label">
            Kata sandi
          </label>
          <div className="relative">
            <input
              id={passwordInputId}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={MIN_PASSWORD_LENGTH}
              required
              aria-invalid={
                status?.type === 'error' && status.message.toLowerCase().includes('sandi')
              }
              aria-describedby={status ? statusId : undefined}
              className="form-control pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-sm font-medium text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
              aria-label={togglePasswordLabel}
            >
              {showPassword ? 'Sembunyi' : 'Tampil'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="inline-flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => handleRememberChange(event.target.checked, email.trim().toLowerCase())}
          />
          <span>Ingat saya</span>
        </label>
        {view === 'login' ? (
          <button
            type="button"
            onClick={() => {
              setView('reset');
              setStatus(null);
            }}
            className="text-sm font-semibold text-primary hover:underline"
          >
            Lupa kata sandi?
          </button>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={
          (activeTab === 'password' ? isLoginBusy : isMagicBusy) ||
          loadingAction !== null
        }
        className="btn btn-primary w-full"
      >
        <span className="flex items-center justify-center gap-2">
          {(activeTab === 'password' ? isLoginBusy : isMagicBusy) ? (
            <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-text-inverse border-t-transparent" />
          ) : null}
          <span>{activeTab === 'password' ? 'Masuk' : 'Kirim Magic Link'}</span>
        </span>
      </button>

      {magicLinkSent && activeTab === 'magic' ? (
        <div className="space-y-3 rounded-2xl border border-border-subtle bg-surface-alt/50 p-4 text-sm text-muted">
          <p>
            Kami telah mengirim tautan login ke <span className="font-medium text-text">{magicEmail}</span>. Buka email dan ikuti
            petunjuknya. Jika diminta kode OTP, masukkan 6 digit kode di bawah.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => {
                void handleResendMagicLink();
              }}
              disabled={isMagicBusy || cooldown > 0 || loadingAction !== null}
              className="btn w-full sm:w-auto"
            >
              {isMagicBusy ? (
                <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-border-subtle border-t-transparent" />
              ) : null}
              <span>{cooldown > 0 ? `Kirim ulang dalam ${cooldown}s` : 'Kirim ulang link'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOtpVisible((prev) => {
                  if (prev) {
                    setOtpCode('');
                  }
                  return !prev;
                });
                resetStatus();
              }}
              className="text-sm font-semibold text-primary hover:underline"
            >
              {otpVisible ? 'Sembunyikan OTP' : 'Saya punya kode OTP'}
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );

  const renderResetForm = () => (
    <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor={resetEmailId} className="form-label">
          Email terdaftar
        </label>
        <input
          id={resetEmailId}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={resetEmail}
          onChange={(event) => setResetEmail(event.target.value)}
          required
          aria-invalid={status?.type === 'error' && status.message.toLowerCase().includes('email')}
          aria-describedby={status ? statusId : undefined}
          className="form-control"
        />
      </div>
      <p className="text-sm text-muted">
        Kami akan mengirim tautan untuk mengatur ulang kata sandi. Tautan akan
        mengarahkan kamu kembali ke HematWoi setelah selesai.
      </p>
      <button type="submit" disabled={isResetBusy || loadingAction !== null} className="btn btn-primary w-full">
        <span className="flex items-center justify-center gap-2">
          {isResetBusy ? (
            <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-text-inverse border-t-transparent" />
          ) : null}
          <span>Kirim tautan reset</span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => {
          setView('login');
          setStatus(null);
        }}
        className="btn w-full"
      >
        Kembali ke login
      </button>
    </form>
  );

  return (
    <div className="w-full max-w-md rounded-3xl border border-border-subtle bg-surface p-6 shadow-sm sm:p-8">
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold text-text">Masuk ke HematWoi</h1>
          <p className="text-sm text-muted">
            Kelola keuanganmu dengan lebih cerdas. Pilih metode login favoritmu.
          </p>
        </div>

        {view === 'login' ? (
          <div className="flex rounded-full border border-border-subtle bg-surface-alt p-1 text-sm font-medium text-muted">
            <button
              type="button"
              onClick={() => {
                setActiveTab('password');
                setStatus(null);
              }}
              className={clsx(
                'flex-1 rounded-full px-3 py-2 transition',
                activeTab === 'password'
                  ? 'bg-surface text-text shadow-sm'
                  : 'hover:text-text'
              )}
            >
              Email &amp; Password
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('magic');
                setStatus(null);
              }}
              className={clsx(
                'flex-1 rounded-full px-3 py-2 transition',
                activeTab === 'magic' ? 'bg-surface text-text shadow-sm' : 'hover:text-text'
              )}
            >
              Magic Link
            </button>
          </div>
        ) : (
          <div className="text-center text-sm font-semibold text-text">Reset Kata Sandi</div>
        )}

        {status ? (
          <div
            className={clsx(
              'rounded-2xl px-4 py-3 text-sm',
              statusClassName
            )}
            role="status"
            aria-live="polite"
            id={statusId}
          >
            {status.message}
          </div>
        ) : (
          <div aria-live="polite" id={statusId} className="sr-only">
            {''}
          </div>
        )}

        {view === 'login' ? renderLoginForm() : renderResetForm()}

        {otpVisible && view === 'login' ? (
          <form onSubmit={handleVerifyOtp} className="space-y-3" noValidate>
            <div className="space-y-1">
              <label htmlFor={otpInputId} className="form-label">
                Masukkan kode OTP (6 digit)
              </label>
              <input
                id={otpInputId}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ''))}
                aria-invalid={status?.type === 'error' && status.message.toLowerCase().includes('otp')}
                aria-describedby={status ? statusId : undefined}
                className="form-control tracking-widest"
              />
            </div>
            <button type="submit" disabled={isOtpBusy || otpCode.length !== 6} className="btn btn-primary w-full">
              <span className="flex items-center justify-center gap-2">
                {isOtpBusy ? (
                  <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-text-inverse border-t-transparent" />
                ) : null}
                <span>Verifikasi OTP</span>
              </span>
            </button>
          </form>
        ) : null}

        {socialProviders.length > 0 ? (
          <>
            <div className="flex items-center gap-4 text-xs uppercase tracking-wide text-muted">
              <span className="h-px flex-1 bg-border-subtle" aria-hidden />
              <span>atau lanjut dengan</span>
              <span className="h-px flex-1 bg-border-subtle" aria-hidden />
            </div>

            <SocialButtons
              disabled={Boolean(loadingAction)}
              loadingProvider={loadingProvider}
              onSelect={handleSocialSelect}
            />
          </>
        ) : null}

        <p className="text-center text-xs text-muted">
          Dengan masuk kamu menyetujui ketentuan layanan dan kebijakan privasi HematWoi.
        </p>
      </div>
    </div>
  );
}
