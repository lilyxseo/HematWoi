import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';
import GoogleLoginButton from './GoogleLoginButton';
import {
  initializeGoogleNative,
  isGoogleNativeAvailable,
  signInWithGoogleNative,
  type NativeGoogleSessionResult,
} from '../lib/native-auth';

type GoogleLoginButtonBaseProps = Parameters<typeof GoogleLoginButton>[0];

interface GoogleNativeLoginButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'onClick'> {
  textNative?: string;
  textWeb?: string;
  loadingText?: string;
  children?: ReactNode;
  onNativeSuccess?: (result: NativeGoogleSessionResult) => void;
  onNativeError?: (error: Error) => void;
  onNativeStart?: () => void;
  onWebLogin?: GoogleLoginButtonBaseProps['onWebLogin'];
  renderError?: (message: string) => ReactNode;
  renderContent?: (context: { loading: boolean; status: NativeState }) => ReactNode;
}

type NativeState = 'checking' | 'ready' | 'unavailable';

export default function GoogleNativeLoginButton({
  textNative = 'Login dengan Google (Native)',
  textWeb = 'Lanjutkan dengan Google',
  loadingText = 'Menghubungkan…',
  children,
  className,
  disabled,
  onNativeSuccess,
  onNativeError,
  onNativeStart,
  onWebLogin,
  renderError,
  renderContent,
  ...rest
}: GoogleNativeLoginButtonProps) {
  const [status, setStatus] = useState<NativeState>(() =>
    isGoogleNativeAvailable() ? 'checking' : 'unavailable'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'checking') return;
    let active = true;
    initializeGoogleNative()
      .then(() => {
        if (!active) return;
        setStatus('ready');
      })
      .catch((err) => {
        if (!active) return;
        const normalized = err instanceof Error ? err : new Error(String(err));
        setError(normalized.message);
        setStatus('unavailable');
        onNativeError?.(normalized);
      });
    return () => {
      active = false;
    };
  }, [onNativeError, status]);

  const handleNativeLogin = useCallback(async () => {
    setError(null);
    onNativeStart?.();
    setLoading(true);
    try {
      const result = await signInWithGoogleNative();
      await onNativeSuccess?.(result);
    } catch (err) {
      const normalized = err instanceof Error ? err : new Error(String(err));
      setError(normalized.message);
      onNativeError?.(normalized);
    } finally {
      setLoading(false);
    }
  }, [onNativeError, onNativeSuccess]);

  const buttonLabel = useMemo(() => {
    if (loading) return loadingText;
    return textNative;
  }, [loading, loadingText, textNative]);

  if (status !== 'ready') {
    const fallbackProps: GoogleLoginButtonBaseProps = {
      ...(rest as GoogleLoginButtonBaseProps),
      className,
      onWebLogin,
    };
    return (
      <>
        <GoogleLoginButton {...fallbackProps}>
          {renderContent ? renderContent({ loading, status }) : children ?? textWeb}
        </GoogleLoginButton>
        {error && renderError ? renderError(error) : null}
      </>
    );
  }

  const content = renderContent ? renderContent({ loading, status }) : children ?? buttonLabel;

  return (
    <>
      <button
        type="button"
        {...rest}
        className={clsx(className, 'inline-flex items-center justify-center gap-2')}
        onClick={handleNativeLogin}
        disabled={disabled || loading}
      >
        {content}
      </button>
      {error && (renderError ? renderError(error) : <p className="mt-2 text-sm text-red-400">{error}</p>)}
    </>
  );
}
