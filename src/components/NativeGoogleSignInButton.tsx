import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useCallback, useState } from 'react';

import GoogleLoginButton from './GoogleLoginButton';
import { isNativePlatform } from '../lib/native';
import { signInWithGoogleNative } from '../lib/native-auth';

type SignInResult = Awaited<ReturnType<typeof signInWithGoogleNative>>;

type NativeGoogleSignInButtonProps = {
  text?: string;
  onNativeSuccess?: (response: SignInResult) => void;
  onNativeError?: (message: string) => void;
  onWebLogin?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
  nativeTriggerUrl?: string;
  webLoginUrl?: string;
  children?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'onClick'>;

export default function NativeGoogleSignInButton({
  text = 'Login dengan Google (Native)',
  onNativeSuccess,
  onNativeError,
  onWebLogin,
  nativeTriggerUrl,
  webLoginUrl,
  children,
  disabled,
  ...buttonProps
}: NativeGoogleSignInButtonProps) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleNativeSignIn = useCallback(async () => {
    if (!isNativePlatform()) return;
    setErrorMessage(null);
    setLoading(true);
    try {
      const response = await signInWithGoogleNative();
      onNativeSuccess?.(response);
    } catch (error) {
      const message = (error as Error)?.message ?? 'Gagal login dengan Google.';
      setErrorMessage(message);
      onNativeError?.(message);
    } finally {
      setLoading(false);
    }
  }, [onNativeError, onNativeSuccess]);

  if (!isNativePlatform()) {
    return (
      <GoogleLoginButton
        nativeTriggerUrl={nativeTriggerUrl}
        webLoginUrl={webLoginUrl}
        onWebLogin={onWebLogin}
        {...buttonProps}
      >
        {children ?? text.replace(' (Native)', '')}
      </GoogleLoginButton>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        {...buttonProps}
        disabled={disabled || loading}
        onClick={handleNativeSignIn}
        className={
          buttonProps.className ??
          'inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 text-sm font-semibold text-slate-950 shadow transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 disabled:cursor-not-allowed disabled:opacity-70'
        }
      >
        {children ?? (loading ? 'Menghubungkan…' : text)}
      </button>
      {errorMessage ? (
        <p className="text-sm text-danger" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
