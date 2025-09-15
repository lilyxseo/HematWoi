const KEY = 'hw:prefs';

export const defaultPrefs = {
  darkMode: false,
  density: 'comfortable',
  language: 'id',
  avatarLeveling: true,
  moneyTalk: 'normal',
  soundFx: true,
  currency: 'IDR',
  digitFormat: 'comma',
  firstDay: 1,
  pinLock: false,
  incognito: false,
};

export function getPrefs() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaultPrefs };
    const parsed = JSON.parse(raw);
    return { ...defaultPrefs, ...parsed };
  } catch {
    return { ...defaultPrefs };
  }
}

export function setPrefs(prefs) {
  localStorage.setItem(KEY, JSON.stringify(prefs));
}

export function resetPrefs() {
  setPrefs(defaultPrefs);
  return { ...defaultPrefs };
}

export function updatePrefs(partial) {
  const next = { ...getPrefs(), ...partial };
  setPrefs(next);
  return next;
}

