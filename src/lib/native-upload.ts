import { supabase } from './supabase';
import { isNativePlatform, saveBlobToTempFile, takePhotoOrPick } from './native';

export type ReceiptCaptureOptions = {
  preferredSource?: 'camera' | 'gallery';
  quality?: number;
  allowEditing?: boolean;
};

export type ReceiptCaptureResult = {
  blob: Blob;
  fileName: string;
  contentType: string;
  tempPath?: string | null;
  previewUrl?: string | null;
};

export type ReceiptUploadPayload = {
  userId: string;
  transactionId?: string;
  debtId?: string;
  bucket?: string;
  pathPrefix?: string;
};

export type ReceiptUploadResult = {
  path: string;
  publicUrl: string | null;
};

const DEFAULT_BUCKET = 'receipts';

function resolveContentType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    case 'pdf':
      return 'application/pdf';
    default:
      return 'image/jpeg';
  }
}

export async function captureReceipt(options: ReceiptCaptureOptions = {}): Promise<ReceiptCaptureResult | null> {
  const photo = await takePhotoOrPick({
    preferredSource: options.preferredSource,
    quality: options.quality,
    allowEditing: options.allowEditing,
    promptLabelHeader: 'Pilih sumber bukti transaksi',
  });

  if (!photo) return null;

  const contentType = photo.blob.type || resolveContentType(photo.fileName);
  const tempPath = await saveBlobToTempFile(photo.blob, photo.fileName);
  const previewUrl = photo.webPath ?? (tempPath && !isNativePlatform() ? tempPath : null);

  return {
    blob: photo.blob,
    fileName: photo.fileName,
    contentType,
    tempPath,
    previewUrl,
  };
}

function buildReceiptPath({ userId, transactionId, debtId, pathPrefix }: ReceiptUploadPayload, fileName: string): string {
  const safeUser = userId ?? 'anonymous';
  const segments = [safeUser];
  if (transactionId) segments.push(`transaction-${transactionId}`);
  if (debtId) segments.push(`debt-${debtId}`);
  if (pathPrefix) segments.push(pathPrefix.replace(/\/+$/, ''));
  const timestamp = Date.now();
  segments.push(`${timestamp}-${fileName}`);
  return segments.join('/');
}

export async function uploadReceipt(
  payload: ReceiptUploadPayload,
  asset: ReceiptCaptureResult
): Promise<ReceiptUploadResult> {
  const bucket = payload.bucket ?? DEFAULT_BUCKET;
  const path = buildReceiptPath(payload, asset.fileName);

  const { error } = await supabase.storage.from(bucket).upload(path, asset.blob, {
    contentType: asset.contentType,
    cacheControl: '86400',
    upsert: false,
  });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);

  return {
    path,
    publicUrl: data?.publicUrl ?? null,
  };
}
