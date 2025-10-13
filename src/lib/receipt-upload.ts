import { supabase } from './supabase';
import {
  capturePhoto,
  ensureCameraPermissions,
  isNativePlatform,
  persistTemporaryFile,
  readFileFromUri,
  removeTemporaryFile,
} from './native';

export interface ReceiptSelectionResult {
  blob: Blob;
  fileName: string;
  mimeType: string;
  previewUrl?: string | null;
  source: 'camera' | 'gallery' | 'file';
  temporaryPath?: string | null;
}

export interface ReceiptUploadOptions {
  userId: string;
  bucket?: string;
  path?: string;
}

function inferMimeType(extension?: string | null): string {
  switch ((extension ?? '').toLowerCase()) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
    case 'heif':
      return 'image/heic';
    case 'pdf':
      return 'application/pdf';
    default:
      return 'image/jpeg';
  }
}

function buildFileName(extension?: string | null): string {
  const suffix = extension ? extension.toLowerCase() : 'jpg';
  return `receipt-${Date.now()}.${suffix}`;
}

async function fetchBlobFromWebPath(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Gagal membaca data foto.');
  return response.blob();
}

async function openWebFilePicker(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.style.display = 'none';
    input.onchange = () => {
      const file = input.files?.[0] ?? null;
      input.remove();
      resolve(file);
    };
    input.click();
  });
}

export async function takePhotoOrPick(): Promise<ReceiptSelectionResult | null> {
  if (isNativePlatform()) {
    await ensureCameraPermissions();
    const photo = await capturePhoto({ allowEditing: false });
    if (!photo) return null;
    let blob: Blob | null = null;
    if (photo.path) {
      blob = await readFileFromUri(photo.path);
    } else if (photo.webPath) {
      blob = await fetchBlobFromWebPath(photo.webPath);
    }
    if (!blob) return null;
    const mimeType = inferMimeType(photo.format);
    const fileName = buildFileName(photo.format);
    const temporaryPath = await persistTemporaryFile({ data: blob, extension: photo.format ?? 'jpg' });
    return {
      blob,
      fileName,
      mimeType,
      previewUrl: photo.webPath ?? null,
      source: photo.source === 'photos' ? 'gallery' : 'camera',
      temporaryPath,
    };
  }
  const file = await openWebFilePicker();
  if (!file) return null;
  return {
    blob: file,
    fileName: file.name || buildFileName(file.type.split('/')[1] ?? undefined),
    mimeType: file.type || inferMimeType(file.name.split('.').pop()),
    previewUrl: URL.createObjectURL(file),
    source: 'file',
  };
}

export async function uploadReceipt(
  receipt: ReceiptSelectionResult,
  options: ReceiptUploadOptions
): Promise<{ path: string } | null> {
  const bucket = options.bucket ?? 'receipts';
  const uploadPath =
    options.path ?? `${options.userId}/${new Date().toISOString()}-${crypto.randomUUID?.() ?? Date.now()}`;
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(uploadPath, receipt.blob, {
        cacheControl: '3600',
        contentType: receipt.mimeType,
        upsert: true,
      });
    if (error) throw error;
    return data;
  } finally {
    if (receipt.temporaryPath) {
      void removeTemporaryFile(receipt.temporaryPath).catch((err) => {
        console.warn('[receipt-upload] gagal menghapus file sementara', err);
      });
    }
  }
}
