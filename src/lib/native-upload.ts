import { supabase } from './supabase';
import {
  isNativePlatform,
  takePhotoOrPick,
  type NativeMediaResult,
  writeBlobToCache,
} from './native';

export type ReceiptCaptureOptions = {
  fileName?: string;
  allowEditing?: boolean;
  quality?: number;
  pathPrefix?: string;
  upsert?: boolean;
};

export type ReceiptUploadResult = {
  path: string;
  publicUrl?: string;
};

export async function captureReceiptEvidence(
  options?: ReceiptCaptureOptions
): Promise<NativeMediaResult> {
  return await takePhotoOrPick({
    fileName: options?.fileName,
    quality: options?.quality,
    allowEditing: options?.allowEditing,
  });
}

export async function uploadReceiptEvidence(
  media: NativeMediaResult,
  options?: ReceiptCaptureOptions & { bucket?: string }
): Promise<ReceiptUploadResult> {
  const bucket = options?.bucket ?? 'receipts';
  const safePrefix = formatPathPrefix(options?.pathPrefix ?? buildDefaultPrefix());
  const fileName = sanitizeFileName(options?.fileName ?? media.fileName);
  const path = `${safePrefix}/${fileName}`;

  if (isNativePlatform() && !media.cachePath) {
    await writeBlobToCache(media.blob, fileName);
  }

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, media.blob, {
      contentType: media.mimeType ?? 'application/octet-stream',
      upsert: options?.upsert ?? false,
    });

  if (error) {
    throw new Error(`Gagal mengunggah bukti transaksi: ${error.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return {
    path,
    publicUrl: data?.publicUrl,
  };
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_.-]/g, '')
    .replace(/-+/g, '-');
}

function formatPathPrefix(prefix: string): string {
  return prefix.replace(/^\/+/, '').replace(/\/+$/, '') || 'receipts';
}

function buildDefaultPrefix(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}
