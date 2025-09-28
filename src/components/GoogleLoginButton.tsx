import type { ButtonHTMLAttributes, MouseEvent } from 'react';
import { isHematWoiApp } from '../lib/ua';

const DEFAULT_GOOGLE_WEB_LOGIN_URL = 'https://hw.bydev.me/auth/google';
const DEFAULT_NATIVE_TRIGGER_URL = 'https://hw.bydev.me/native-google-login';

type GoogleLoginButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'type'> & {
  text?: string;
  nativeTriggerUrl?: string;
  webLoginUrl?: string;
  onWebLogin?: (event: MouseEvent<HTMLButtonElement>) => void | Promise<void>;
};

export default function GoogleLoginButton({
  text = 'Login dengan Google',
  nativeTriggerUrl = DEFAULT_NATIVE_TRIGGER_URL,
  webLoginUrl = DEFAULT_GOOGLE_WEB_LOGIN_URL,
  onWebLogin,
  children,
  ...rest
}: GoogleLoginButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    if (isHematWoiApp()) {
      if (typeof window !== 'undefined') {
        window.location.href = nativeTriggerUrl;
      }
      return;
    }

    if (onWebLogin) {
      void onWebLogin(event);
      return;
    }

    if (typeof window !== 'undefined') {
      window.location.href = webLoginUrl;
    }
  };

  return (
    <button type="button" onClick={handleClick} {...rest}>
      {children ?? text}
    </button>
  );
}
