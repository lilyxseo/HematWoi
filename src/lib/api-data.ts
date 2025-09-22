import { supabase } from './supabase';
import { listTransactions as legacyListTransactions, getTransactionsSummary as legacySummary } from './api';
import { getCurrentUserId } from './session';

interface ListTransactionParams {
  q?: string;
  type?: string;
  categoryId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  sort?: string;
  page?: number;
  pageSize?: number;
}

interface BulkUpdateParams {
  ids: string[];
  patch: Record<string, unknown>;
}

interface CsvParseResult {
  headers: string[];
  rows: Array<Record<string, string>>;
  delimiter: string;
  encoding: string;
}

interface MappingOptions {
  date: string;
  type?: string;
  category?: string;
  account?: string;
  amount: string;
  note?: string;
  tags?: string;
}

type ImportRow = Record<string, any>;

interface MapOptions {
  autoCreateCategories?: boolean;
  skipDuplicates?: boolean;
  existingCategories?: Map<string, { id: string; type?: string | null }>; // normalized by lowercase name
  existingAccounts?: Map<string, { id: string }>; // normalized by lowercase name
  existingHashes?: Set<string>;
  userId?: string | null;
}

interface MapResultRow {
  original: Record<string, string>;
  status: 'ok' | 'warning' | 'error';
  message?: string;
  mapped?: ImportRow & { hash: string };
  hash?: string;
}

interface MapRowsResult {
  rows: MapResultRow[];
  valid: (ImportRow & { hash: string })[];
  missingCategories: Set<string>;
  duplicateHashes: Set<string>;
}

interface ChunkInsertOptions {
  chunkSize?: number;
  onProgress?: (payload: {
    processed: number;
    total: number;
    inserted: number;
    failed: number;
  }) => void;
}

function logDevError(scope: string, error: unknown) {
  if (import.meta.env.DEV) {
    console.error(`[HW][data:${scope}]`, error);
  }
}

function wrapError(scope: string, error: unknown) {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Terjadi kesalahan';
  return new Error(`${scope}: ${message}`);
}

function normalizeSort(sort?: string) {
  if (!sort) return 'date-desc';
  const allowed = new Set(['date-desc', 'date-asc', 'amount-desc', 'amount-asc']);
  return allowed.has(sort) ? sort : 'date-desc';
}

function readFileAsText(file: File, encoding: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      reader.abort();
      reject(new Error('Gagal membaca file'));
    };
    reader.onload = () => {
      resolve(String(reader.result || ''));
    };
    try {
      reader.readAsText(file, encoding as BufferEncoding);
    } catch (err) {
      reject(err);
    }
  });
}

function detectEncoding(file: File) {
  const type = file.type || '';
  if (/charset=([^;]+)/i.test(type)) {
    const match = type.match(/charset=([^;]+)/i);
    if (match) return match[1];
  }
  return 'utf-8';
}

function detectDelimiter(sample: string) {
  const candidates = [',', ';', '\t'];
  const lines = sample.split(/\r?\n/).filter(Boolean);
  const target = lines.slice(0, 5);
  let best = ',';
  let bestScore = -Infinity;
  for (const delimiter of candidates) {
    let variance = 0;
    let lastLength: number | null = null;
    for (const line of target) {
      const length = line.split(delimiter).length;
      if (lastLength != null) {
        variance += Math.abs(length - lastLength);
      }
      lastLength = length;
    }
    const score = (target[0]?.split(delimiter).length || 0) - variance;
    if (score > bestScore) {
      bestScore = score;
      best = delimiter;
    }
  }
  return best;
}

function normalizeType(value: string | undefined) {
  if (!value) return null;
  const normalized = value.toLowerCase().trim();
  if (['income', 'in', 'pemasukan', 'masuk', 'credit'].includes(normalized)) return 'income';
  if (['expense', 'out', 'pengeluaran', 'keluar', 'debit'].includes(normalized)) return 'expense';
  if (['transfer', 'tf', 'pindah', 'mutasi'].includes(normalized)) return 'transfer';
  return null;
}

function parseNumber(value: string | undefined) {
  if (!value) return Number.NaN;
  const trimmed = value.trim();
  if (!trimmed) return Number.NaN;
  const normalized = trimmed
    .replace(/\s+/g, '')
    .replace(/IDR|Rp|idr|rp|\.00/g, '')
    .replace(/[^0-9.,-]/g, '');
  const hasComma = normalized.includes(',');
  const hasDot = normalized.includes('.');
  let candidate = normalized;
  if (hasComma && hasDot) {
    if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
      candidate = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      candidate = normalized.replace(/,/g, '');
    }
  } else if (hasComma && !hasDot) {
    candidate = normalized.replace(/\./g, '').replace(',', '.');
  } else {
    candidate = normalized.replace(/,/g, '');
  }
  const parsed = Number.parseFloat(candidate);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function normalizeDate(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidates = [trimmed];
  if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}$/.test(trimmed)) {
    const parts = trimmed.split(/[\/-]/);
    if (parts.length === 3) {
      const [a, b, c] = parts;
      const year = c.length === 2 ? Number.parseInt(`20${c}`, 10) : Number.parseInt(c, 10);
      const monthFirst = `${year}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`;
      const dayFirst = `${year}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
      candidates.push(monthFirst, dayFirst);
    }
  }
  for (const candidate of candidates) {
    const date = new Date(candidate);
    if (!Number.isNaN(date.getTime())) {
      const iso = new Date(date.getTime());
      iso.setHours(0, 0, 0, 0);
      return iso.toISOString();
    }
  }
  return null;
}

function safeTrim(value: string | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function listTransactions(params: ListTransactionParams = {}) {
  try {
    const { q, type, categoryId, dateFrom, dateTo, sort, page, pageSize } = params;
    const filters: Record<string, unknown> = {
      search: q || '',
      sort: normalizeSort(sort),
      page: page || 1,
      pageSize: pageSize || 20,
    };
    if (type && type !== 'all') filters.type = type;
    if (categoryId) filters.categories = [categoryId];
    if (dateFrom) filters.startDate = dateFrom;
    if (dateTo) filters.endDate = dateTo;

    const [{ rows, total, page: currentPage, pageSize: limit }, summary] = await Promise.all([
      legacyListTransactions(filters),
      legacySummary(filters),
    ]);
    return { rows, total, page: currentPage, pageSize: limit, summary };
  } catch (error) {
    logDevError('listTransactions', error);
    throw wrapError('Gagal memuat transaksi', error);
  }
}

export async function bulkDeleteTransactions(ids: string[]) {
  try {
    if (!ids || ids.length === 0) {
      return { deleted: 0 };
    }
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('User belum masuk');
    }
    const { data, error } = await supabase
      .from('transactions')
      .delete()
      .eq('user_id', userId)
      .in('id', ids)
      .select('id');
    if (error) throw error;
    return { deleted: data?.length ?? 0 };
  } catch (error) {
    logDevError('bulkDeleteTransactions', error);
    throw wrapError('Gagal menghapus transaksi', error);
  }
}

export async function bulkUpdateTransactions({ ids, patch }: BulkUpdateParams) {
  try {
    if (!ids || ids.length === 0) {
      return { updated: 0 };
    }
    const sanitized: Record<string, unknown> = {};
    Object.entries(patch || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        sanitized[key] = value;
      }
    });
    if (Object.keys(sanitized).length === 0) {
      return { updated: 0 };
    }
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('User belum masuk');
    }
    const { data, error } = await supabase
      .from('transactions')
      .update(sanitized)
      .eq('user_id', userId)
      .in('id', ids)
      .select('id');
    if (error) throw error;
    return { updated: data?.length ?? 0 };
  } catch (error) {
    logDevError('bulkUpdateTransactions', error);
    throw wrapError('Gagal memperbarui transaksi', error);
  }
}

function toCsvValue(value: unknown) {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function exportTransactionsCSV(params: ListTransactionParams = {}) {
  try {
    const result = await listTransactions(params);
    const headers = ['Tanggal', 'Tipe', 'Kategori', 'Akun', 'Jumlah', 'Catatan'];
    const rows = result.rows.map((row: any) => [
      row.date ? new Date(row.date).toISOString().slice(0, 10) : '',
      row.type || '',
      row.category?.name || '',
      row.account?.name || '',
      row.amount ?? '',
      row.title || row.notes || '',
    ]);
    const csv = [headers.map(toCsvValue).join(','), ...rows.map((cells) => cells.map(toCsvValue).join(','))].join('\n');
    return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  } catch (error) {
    logDevError('exportTransactionsCSV', error);
    throw wrapError('Gagal mengekspor CSV', error);
  }
}

export async function parseCsv(file: File): Promise<CsvParseResult> {
  try {
    const encoding = detectEncoding(file);
    const text = await readFileAsText(file, encoding);
    const delimiter = detectDelimiter(text);
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
    if (lines.length === 0) {
      return { headers: [], rows: [], delimiter, encoding };
    }
    const headers = lines[0].split(delimiter).map((h) => h.trim());
    const rows: Array<Record<string, string>> = [];
    for (let i = 1; i < lines.length; i += 1) {
      const values = lines[i].split(delimiter);
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        record[header] = values[index]?.trim() ?? '';
      });
      rows.push(record);
    }
    return { headers, rows, delimiter, encoding };
  } catch (error) {
    logDevError('parseCsv', error);
    throw wrapError('Gagal membaca CSV', error);
  }
}

export function computeHash(tx: { user_id?: string | null; date?: string | null; amount?: number | string; title?: string | null }) {
  const user = tx.user_id ?? '';
  const date = tx.date ?? '';
  const amount = typeof tx.amount === 'number' ? tx.amount.toFixed(2) : safeTrim(String(tx.amount ?? ''));
  const note = tx.title ?? '';
  return `${user}|${date}|${amount}|${note}`;
}

export function dedupeCandidates(rows: Array<{ id: string; user_id?: string | null; date?: string | null; amount?: number; title?: string | null }>) {
  try {
    const buckets = new Map<string, Array<typeof rows[number]>>();
    rows.forEach((row) => {
      const hash = computeHash(row);
      if (!buckets.has(hash)) {
        buckets.set(hash, []);
      }
      buckets.get(hash)!.push(row);
    });
    return Array.from(buckets.values()).filter((bucket) => bucket.length > 1);
  } catch (error) {
    logDevError('dedupeCandidates', error);
    throw wrapError('Gagal mengelompokkan duplikat', error);
  }
}

function normalizeTags(value: string | undefined) {
  if (!value) return null;
  const parts = value
    .split(/[,;#]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(',');
}

export function mapRowsToTransactions(
  rows: Array<Record<string, string>>,
  mapping: MappingOptions,
  options: MapOptions = {},
): MapRowsResult {
  const results: MapResultRow[] = [];
  const valid: (ImportRow & { hash: string })[] = [];
  const missingCategories = new Set<string>();
  const duplicateHashes = new Set<string>();
  const normalizedCategories = options.existingCategories || new Map();
  const normalizedAccounts = options.existingAccounts || new Map();
  const seenHashes = new Set(options.existingHashes || []);
  const userId = options.userId ?? null;

  rows.forEach((original) => {
    try {
      const dateValue = mapping.date ? original[mapping.date] : undefined;
      const amountValue = mapping.amount ? original[mapping.amount] : undefined;
      const typeValue = mapping.type ? original[mapping.type] : undefined;
      const categoryValue = mapping.category ? original[mapping.category] : undefined;
      const accountValue = mapping.account ? original[mapping.account] : undefined;
      const noteValue = mapping.note ? original[mapping.note] : undefined;
      const tagsValue = mapping.tags ? original[mapping.tags] : undefined;

      const normalizedDate = normalizeDate(dateValue || undefined);
      if (!normalizedDate) {
        results.push({ original, status: 'error', message: 'Tanggal tidak valid' });
        return;
      }
      const parsedAmount = parseNumber(amountValue);
      if (!Number.isFinite(parsedAmount) || parsedAmount === 0) {
        results.push({ original, status: 'error', message: 'Jumlah tidak valid' });
        return;
      }
      const normalizedType = normalizeType(typeValue || '');
      if (!normalizedType) {
        results.push({ original, status: 'error', message: 'Tipe tidak dikenal' });
        return;
      }
      const mapped: ImportRow & { hash: string } = {
        user_id: userId || undefined,
        date: normalizedDate,
        type: normalizedType as 'income' | 'expense' | 'transfer',
        amount: Number(parsedAmount.toFixed(2)),
        title: safeTrim(noteValue) || undefined,
        notes: safeTrim(noteValue) || undefined,
        tags: normalizeTags(tagsValue) || undefined,
        account_id: undefined,
        category_id: undefined,
      } as ImportRow & { hash: string };

      if (categoryValue) {
        const key = categoryValue.toLowerCase().trim();
        if (key && normalizedCategories.has(key)) {
          mapped.category_id = normalizedCategories.get(key)!.id as any;
        } else if (key) {
          missingCategories.add(categoryValue.trim());
        }
      }

      if (accountValue) {
        const key = accountValue.toLowerCase().trim();
        if (key && normalizedAccounts.has(key)) {
          mapped.account_id = normalizedAccounts.get(key)!.id as any;
        }
      }

      const hash = computeHash({ user_id: userId ?? undefined, date: mapped.date, amount: mapped.amount, title: mapped.title || '' });
      mapped.hash = hash;

      if (options.skipDuplicates && seenHashes.has(hash)) {
        duplicateHashes.add(hash);
        results.push({ original, status: 'warning', message: 'Duplikat dilewati', hash });
        return;
      }

      seenHashes.add(hash);
      valid.push(mapped);
      results.push({ original, status: 'ok', mapped, hash });
    } catch (error) {
      logDevError('mapRowsToTransactions.row', error);
      results.push({ original, status: 'error', message: 'Gagal memproses baris' });
    }
  });

  return { rows: results, valid, missingCategories, duplicateHashes };
}

export async function insertTransactionsChunked(
  rows: (ImportRow & { hash?: string })[],
  options: ChunkInsertOptions = {},
) {
  try {
    const chunkSize = options.chunkSize && options.chunkSize > 0 ? options.chunkSize : 500;
    const userId = await getCurrentUserId();
    if (!userId) {
      throw new Error('User belum masuk');
    }
    const total = rows.length;
    let processed = 0;
    let inserted = 0;
    let failed = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize).map((row) => ({
        ...row,
        user_id: userId,
      }));
      try {
        const { data, error } = await supabase.from('transactions').insert(chunk).select('id');
        if (error) throw error;
        inserted += data?.length ?? chunk.length;
      } catch (error) {
        failed += chunk.length;
        logDevError('insertTransactionsChunked.chunk', error);
      }
      processed += chunk.length;
      options.onProgress?.({ processed, total, inserted, failed });
    }
    if (failed > 0) {
      throw new Error(`Sebagian data gagal diimpor (${failed} baris)`);
    }
    return { inserted, failed };
  } catch (error) {
    logDevError('insertTransactionsChunked', error);
    throw wrapError('Gagal mengimpor transaksi', error);
  }
}

export async function ensureCategories(
  names: Iterable<string>,
  type: 'income' | 'expense' | 'transfer' | 'mixed' = 'expense',
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('User belum masuk');
    const normalized = Array.from(new Set(Array.from(names).map((name) => name.trim()).filter(Boolean)));
    if (normalized.length === 0) {
      return [];
    }
    const { data: existing, error: existingError } = await supabase
      .from('categories')
      .select('id, name, type')
      .eq('user_id', userId)
      .in('name', normalized);
    if (existingError) throw existingError;
    const existingNames = new Set(existing?.map((item) => item.name) ?? []);
    const toCreate = normalized.filter((name) => !existingNames.has(name));
    if (toCreate.length === 0) {
      return existing || [];
    }
    const payload = toCreate.map((name) => ({
      name,
      type: type === 'mixed' ? 'expense' : type,
      user_id: userId,
    }));
    const { data: inserted, error: insertError } = await supabase
      .from('categories')
      .insert(payload)
      .select('id, name, type');
    if (insertError) throw insertError;
    return [...(existing || []), ...(inserted || [])];
  } catch (error) {
    logDevError('ensureCategories', error);
    throw wrapError('Gagal membuat kategori', error);
  }
}

