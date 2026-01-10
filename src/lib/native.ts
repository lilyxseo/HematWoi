import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { App } from '@capacitor/app';
import type { URLOpenListenerEvent } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import {
  LocalNotifications,
  type LocalNotificationSchema,
  type ScheduleOptions,
} from '@capacitor/local-notifications';
import {
  Camera,
  CameraResultType,
  CameraSource,
  type CameraPhoto,
} from '@capacitor/camera';
import { Directory, Filesystem } from '@capacitor/filesystem';

const NATIVE_UI_KEY = 'hematwoi:native:ui';
const NATIVE_LAST_USER_KEY = 'hematwoi:native:last-user';
const NATIVE_ACCENT_KEY = 'hematwoi:native:accent';
const NATIVE_DEBT_CHANNEL = 'hematwoi-debts';

export type NativeBrand = {
  h: number;
  s: number;
  l: number;
};

export type NativeUiState = {
  theme?: string;
  brand?: NativeBrand | null;
  accentKey?: string | null;
  lastUserId?: string | null;
};

export type DeepLinkHandler = (url: string) => Promise<boolean> | boolean;

export type NativeMediaResult = {
  blob: Blob;
  fileName: string;
  mimeType: string;
  base64Data?: string;
  cachePath?: string;
  webPath?: string;
};

let appListener: PluginListenerHandle | null = null;
let launchUrlChecked = false;
const deepLinkHandlers = new Set<DeepLinkHandler>();
let ensureListenerPromise: Promise<void> | null = null;
let notificationChannelReady = false;

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export function isAndroid(): boolean {
  return Capacitor.getPlatform() === 'android';
}

export function isIos(): boolean {
  return Capacitor.getPlatform() === 'ios';
}

export async function hydrateNativeAppState(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!isNativePlatform()) return;

  const uiState = await getStoredNativeUiState();
  if (uiState) {
    const { theme, brand, accentKey, lastUserId } = uiState;
    if (theme || brand) {
      const stored = readLocalJson('hwTheme');
      const nextValue = {
        ...stored,
        ...(theme ? { mode: theme } : {}),
        ...(brand ? { brand } : {}),
      };
      writeLocalJson('hwTheme', nextValue);
      applyThemeToDocument(nextValue.mode ?? 'system', nextValue.brand ?? undefined);
    }

    if (accentKey) {
      const prefStored = readLocalJson('hematwoi:v3:prefs');
      writeLocalJson('hematwoi:v3:prefs', {
        ...prefStored,
        accent: accentKey,
      });
    }

    if (lastUserId) {
      try {
        window.localStorage.setItem('hw:lastUserId', lastUserId);
      } catch (error) {
        console.warn('Gagal menyimpan last user id ke localStorage', error);
      }
    }
  }
}

export async function setNativeThemePreference(theme: string): Promise<void> {
  if (!isNativePlatform()) return;
  await mergeNativeUiState({ theme });
}

export async function setNativeBrandPreference(
  brand: NativeBrand,
  accentKey?: string
): Promise<void> {
  if (!isNativePlatform()) return;
  await mergeNativeUiState({ brand, accentKey: accentKey ?? null });
  if (accentKey) {
    await Preferences.set({ key: NATIVE_ACCENT_KEY, value: accentKey });
  }
}

export async function setNativeLastUserPreference(userId: string | null): Promise<void> {
  if (!isNativePlatform()) return;
  if (userId) {
    await Preferences.set({ key: NATIVE_LAST_USER_KEY, value: userId });
    await mergeNativeUiState({ lastUserId: userId });
  } else {
    await Preferences.remove({ key: NATIVE_LAST_USER_KEY });
    await mergeNativeUiState({ lastUserId: null });
  }
}

export async function getLastNativeUserId(): Promise<string | null> {
  if (!isNativePlatform()) return null;
  const [primary, fallback] = await Promise.all([
    Preferences.get({ key: NATIVE_LAST_USER_KEY }),
    Preferences.get({ key: `${NATIVE_UI_KEY}:lastUser` }),
  ]);
  return primary.value ?? fallback.value ?? null;
}

export function registerNativeDeepLinkHandler(handler: DeepLinkHandler): () => void {
  deepLinkHandlers.add(handler);
  void ensureNativeAppListener();
  return () => {
    deepLinkHandlers.delete(handler);
  };
}

export async function getInitialDeepLink(): Promise<string | null> {
  if (!isNativePlatform()) return null;
  try {
    const launchUrl = await App.getLaunchUrl();
    return launchUrl?.url ?? null;
  } catch (error) {
    console.warn('Gagal membaca launch url', error);
    return null;
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  try {
    const result = await LocalNotifications.requestPermissions();
    return result?.display === 'granted';
  } catch (error) {
    console.error('Gagal meminta izin notifikasi lokal', error);
    return false;
  }
}

export async function scheduleDebtReminderNotification(
  notification: Pick<LocalNotificationSchema, 'title' | 'body'> & {
    id: number;
    triggerDate: Date;
    extra?: Record<string, unknown>;
  }
): Promise<void> {
  if (!isNativePlatform()) return;
  const granted = await requestNotificationPermissions();
  if (!granted) {
    console.warn('Izin notifikasi lokal tidak diberikan. Notifikasi diabaikan.');
    return;
  }
  await ensureNotificationChannel();
  const schedule: ScheduleOptions = {
    at: notification.triggerDate,
    allowWhileIdle: true,
  };
  await LocalNotifications.schedule({
    notifications: [
      {
        id: notification.id,
        title: notification.title,
        body: notification.body,
        schedule,
        sound: isAndroid() ? 'default' : undefined,
        smallIcon: isAndroid() ? 'ic_stat_icon' : undefined,
        channelId: isAndroid() ? NATIVE_DEBT_CHANNEL : undefined,
        extra: {
          type: 'debt-reminder',
          ...(notification.extra ?? {}),
        },
      },
    ],
  });
}

export async function cancelDebtReminderNotification(id: number): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch (error) {
    console.error('Gagal membatalkan notifikasi hutang', error);
  }
}

export async function takePhotoOrPick(options?: {
  fileName?: string;
  allowEditing?: boolean;
  quality?: number;
  source?: CameraSource;
  accept?: string;
}): Promise<NativeMediaResult> {
  if (isNativePlatform()) {
    const photo = await Camera.getPhoto({
      quality: options?.quality ?? 85,
      allowEditing: options?.allowEditing ?? false,
      resultType: CameraResultType.Base64,
      promptLabelHeader: 'Pilih sumber foto',
      promptLabelPhoto: 'Galeri',
      promptLabelPicture: 'Kamera',
      promptLabelCancel: 'Batal',
      source: options?.source ?? CameraSource.Prompt,
    });
    return await normalizeCameraPhoto(photo, options?.fileName);
  }

  return await pickFileFromInput(options?.accept ?? 'image/*');
}

export async function writeBlobToCache(
  blob: Blob,
  fileName: string
): Promise<string | undefined> {
  if (!isNativePlatform()) return undefined;
  try {
    const base64 = await blobToBase64(blob);
    await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache,
    });
    return fileName;
  } catch (error) {
    console.warn('Gagal menyimpan file ke cache sementara', error);
    return undefined;
  }
}

async function ensureNativeAppListener(): Promise<void> {
  if (!isNativePlatform()) return;
  if (ensureListenerPromise) {
    await ensureListenerPromise;
    return;
  }
  ensureListenerPromise = (async () => {
    if (!appListener) {
      try {
        appListener = await App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
          const url = event?.url;
          if (url) {
            void dispatchDeepLink(url);
          }
        });
      } catch (error) {
        console.error('Gagal menambahkan listener appUrlOpen', error);
      }
    }
    if (!launchUrlChecked) {
      launchUrlChecked = true;
      const launch = await App.getLaunchUrl();
      if (launch?.url) {
        await dispatchDeepLink(launch.url);
      }
    }
  })();
  await ensureListenerPromise;
}

async function dispatchDeepLink(url: string): Promise<void> {
  for (const handler of Array.from(deepLinkHandlers)) {
    try {
      const handled = await handler(url);
      if (handled) {
        return;
      }
    } catch (error) {
      console.error('Handler deeplink native gagal', error);
    }
  }
}

async function ensureNotificationChannel(): Promise<void> {
  if (!isNativePlatform() || notificationChannelReady || !isAndroid()) return;
  try {
    await LocalNotifications.createChannel({
      id: NATIVE_DEBT_CHANNEL,
      name: 'Pengingat Hutang',
      description: 'Notifikasi pengingat hutang HematWoi',
      importance: 4,
      sound: 'default',
      visibility: 1,
      lights: true,
      vibration: true,
    });
    notificationChannelReady = true;
  } catch (error) {
    console.warn('Gagal membuat kanal notifikasi', error);
  }
}

async function normalizeCameraPhoto(
  photo: CameraPhoto,
  fileName?: string
): Promise<NativeMediaResult> {
  if (!photo.base64String) {
    throw new Error('Foto tidak memiliki data base64');
  }
  const extension = photo.format ?? 'jpeg';
  const mimeType = extension === 'png' ? 'image/png' : `image/${extension}`;
  const blob = base64ToBlob(photo.base64String, mimeType);
  const resolvedName = fileName ?? `hematwoi-receipt-${Date.now()}.${extension}`;
  let cachePath: string | undefined;
  try {
    await Filesystem.writeFile({
      data: photo.base64String,
      path: resolvedName,
      directory: Directory.Cache,
    });
    cachePath = resolvedName;
  } catch (error) {
    console.warn('Gagal menulis foto ke cache', error);
  }
  return {
    blob,
    fileName: resolvedName,
    mimeType,
    base64Data: photo.base64String,
    cachePath,
    webPath: photo.webPath ?? photo.path,
  };
}

async function pickFileFromInput(accept: string): Promise<NativeMediaResult> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('File picker tidak tersedia di lingkungan ini');
  }
  return await new Promise<NativeMediaResult>((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';

    const cleanup = () => {
      input.remove();
    };

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      cleanup();
      if (!file) {
        reject(new Error('Tidak ada file yang dipilih'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = typeof reader.result === 'string' ? reader.result.split(',')[1] : undefined;
        resolve({
          blob: file,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          base64Data: base64,
          cachePath: undefined,
          webPath: URL.createObjectURL(file),
        });
      };
      reader.onerror = () => {
        reject(new Error('Gagal membaca file yang dipilih'));
      };
      reader.readAsDataURL(file);
    });

    input.addEventListener('cancel', () => {
      cleanup();
      reject(new Error('Pemilihan file dibatalkan'));
    });

    document.body.appendChild(input);
    input.click();
  });
}

async function mergeNativeUiState(partial: NativeUiState): Promise<void> {
  const current = await getStoredNativeUiState();
  const next: NativeUiState = {
    ...current,
    ...partial,
  };
  await Preferences.set({
    key: NATIVE_UI_KEY,
    value: JSON.stringify(next),
  });
}

async function getStoredNativeUiState(): Promise<NativeUiState | null> {
  try {
    const raw = await Preferences.get({ key: NATIVE_UI_KEY });
    if (!raw.value) return null;
    return JSON.parse(raw.value) as NativeUiState;
  } catch (error) {
    console.warn('Gagal membaca native UI state', error);
    return null;
  }
}

function readLocalJson(key: string): Record<string, unknown> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function writeLocalJson(key: string, value: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Gagal menulis localStorage', error);
  }
}

function applyThemeToDocument(themeMode: unknown, brandValue?: unknown): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const theme = typeof themeMode === 'string' ? themeMode : 'system';
  const brand =
    brandValue && typeof brandValue === 'object'
      ? (brandValue as NativeBrand)
      : undefined;

  const prefersDark =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false;
  const resolvedTheme = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
  root.setAttribute('data-theme', resolvedTheme);

  if (!brand) return;

  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

  const hoverLightness = clamp(
    brand.l + (resolvedTheme === 'dark' ? 6 : -7),
    resolvedTheme === 'dark' ? 18 : 8,
    resolvedTheme === 'dark' ? 96 : 92
  );
  const activeLightness = clamp(
    brand.l + (resolvedTheme === 'dark' ? 10 : -12),
    resolvedTheme === 'dark' ? 15 : 6,
    resolvedTheme === 'dark' ? 98 : 88
  );
  const softLightness = clamp(brand.l + 32, 70, 96);
  const ringLightness = clamp(brand.l + (resolvedTheme === 'dark' ? 4 : -14), 0, 100);
  const useDarkForeground = brand.l > 70;

  root.style.setProperty('--brand-h', String(brand.h));
  root.style.setProperty('--brand-s', `${brand.s}%`);
  root.style.setProperty('--brand-l', `${brand.l}%`);
  root.style.setProperty('--brand', `hsl(${brand.h} ${brand.s}% ${brand.l}%)`);
  root.style.setProperty(
    '--color-primary-hover',
    `${brand.h} ${brand.s}% ${hoverLightness}%`
  );
  root.style.setProperty(
    '--color-primary-active',
    `${brand.h} ${brand.s}% ${activeLightness}%`
  );
  root.style.setProperty(
    '--color-primary-soft',
    `${brand.h} ${brand.s}% ${softLightness}%`
  );
  root.style.setProperty('--brand-soft', `hsl(${brand.h} ${brand.s}% ${softLightness}%)`);
  root.style.setProperty('--brand-ring', `hsl(${brand.h} ${brand.s}% ${ringLightness}%)`);
  root.style.setProperty(
    '--color-primary-foreground',
    useDarkForeground ? '0 0% 10%' : '0 0% 100%'
  );
  root.style.setProperty(
    '--brand-foreground',
    useDarkForeground ? '#0b1220' : '#ffffff'
  );
}

function decodeBase64(value: string): string {
  if (typeof atob === 'function') {
    return atob(value);
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(value, 'base64').toString('binary');
  }
  throw new Error('Decoder base64 tidak tersedia di lingkungan ini');
}

function base64ToBlob(base64Data: string, mimeType: string): Blob {
  const byteCharacters = decodeBase64(base64Data);
  const byteArrays = [];
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i += 1) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }
  return new Blob(byteArrays, { type: mimeType });
}

async function blobToBase64(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Gagal mengonversi blob ke base64'));
        return;
      }
      const result = reader.result.split(',')[1];
      resolve(result ?? '');
    };
    reader.onerror = () => reject(new Error('Gagal membaca blob'));
    reader.readAsDataURL(blob);
  });
}
