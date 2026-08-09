import { describe, expect, it } from 'vitest';
import {
  filterBarangBalikanRows,
  isTripSheetName,
  matchesBarangBalikanKeyword,
  type BarangBalikanRow,
} from './barangBalikanSearch';

const baseRow: BarangBalikanRow = {
  id: 'TRIP 1::2',
  sheetName: 'TRIP 1',
  rowIndex: 2,
  originalRowId: 2,
  sku: 'SKU123',
  barcode: '8991234567890',
  namaBarang: 'GOTO PUSHCAT AUTOMATIC FEEDER BLUE',
  lokasi: 'A1-01',
  qty: 2,
  keterangan: 'Dus penyok ringan',
};

describe('barangBalikanSearch', () => {
  it('matches all tokens case-insensitively and out of order', () => {
    expect(matchesBarangBalikanKeyword(baseRow, '  pushcat   blue  ')).toBe(true);
    expect(matchesBarangBalikanKeyword(baseRow, 'BLUE goto')).toBe(true);
    expect(matchesBarangBalikanKeyword(baseRow, 'pushcat red')).toBe(false);
  });

  it('searches SKU, barcode, nama barang, lokasi, and keterangan', () => {
    expect(matchesBarangBalikanKeyword(baseRow, 'sku123')).toBe(true);
    expect(matchesBarangBalikanKeyword(baseRow, '899123')).toBe(true);
    expect(matchesBarangBalikanKeyword(baseRow, 'a1-01')).toBe(true);
    expect(matchesBarangBalikanKeyword(baseRow, 'penyok')).toBe(true);
  });

  it('keeps multiple sheets for the same SKU but removes duplicate sheet rows', () => {
    const rows: BarangBalikanRow[] = [
      baseRow,
      { ...baseRow, id: 'TRIP 2::2', sheetName: 'TRIP 2', lokasi: 'B1-02' },
      { ...baseRow },
    ];

    const result = filterBarangBalikanRows(rows, 'sku123');
    expect(result).toHaveLength(2);
    expect(result.map((row) => row.sheetName)).toEqual(['TRIP 1', 'TRIP 2']);
  });

  it('identifies only sheets containing TRIP', () => {
    expect(isTripSheetName('TRIP BANDUNG')).toBe(true);
    expect(isTripSheetName('Barang Balikan')).toBe(false);
  });
});
