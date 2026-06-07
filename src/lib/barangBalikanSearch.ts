export type BarangBalikanRow = {
  id: string;
  sheetName: string;
  rowIndex: number;
  originalRowId?: string | number | null;
  sku: string;
  barcode: string;
  namaBarang: string;
  lokasi: string;
  qty: string | number;
  keterangan: string;
  checked?: boolean;
  highlighted?: boolean;
};

export type BarangBalikanSearchField = keyof Pick<
  BarangBalikanRow,
  'sku' | 'barcode' | 'namaBarang' | 'lokasi' | 'keterangan'
>;

export const BARANG_BALIKAN_SEARCH_FIELDS: BarangBalikanSearchField[] = [
  'sku',
  'barcode',
  'namaBarang',
  'lokasi',
  'keterangan',
];

export function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .toLocaleLowerCase('id-ID')
    .trim()
    .replace(/\s+/g, ' ');
}

export function tokenizeSearch(keyword: string): string[] {
  return normalizeSearchText(keyword).split(' ').filter(Boolean);
}

export function isTripSheetName(sheetName: string): boolean {
  return normalizeSearchText(sheetName).includes('trip');
}

export function buildSearchHaystack(row: BarangBalikanRow): string {
  return BARANG_BALIKAN_SEARCH_FIELDS.map((field) => normalizeSearchText(row[field])).join(' ');
}

export function matchesBarangBalikanKeyword(row: BarangBalikanRow, keyword: string): boolean {
  const tokens = tokenizeSearch(keyword);
  if (tokens.length === 0) return true;
  const haystack = buildSearchHaystack(row);
  return tokens.every((token) => haystack.includes(token));
}

export function filterBarangBalikanRows(rows: BarangBalikanRow[], keyword: string): BarangBalikanRow[] {
  const seen = new Set<string>();
  const result: BarangBalikanRow[] = [];

  for (const row of rows) {
    const uniqueKey = `${row.sheetName}::${row.originalRowId ?? row.rowIndex}`;
    if (seen.has(uniqueKey)) continue;
    if (!matchesBarangBalikanKeyword(row, keyword)) continue;
    seen.add(uniqueKey);
    result.push(row);
  }

  return result;
}
