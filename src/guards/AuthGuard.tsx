import { ReactNode, useEffect } from 'react';

function ensureLocalMode() {
  if (typeof window === 'undefined') return;

  try {
    const storage = window.localStorage;
    const hasSession = !!storage.getItem('session');
    if (!hasSession) {
      storage.setItem('hw:connectionMode', 'local');
      storage.setItem('hw:mode', 'local');
    }
  } catch {
    // ignore storage errors silently
  }
}

export default function AuthGuard({ children }: { children: ReactNode }) {
  useEffect(() => {
    ensureLocalMode();
  }, []);

  return <>{children}</>;
}
