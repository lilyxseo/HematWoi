let privacyMode = false;

if (typeof window !== 'undefined') {
  const stored = window.localStorage.getItem('hw_privacy_mode');
  privacyMode = stored === 'true';
}

export function setPrivacyMode(next) {
  privacyMode = Boolean(next);
}

export function isPrivacyModeEnabled() {
  return privacyMode;
}
