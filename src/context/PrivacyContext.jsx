import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { setPrivacyMode } from '../lib/privacy-mode';

const STORAGE_KEY = 'hw_privacy_mode';

const PrivacyContext = createContext({
  isPrivacyMode: false,
  togglePrivacyMode: () => {},
  setPrivacyMode: () => {},
});

function getInitialPrivacyMode() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(STORAGE_KEY) === 'true';
}

export function PrivacyProvider({ children }) {
  const [isPrivacyMode, setIsPrivacyMode] = useState(getInitialPrivacyMode);

  useLayoutEffect(() => {
    setPrivacyMode(isPrivacyMode);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('hw-privacy-mode', isPrivacyMode);
    }
  }, [isPrivacyMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, String(isPrivacyMode));
  }, [isPrivacyMode]);

  const togglePrivacyMode = useCallback(() => {
    setIsPrivacyMode((prev) => !prev);
  }, []);

  const value = useMemo(
    () => ({
      isPrivacyMode,
      togglePrivacyMode,
      setPrivacyMode: setIsPrivacyMode,
    }),
    [isPrivacyMode, togglePrivacyMode],
  );

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePrivacyMode() {
  return useContext(PrivacyContext);
}
