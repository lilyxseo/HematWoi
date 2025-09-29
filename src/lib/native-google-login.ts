export const NATIVE_GOOGLE_LOGIN_URL = 'https://www.hemat-woi.me/native-google-login';

export function redirectToNativeGoogleLogin() {
  if (typeof window === 'undefined') return;
  try {
    window.location.replace(NATIVE_GOOGLE_LOGIN_URL);
  } catch {
    window.location.href = NATIVE_GOOGLE_LOGIN_URL;
  }
}
