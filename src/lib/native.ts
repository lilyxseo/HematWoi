import { Capacitor } from '@capacitor/core';
import { App, type URLOpenListenerEvent } from '@capacitor/app';
import {
  Camera,
  CameraResultType,
  CameraSource,
  type CameraPhoto,
  type PermissionStatus as CameraPermissionStatus,
} from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import {
  LocalNotifications,
  type LocalNotificationSchema,
  type PendingResult,
} from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';

const THEME_STORAGE_KEY = 'hwTheme';
const LAST_USER_STORAGE_KEY = 'hw:lastUserId';
const DEBT_CHANNEL_ID = 'hematwoi-debt-reminders';
const DEBT_NOTIFICATION_PREFIX = 'debt-reminder-';

const isPreferencesAvailable = () => Capacitor.isPluginAvailable('Preferences');
const isNotificationsAvailable = () => Capacitor.isPluginAvailable('LocalNotifications');
const isCameraAvailable = () => Capacitor.isPluginAvailable('Camera');
const isFilesystemAvailable = () => Capacitor.isPluginAvailable('Filesystem');

export const isNativePlatform = () => Capacitor.isNativePlatform();

export async function hydrateNativePreferences(): Promise<void> {
  if (!isNativePlatform() || !isPreferencesAvailable()) return;
  try {
    const { value } = await Preferences.get({ key: THEME_STORAGE_KEY });
    if (!value) return;
    if (typeof localStorage !== 'undefined') {
      const existing = localStorage.getItem(THEME_STORAGE_KEY);
      if (existing !== value) {
        localStorage.setItem(THEME_STORAGE_KEY, value);
      }
    }
    applyThemeFromStoredValue(value);
  } catch (error) {
    console.warn('[native] Failed to hydrate native preferences', error);
  }
}

function applyThemeFromStoredValue(value: string) {
  try {
    const parsed = JSON.parse(value) as {
      mode?: 'light' | 'dark' | 'system';
      brand?: { h: number; s: number; l: number };
    };
    const theme = parsed.mode ?? 'system';
    const brand = parsed.brand ?? { h: 262, s: 83, l: 67 };
    const root = document.documentElement;
    const sysDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    const effectiveTheme = theme === 'system' ? (sysDark ? 'dark' : 'light') : theme;
    root.setAttribute('data-theme', effectiveTheme);
    applyBrandToDocument(brand, effectiveTheme === 'dark');
  } catch (error) {
    console.warn('[native] Failed to apply stored theme', error);
  }
}

function applyBrandToDocument(brand: { h: number; s: number; l: number }, isDark: boolean) {
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const root = document.documentElement;
  root.style.setProperty('--brand-h', String(brand.h));
  root.style.setProperty('--brand-s', `${brand.s}%`);
  root.style.setProperty('--brand-l', `${brand.l}%`);

  const hoverLightness = clamp(brand.l + (isDark ? 6 : -7), isDark ? 18 : 8, isDark ? 96 : 92);
  const activeLightness = clamp(brand.l + (isDark ? 10 : -12), isDark ? 15 : 6, isDark ? 98 : 88);
  const softLightness = clamp(isDark ? brand.l / 2 : brand.l + 32, isDark ? 18 : 70, isDark ? 42 : 96);
  const ringLightness = clamp(brand.l + (isDark ? 4 : -14), 0, 100);

  root.style.setProperty('--color-primary-hover', `${brand.h} ${brand.s}% ${hoverLightness}%`);
  root.style.setProperty('--color-primary-active', `${brand.h} ${brand.s}% ${activeLightness}%`);
  root.style.setProperty('--color-primary-soft', `${brand.h} ${brand.s}% ${softLightness}%`);
  root.style.setProperty('--brand-soft', `hsl(${brand.h} ${brand.s}% ${softLightness}%)`);
  root.style.setProperty('--brand-ring', `hsl(${brand.h} ${brand.s}% ${ringLightness}%)`);
  root.style.setProperty('--brand', `hsl(${brand.h} ${brand.s}% ${brand.l}%)`);

  const useDarkForeground = brand.l > 65;
  root.style.setProperty('--color-primary-foreground', useDarkForeground ? '0 0% 10%' : '0 0% 100%');
  root.style.setProperty('--brand-foreground', useDarkForeground ? '#0b1220' : '#ffffff');
}

export async function saveThemePreference(payload: {
  mode: 'light' | 'dark' | 'system';
  brand: { h: number; s: number; l: number };
  accent?: string;
}): Promise<void> {
  if (!isPreferencesAvailable()) return;
  const serialized = JSON.stringify(payload);
  try {
    await Preferences.set({ key: THEME_STORAGE_KEY, value: serialized });
  } catch (error) {
    console.warn('[native] Failed to persist theme preference', error);
  }
}

export async function saveLastUserId(userId: string | null): Promise<void> {
  if (!isPreferencesAvailable()) return;
  try {
    if (userId) {
      await Preferences.set({ key: LAST_USER_STORAGE_KEY, value: userId });
    } else {
      await Preferences.remove({ key: LAST_USER_STORAGE_KEY });
    }
  } catch (error) {
    console.warn('[native] Failed to persist last user id', error);
  }
}

export async function getLastUserId(): Promise<string | null> {
  if (!isPreferencesAvailable()) return null;
  try {
    const { value } = await Preferences.get({ key: LAST_USER_STORAGE_KEY });
    return value ?? null;
  } catch (error) {
    console.warn('[native] Failed to read last user id', error);
    return null;
  }
}

export const NativePreferences = {
  async get(key: string): Promise<string | null> {
    if (isPreferencesAvailable()) {
      const { value } = await Preferences.get({ key });
      return value ?? null;
    }
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    if (isPreferencesAvailable()) {
      await Preferences.set({ key, value });
      return;
    }
    try {
      localStorage?.setItem(key, value);
    } catch {
      /* noop */
    }
  },
  async remove(key: string): Promise<void> {
    if (isPreferencesAvailable()) {
      await Preferences.remove({ key });
      return;
    }
    try {
      localStorage?.removeItem(key);
    } catch {
      /* noop */
    }
  },
  async clear(): Promise<void> {
    if (isPreferencesAvailable()) {
      await Preferences.clear();
      return;
    }
    try {
      localStorage?.clear();
    } catch {
      /* noop */
    }
  },
};

export async function requestNotificationPermission(): Promise<'granted' | 'denied'> {
  if (!isNotificationsAvailable()) {
    if (typeof Notification !== 'undefined') {
      const status = await Notification.requestPermission();
      return status === 'granted' ? 'granted' : 'denied';
    }
    return 'denied';
  }
  const current = await LocalNotifications.checkPermissions();
  if (current.display === 'granted') return 'granted';
  const next = await LocalNotifications.requestPermissions();
  return next.display === 'granted' ? 'granted' : 'denied';
}

export async function ensureDebtReminderChannel(): Promise<void> {
  if (!isNotificationsAvailable() || !isNativePlatform()) return;
  try {
    await LocalNotifications.createChannel({
      id: DEBT_CHANNEL_ID,
      name: 'Pengingat Hutang',
      description: 'Pengingat otomatis sebelum jatuh tempo hutang',
      importance: 4,
      visibility: 1,
      sound: undefined,
    });
  } catch (error) {
    console.warn('[native] Failed to create notification channel', error);
  }
}

function computeReminderDate(dueDateIso: string): Date | null {
  if (!dueDateIso) return null;
  const due = new Date(dueDateIso);
  if (Number.isNaN(due.getTime())) return null;
  const reminder = new Date(due.getTime());
  reminder.setDate(reminder.getDate() - 7);
  if (reminder.getTime() <= Date.now()) return null;
  return reminder;
}

function createDebtNotificationId(debtId: string): number {
  const hash = [...(DEBT_NOTIFICATION_PREFIX + debtId)].reduce((acc, char) => acc * 33 + char.charCodeAt(0), 5381);
  return Math.abs(hash);
}

export async function scheduleDebtReminder(options: {
  debtId: string;
  title: string;
  body: string;
  dueDate: string;
  extra?: Record<string, unknown>;
}): Promise<void> {
  if (!isNotificationsAvailable()) return;
  const triggerAt = computeReminderDate(options.dueDate);
  if (!triggerAt) return;
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') return;
  await ensureDebtReminderChannel();
  const notification: LocalNotificationSchema = {
    id: createDebtNotificationId(options.debtId),
    title: options.title,
    body: options.body,
    schedule: { at: triggerAt },
    extra: { ...options.extra, debtId: options.debtId, dueDate: options.dueDate },
    channelId: isNativePlatform() ? DEBT_CHANNEL_ID : undefined,
  };
  try {
    await LocalNotifications.schedule({ notifications: [notification] });
  } catch (error) {
    console.warn('[native] Failed to schedule debt reminder', error);
  }
}

export async function cancelDebtReminder(debtId: string): Promise<void> {
  if (!isNotificationsAvailable()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: createDebtNotificationId(debtId) }] });
  } catch (error) {
    console.warn('[native] Failed to cancel debt reminder', error);
  }
}

export async function listPendingDebtReminders(): Promise<PendingResult | null> {
  if (!isNotificationsAvailable()) return null;
  try {
    return await LocalNotifications.getPending();
  } catch (error) {
    console.warn('[native] Failed to list pending reminders', error);
    return null;
  }
}

export async function capturePhoto(options?: {
  allowEditing?: boolean;
  source?: 'camera' | 'photos';
}): Promise<CameraPhoto | null> {
  if (isCameraAvailable()) {
    try {
      return await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source:
          options?.source === 'photos'
            ? CameraSource.Photos
            : options?.source === 'camera'
              ? CameraSource.Camera
              : CameraSource.Prompt,
        allowEditing: options?.allowEditing ?? false,
        quality: 80,
      });
    } catch (error) {
      if (!(error instanceof Error && error.message?.includes('User cancelled'))) {
        console.warn('[native] Failed to capture photo', error);
      }
      return null;
    }
  }
  return null;
}

export async function readFileFromUri(uri: string): Promise<Blob | null> {
  if (isFilesystemAvailable()) {
    try {
      const result = await Filesystem.readFile({ path: uri });
      const data = result.data;
      if (!data) return null;
      const byteCharacters = atob(data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i += 1) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      return new Blob([new Uint8Array(byteNumbers)]);
    } catch (error) {
      console.warn('[native] Failed to read file from uri', error);
      return null;
    }
  }
  return null;
}

export async function persistTemporaryFile(options: {
  data: Blob;
  extension?: string;
}): Promise<string | null> {
  if (!isFilesystemAvailable()) return null;
  try {
    const buffer = await options.data.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    const path = `temp/${Date.now()}.${options.extension ?? 'jpg'}`;
    await Filesystem.writeFile({
      directory: Directory.Cache,
      path,
      data: base64,
      recursive: true,
    });
    return path;
  } catch (error) {
    console.warn('[native] Failed to persist temporary file', error);
    return null;
  }
}

export async function removeTemporaryFile(path: string): Promise<void> {
  if (!isFilesystemAvailable()) return;
  try {
    await Filesystem.deleteFile({ directory: Directory.Cache, path });
  } catch (error) {
    console.warn('[native] Failed to remove temporary file', error);
  }
}

type DeepLinkHandler = (url: URL, event: URLOpenListenerEvent) => void;

const deepLinkHandlers = new Set<DeepLinkHandler>();
let appUrlListenerAttached = false;

function ensureAppUrlListener() {
  if (appUrlListenerAttached || !Capacitor.isPluginAvailable('App')) return;
  App.addListener('appUrlOpen', (event) => {
    if (!event?.url) return;
    try {
      const url = new URL(event.url);
      deepLinkHandlers.forEach((handler) => {
        try {
          handler(url, event);
        } catch (error) {
          console.error('[native] deeplink handler failed', error);
        }
      });
    } catch (error) {
      console.warn('[native] Unable to parse deeplink url', event.url, error);
    }
  });
  appUrlListenerAttached = true;
}

export function addDeepLinkListener(handler: DeepLinkHandler): () => void {
  deepLinkHandlers.add(handler);
  ensureAppUrlListener();
  return () => {
    deepLinkHandlers.delete(handler);
  };
}

export type CameraPermissions = CameraPermissionStatus;

export async function ensureCameraPermissions(): Promise<CameraPermissions> {
  if (!isCameraAvailable()) {
    return {
      camera: 'granted',
      photos: 'granted',
      prompt: false,
      limited: false,
    } as CameraPermissionStatus;
  }
  const status = await Camera.checkPermissions();
  if (status.camera === 'granted' && status.photos === 'granted') return status;
  return Camera.requestPermissions({ permissions: ['camera', 'photos'] });
}
