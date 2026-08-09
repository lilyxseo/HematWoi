import { supabase } from './supabase';
import type { BarangBalikanRow } from './barangBalikanSearch';
import { isTripSheetName } from './barangBalikanSearch';

export type BarangBalikanSheetPayload = {
  name?: string;
  title?: string;
  sheetName?: string;
};

export type BarangBalikanUpdateInput = {
  sheetName: string;
  rowIndex: number;
  originalRowId?: string | number | null;
  field: keyof Pick<BarangBalikanRow, 'lokasi' | 'qty' | 'keterangan' | 'checked' | 'highlighted'>;
  value: string | number | boolean;
  sku: string;
  oldValue: string | number | boolean | null;
};

const API_URL = import.meta.env.VITE_BARANG_BALIKAN_API_URL ?? import.meta.env.VITE_HEMATWOI_BARANG_BALIKAN_URL ?? '';
const API_SECRET = import.meta.env.VITE_BARANG_BALIKAN_API_SECRET ?? '';

async function postBarangBalikan<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!API_URL) {
    throw new Error('Missing VITE_BARANG_BALIKAN_API_URL');
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action,
      secret: API_SECRET || undefined,
      ...payload,
    }),
  });

  if (!response.ok) {
    throw new Error(`Barang Balikan API HTTP error: ${response.status}`);
  }

  const json = await response.json();
  if (json?.ok === false) {
    throw new Error(json.error || 'Barang Balikan API failed');
  }
  return json as T;
}

function normalizeSheetName(input: BarangBalikanSheetPayload | string): string {
  if (typeof input === 'string') return input;
  return String(input.sheetName ?? input.name ?? input.title ?? '').trim();
}

function valueFromAliases(row: Record<string, unknown>, aliases: string[]): unknown {
  for (const alias of aliases) {
    if (row[alias] != null) return row[alias];
    const foundKey = Object.keys(row).find((key) => key.trim().toLocaleLowerCase('id-ID') === alias.toLocaleLowerCase('id-ID'));
    if (foundKey && row[foundKey] != null) return row[foundKey];
  }
  return '';
}

export function normalizeBarangBalikanRow(raw: Record<string, unknown>, sheetName: string, index: number): BarangBalikanRow {
  const rowIndexValue = valueFromAliases(raw, ['rowIndex', 'row_index', '_rowIndex', 'No Row', 'Row']);
  const parsedRowIndex = Number(rowIndexValue);
  const rowIndex = Number.isFinite(parsedRowIndex) && parsedRowIndex > 0 ? parsedRowIndex : index + 2;
  const originalRowId = valueFromAliases(raw, ['originalRowId', 'original_row_id', 'id', 'ID']) || rowIndex;
  const sku = String(valueFromAliases(raw, ['SKU', 'Sku', 'sku']) ?? '').trim();

  return {
    id: `${sheetName}::${originalRowId || rowIndex}`,
    sheetName,
    rowIndex,
    originalRowId,
    sku,
    barcode: String(valueFromAliases(raw, ['Barcode', 'BARCODE', 'barcode', 'Kode Barcode']) ?? '').trim(),
    namaBarang: String(valueFromAliases(raw, ['Nama Barang', 'Nama', 'Product Name', 'namaBarang', 'nama_barang']) ?? '').trim(),
    lokasi: String(valueFromAliases(raw, ['Lokasi', 'lokasi', 'Location']) ?? '').trim(),
    qty: valueFromAliases(raw, ['Qty', 'QTY', 'qty', 'Quantity', 'Jumlah']) as string | number,
    keterangan: String(valueFromAliases(raw, ['Keterangan', 'keterangan', 'Ket', 'Note', 'Catatan']) ?? '').trim(),
    checked: Boolean(valueFromAliases(raw, ['Checklist', 'Checked', 'checked', 'checklist'])),
    highlighted: Boolean(valueFromAliases(raw, ['Highlight', 'Highlighted', 'highlighted', 'highlight'])),
  };
}

export async function fetchBarangBalikanTripSheets(): Promise<string[]> {
  const json = await postBarangBalikan<{ sheets?: BarangBalikanSheetPayload[] | string[] }>('listSheets');
  return (json.sheets ?? []).map(normalizeSheetName).filter((name) => name && isTripSheetName(name));
}

export async function fetchBarangBalikanRows(sheetName: string): Promise<BarangBalikanRow[]> {
  const json = await postBarangBalikan<{ rows?: Record<string, unknown>[] }>('getSheetData', { sheetName });
  return (json.rows ?? []).map((row, index) => normalizeBarangBalikanRow(row, sheetName, index));
}

export async function updateBarangBalikanRow(input: BarangBalikanUpdateInput): Promise<void> {
  await postBarangBalikan('updateRow', input as unknown as Record<string, unknown>);
}

export async function writeBarangBalikanAudit(input: BarangBalikanUpdateInput): Promise<void> {
  const { data } = await supabase.auth.getUser();
  await postBarangBalikan('auditTrail', {
    module: 'Barang Balikan',
    sheetName: input.sheetName,
    sku: input.sku,
    field: input.field,
    oldValue: input.oldValue,
    newValue: input.value,
    userId: data.user?.id ?? null,
    userEmail: data.user?.email ?? null,
    timestamp: new Date().toISOString(),
  });
}
