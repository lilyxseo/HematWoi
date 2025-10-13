import { Capacitor } from '@capacitor/core';

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const memoryStore = new Map<string, string>();

function getFallbackStorage(): StorageLike {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }

  return {
    getItem: (key: string) => (memoryStore.has(key) ? memoryStore.get(key)! : null),
    setItem: (key: string, value: string) => {
      memoryStore.set(key, value);
    },
    removeItem: (key: string) => {
      memoryStore.delete(key);
    },
  };
}

export const isNativePlatform = (): boolean => Capacitor.isNativePlatform();

export const getNativePlatform = (): string => Capacitor.getPlatform();

export async function readJsonPreference<T>(key: string, fallback: T): Promise<T> {
  if (isNativePlatform()) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      const result = await Preferences.get({ key });
      if (!result.value) {
        return fallback;
      }
      return JSON.parse(result.value) as T;
    } catch (error) {
      console.warn('[native] Failed to read preference from Capacitor store', key, error);
    }
  }

  try {
    const store = getFallbackStorage();
    const raw = store.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn('[native] Failed to read preference from local storage', key, error);
    return fallback;
  }
}

export async function writeJsonPreference<T>(key: string, value: T | null): Promise<void> {
  const serialized = value == null ? null : JSON.stringify(value);

  if (isNativePlatform()) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      if (serialized == null) {
        await Preferences.remove({ key });
      } else {
        await Preferences.set({ key, value: serialized });
      }
      return;
    } catch (error) {
      console.warn('[native] Failed to write preference to Capacitor store', key, error);
    }
  }

  const store = getFallbackStorage();
  if (serialized == null) {
    store.removeItem(key);
  } else {
    store.setItem(key, serialized);
  }
}

export async function clearPreference(key: string): Promise<void> {
  await writeJsonPreference(key, null);
}

export type NotificationPermissionResult = {
  granted: boolean;
  canRequest: boolean;
  reason?: string;
};

export async function ensureLocalNotificationPermission(): Promise<NotificationPermissionResult> {
  if (isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const status = await LocalNotifications.checkPermissions();
      if (status.display === 'granted') {
        return { granted: true, canRequest: false };
      }

      if (status.display === 'denied') {
        return { granted: false, canRequest: false, reason: 'denied' };
      }

      const request = await LocalNotifications.requestPermissions();
      return {
        granted: request.display === 'granted',
        canRequest: false,
      };
    } catch (error) {
      console.warn('[native] Failed to request local notification permission', error);
      return { granted: false, canRequest: false, reason: 'error' };
    }
  }

  if (typeof Notification !== 'undefined') {
    if (Notification.permission === 'granted') {
      return { granted: true, canRequest: false };
    }
    if (Notification.permission === 'denied') {
      return { granted: false, canRequest: false, reason: 'denied' };
    }

    try {
      const result = await Notification.requestPermission();
      return { granted: result === 'granted', canRequest: false };
    } catch (error) {
      console.warn('[native] Failed to request Notification permission on web', error);
      return { granted: false, canRequest: false, reason: 'error' };
    }
  }

  return { granted: false, canRequest: false, reason: 'unsupported' };
}

export type ScheduleNotificationInput = {
  id: number;
  title: string;
  body: string;
  scheduleAt: Date;
  channelId?: string;
  extra?: Record<string, unknown>;
};

export async function scheduleLocalNotification({
  id,
  title,
  body,
  scheduleAt,
  channelId,
  extra,
}: ScheduleNotificationInput): Promise<boolean> {
  if (Number.isNaN(scheduleAt.getTime())) {
    console.warn('[native] Attempted to schedule notification with invalid date');
    return false;
  }

  const permission = await ensureLocalNotificationPermission();
  if (!permission.granted) {
    return false;
  }

  if (isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await ensureDefaultNotificationChannel(channelId);
      await LocalNotifications.schedule({
        notifications: [
          {
            id,
            title,
            body,
            schedule: { at: scheduleAt },
            channelId,
            extra,
          },
        ],
      });
      return true;
    } catch (error) {
      console.error('[native] Failed to schedule local notification', error);
      return false;
    }
  }

  if (typeof Notification !== 'undefined') {
    const delay = Math.max(scheduleAt.getTime() - Date.now(), 0);
    setTimeout(() => {
      try {
        new Notification(title, { body });
      } catch (error) {
        console.warn('[native] Failed to trigger web notification fallback', error);
      }
    }, delay);
    return true;
  }

  return false;
}

export async function cancelLocalNotifications(ids: number[]): Promise<void> {
  if (!ids.length) return;

  if (isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.cancel({ notifications: ids.map((notificationId) => ({ id: notificationId })) });
    } catch (error) {
      console.warn('[native] Failed to cancel notifications', ids, error);
    }
    return;
  }
}

async function ensureDefaultNotificationChannel(channelId?: string) {
  if (!channelId || getNativePlatform() !== 'android') {
    return;
  }

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const channels = await LocalNotifications.listChannels();
    const exists = channels.find((channel) => channel.id === channelId);
    if (!exists) {
      await LocalNotifications.createChannel({
        id: channelId,
        name: 'HematWoi Reminders',
        importance: 4,
        description: 'Pengingat transaksi dan hutang HematWoi',
      });
    }
  } catch (error) {
    console.warn('[native] Failed to ensure Android notification channel', error);
  }
}

export type NativePhotoResult = {
  blob: Blob;
  format: string;
  fileName: string;
  webPath?: string;
  source: 'camera' | 'gallery';
};

const BASE64_PREFIX = /^data:([\w/+.-]+);base64,/i;

function decodeBase64(data: string): Uint8Array {
  if (typeof atob === 'function') {
    const byteCharacters = atob(data);
    const byteArrays: number[] = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i += 1) {
      byteArrays[i] = byteCharacters.charCodeAt(i);
    }
    return new Uint8Array(byteArrays);
  }

  const buffer = Buffer.from(data, 'base64');
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

function encodeBase64(buffer: ArrayBuffer): string {
  if (typeof btoa === 'function') {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  return Buffer.from(buffer).toString('base64');
}

function base64ToBlob(base64: string, contentType: string): Blob {
  const cleaned = base64.replace(BASE64_PREFIX, '');
  const byteArray = decodeBase64(cleaned);
  return new Blob([byteArray], { type: contentType });
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  return encodeBase64(buffer);
}

export type PhotoOptions = {
  promptLabelHeader?: string;
  quality?: number;
  allowEditing?: boolean;
  preferredSource?: 'camera' | 'gallery';
};

export async function takePhotoOrPick({
  promptLabelHeader,
  quality = 80,
  allowEditing = false,
  preferredSource,
}: PhotoOptions = {}): Promise<NativePhotoResult | null> {
  if (isNativePlatform()) {
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const source =
        preferredSource === 'camera'
          ? CameraSource.Camera
          : preferredSource === 'gallery'
            ? CameraSource.Photos
            : CameraSource.Prompt;

      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Base64,
        source,
        promptLabelHeader,
        quality,
        allowEditing,
      });

      if (!photo || !photo.base64String) {
        return null;
      }

      const format = photo.format ?? 'jpeg';
      const fileName = `receipt-${Date.now()}.${format}`;
      const contentType = photo.mimeType ?? `image/${format}`;
      const blob = base64ToBlob(photo.base64String, contentType);

      return {
        blob,
        format,
        fileName,
        source: source === CameraSource.Camera ? 'camera' : 'gallery',
      };
    } catch (error) {
      if ((error as { message?: string })?.message === 'User cancelled photos app') {
        return null;
      }
      console.error('[native] Failed to capture/select photo', error);
      throw error;
    }
  }

  if (typeof document === 'undefined') {
    return null;
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      if (!input.files || input.files.length === 0) {
        resolve(null);
        return;
      }
      const file = input.files[0];
      resolve({
        blob: file,
        format: file.type.split('/')[1] ?? 'jpeg',
        fileName: file.name,
        webPath: URL.createObjectURL(file),
        source: 'gallery',
      });
    });
    input.addEventListener('error', () => reject(new Error('File picker error')));
    document.body.appendChild(input);
    input.click();
    setTimeout(() => {
      document.body.removeChild(input);
    }, 0);
  });
}

export async function saveBlobToTempFile(blob: Blob, fileName: string): Promise<string | null> {
  if (isNativePlatform()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const base64 = await blobToBase64(blob);
      const path = `hematwoi/${Date.now()}-${fileName}`;
      await Filesystem.writeFile({
        data: base64,
        path,
        directory: Directory.Cache,
      });
      return path;
    } catch (error) {
      console.error('[native] Failed to persist blob to Capacitor Filesystem', error);
      return null;
    }
  }

  if (typeof URL !== 'undefined') {
    return URL.createObjectURL(blob);
  }

  return null;
}

export async function removeTempFile(path: string): Promise<void> {
  if (!path) return;

  if (isNativePlatform()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      await Filesystem.deleteFile({ path, directory: Directory.Cache });
    } catch (error) {
      console.warn('[native] Failed to remove temp file', path, error);
    }
  } else if (typeof URL !== 'undefined') {
    URL.revokeObjectURL(path);
  }
}

export async function configureNativeAppearance(): Promise<void> {
  if (!isNativePlatform()) return;

  try {
    const [{ SplashScreen }, { StatusBar, Style }] = await Promise.all([
      import('@capacitor/splash-screen'),
      import('@capacitor/status-bar'),
    ]);

    await StatusBar.setBackgroundColor({ color: '#0e0f11' });
    await StatusBar.setStyle({ style: Style.Dark });
    await SplashScreen.hide({ fadeOutDuration: 150 });
  } catch (error) {
    console.warn('[native] Failed to configure native appearance', error);
  }
}

export async function hydrateNativePreferenceIntoLocalStorage(key: string): Promise<void> {
  const data = await readJsonPreference(key, null);
  if (data == null) {
    return;
  }

  const store = getFallbackStorage();
  try {
    store.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn('[native] Failed to hydrate preference into local storage', key, error);
  }
}

export async function hydrateMultiplePreferences(keys: string[]): Promise<void> {
  await Promise.all(keys.map((key) => hydrateNativePreferenceIntoLocalStorage(key)));
}

function hashToNotificationId(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  const normalized = Math.abs(hash) % 100000;
  return normalized + 1;
}

export type DebtReminderPayload = {
  debtId: string;
  dueDate: Date | string;
  debtorName?: string;
  amountLabel?: string;
};

export async function scheduleDebtReminderNotification(payload: DebtReminderPayload): Promise<boolean> {
  const dueDate = payload.dueDate instanceof Date ? payload.dueDate : new Date(payload.dueDate);
  if (Number.isNaN(dueDate.getTime())) {
    console.warn('[native] Invalid due date for debt reminder', payload);
    return false;
  }

  const reminderTimestamp = dueDate.getTime() - 7 * 24 * 60 * 60 * 1000;
  const reminderDate = new Date(reminderTimestamp);
  if (reminderTimestamp <= Date.now()) {
    return false;
  }

  const title = 'Pengingat hutang HematWoi';
  const debtorName = payload.debtorName ? ` untuk ${payload.debtorName}` : '';
  const amount = payload.amountLabel ? ` sebesar ${payload.amountLabel}` : '';
  const body = `Hutang${debtorName}${amount} akan jatuh tempo pada ${dueDate.toLocaleDateString('id-ID')}!`;

  const id = hashToNotificationId(payload.debtId);

  return scheduleLocalNotification({
    id,
    title,
    body,
    scheduleAt: reminderDate,
    channelId: 'hematwoi-reminders',
    extra: {
      debtId: payload.debtId,
      dueDate: dueDate.toISOString(),
    },
  });
}
