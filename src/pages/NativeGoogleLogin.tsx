import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import GoogleLoginButton, {
  DEFAULT_GOOGLE_WEB_LOGIN_URL,
  DEFAULT_NATIVE_TRIGGER_URL,
} from '../components/GoogleLoginButton';
import { isHematWoiApp } from '../lib/ua';

const httpPattern = /^https?:\/\//i;

export default function NativeGoogleLogin() {
  const navigate = useNavigate();
  const [isNativeApp] = useState(() => isHematWoiApp());
  const [showManualTrigger, setShowManualTrigger] = useState(false);

  const targetUrl = useMemo(() => DEFAULT_NATIVE_TRIGGER_URL, []);
  const fallbackWebLoginUrl = useMemo(() => DEFAULT_GOOGLE_WEB_LOGIN_URL, []);
  const canTriggerNative =
    isNativeApp && Boolean(targetUrl) && !httpPattern.test(targetUrl) && /^[a-z][a-z0-9+.-]*:/i.test(targetUrl);
  const manualTriggerHref = canTriggerNative ? targetUrl : fallbackWebLoginUrl;

  useEffect(() => {
    if (!isNativeApp) {
      navigate('/', { replace: true });
      return;
    }

    if (!canTriggerNative) {
      setShowManualTrigger(true);
      return;
    }

    setShowManualTrigger(false);

    const triggerTimeout = window.setTimeout(() => {
      window.location.href = targetUrl;
    }, 150);

    const fallbackTimeout = window.setTimeout(() => {
      setShowManualTrigger(true);
    }, 3000);

    return () => {
      window.clearTimeout(triggerTimeout);
      window.clearTimeout(fallbackTimeout);
    };
  }, [canTriggerNative, isNativeApp, navigate, targetUrl]);

  if (!isNativeApp) {
    return null;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 py-12 text-center text-text">
      <div className="max-w-md space-y-5">
        <h1 className="text-2xl font-semibold">Membuka aplikasi HematWoi...</h1>
        <p className="text-sm text-muted">
          Kami sedang membuka aplikasi HematWoi agar kamu bisa melanjutkan proses login Google secara mulus di
          perangkat ini.
        </p>
        {showManualTrigger && (
          <button
            type="button"
            onClick={() => {
              window.location.href = manualTriggerHref;
            }}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow"
          >
            Buka aplikasi secara manual
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            navigate('/', { replace: true });
          }}
          className="inline-flex w-full items-center justify-center rounded-2xl border border-border-subtle px-4 py-2 text-sm font-semibold text-text"
        >
          Gunakan versi web saja
        </button>
        <div className="rounded-2xl border border-border-subtle bg-surface-alt px-4 py-3 text-left text-xs text-muted">
          <p className="font-semibold text-text">Perlu login ulang?</p>
          <p>
            Kamu bisa mencoba login ulang melalui tombol Google berikut. Jika proses login berhasil, aplikasi akan
            terbuka secara otomatis.
          </p>
          <GoogleLoginButton
            className="mt-3 w-full rounded-2xl bg-surface px-4 py-2 text-sm font-semibold text-text"
            nativeTriggerUrl={targetUrl}
            webLoginUrl={fallbackWebLoginUrl}
          />
        </div>
      </div>
    </main>
  );
}
