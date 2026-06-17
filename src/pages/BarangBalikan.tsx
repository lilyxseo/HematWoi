import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Check, Edit2, FileSpreadsheet, Loader2, Search, X } from 'lucide-react';
import Page from '../layout/Page';
import { useToast } from '../context/ToastContext';
import {
  fetchBarangBalikanRows,
  fetchBarangBalikanTripSheets,
  updateBarangBalikanRow,
  writeBarangBalikanAudit,
  type BarangBalikanUpdateInput,
} from '../lib/barangBalikanApi';
import {
  filterBarangBalikanRows,
  isTripSheetName,
  type BarangBalikanRow,
} from '../lib/barangBalikanSearch';

const PAGE_SIZE = 25;
const EDITABLE_FIELDS = ['lokasi', 'qty', 'keterangan'] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];

type EditState = {
  rowId: string;
  field: EditableField;
  value: string;
} | null;

const sheetBadgeClasses = [
  'bg-sky-500/15 text-sky-700 ring-sky-500/25 dark:text-sky-200',
  'bg-emerald-500/15 text-emerald-700 ring-emerald-500/25 dark:text-emerald-200',
  'bg-violet-500/15 text-violet-700 ring-violet-500/25 dark:text-violet-200',
  'bg-amber-500/15 text-amber-700 ring-amber-500/25 dark:text-amber-200',
  'bg-rose-500/15 text-rose-700 ring-rose-500/25 dark:text-rose-200',
  'bg-cyan-500/15 text-cyan-700 ring-cyan-500/25 dark:text-cyan-200',
];

function getSheetBadgeClass(sheetName: string) {
  let hash = 0;
  for (const char of sheetName) hash = (hash + char.charCodeAt(0)) % sheetBadgeClasses.length;
  return sheetBadgeClasses[hash];
}

function formatValue(value: unknown) {
  return String(value ?? '').trim();
}

export default function BarangBalikan() {
  const toast = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [tripSheets, setTripSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [sheetRows, setSheetRows] = useState<Record<string, BarangBalikanRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [savingRowId, setSavingRowId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<EditState>(null);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  const loadIndex = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sheets = await fetchBarangBalikanTripSheets();
      const rowsBySheet: Record<string, BarangBalikanRow[]> = {};
      await Promise.all(
        sheets.map(async (sheetName) => {
          rowsBySheet[sheetName] = await fetchBarangBalikanRows(sheetName);
        }),
      );
      setTripSheets(sheets);
      setSheetRows(rowsBySheet);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Gagal memuat data Barang Balikan';
      setError(message);
      toast?.addToast?.({ message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadIndex();
  }, [loadIndex]);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const searchScopeSheets = useMemo(() => {
    if (selectedSheet) return [selectedSheet].filter(isTripSheetName);
    return tripSheets;
  }, [selectedSheet, tripSheets]);

  const scopedRows = useMemo(
    () => searchScopeSheets.flatMap((sheetName) => sheetRows[sheetName] ?? []),
    [searchScopeSheets, sheetRows],
  );

  const filteredRows = useMemo(
    () => filterBarangBalikanRows(scopedRows, debouncedQuery),
    [scopedRows, debouncedQuery],
  );

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const lokasiSummary = useMemo(() => {
    const uniqueLocations = new Set<string>();
    const bySheet = new Map<string, Set<string>>();

    for (const row of filteredRows) {
      const lokasi = formatValue(row.lokasi);
      if (!lokasi) continue;
      uniqueLocations.add(`${row.sheetName}::${lokasi}`);
      if (!bySheet.has(row.sheetName)) bySheet.set(row.sheetName, new Set());
      bySheet.get(row.sheetName)?.add(lokasi);
    }

    return {
      total: uniqueLocations.size,
      bySheet: Array.from(bySheet.entries()).map(([sheetName, locations]) => ({
        sheetName,
        count: locations.size,
        locations: Array.from(locations).sort((a, b) => a.localeCompare(b, 'id-ID')),
      })),
    };
  }, [filteredRows]);

  const updateLocalRow = useCallback((updated: BarangBalikanRow) => {
    setSheetRows((current) => ({
      ...current,
      [updated.sheetName]: (current[updated.sheetName] ?? []).map((row) => (row.id === updated.id ? updated : row)),
    }));
  }, []);

  const persistRowChange = useCallback(
    async (row: BarangBalikanRow, field: BarangBalikanUpdateInput['field'], value: string | number | boolean) => {
      const oldValue = row[field as keyof BarangBalikanRow] as string | number | boolean | null;
      const input: BarangBalikanUpdateInput = {
        sheetName: row.sheetName,
        rowIndex: row.rowIndex,
        originalRowId: row.originalRowId,
        field,
        value,
        sku: row.sku,
        oldValue,
      };
      setSavingRowId(row.id);
      const updated = { ...row, [field]: value } as BarangBalikanRow;
      updateLocalRow(updated);
      try {
        await updateBarangBalikanRow(input);
        try {
          await writeBarangBalikanAudit(input);
        } catch (auditError) {
          console.warn('[barang-balikan] audit trail failed', auditError);
          toast?.addToast?.({
            message: 'Perubahan tersimpan, tetapi audit trail gagal dicatat.',
            type: 'warning',
          });
        }
        toast?.addToast?.({
          message: `Barang Balikan • Sheet: ${row.sheetName} • SKU: ${row.sku || '-'} • ${field}: ${formatValue(oldValue)} → ${formatValue(value)}`,
          type: 'success',
        });
      } catch (saveError) {
        updateLocalRow(row);
        const message = saveError instanceof Error ? saveError.message : 'Gagal menyimpan perubahan';
        toast?.addToast?.({ message, type: 'error' });
      } finally {
        setSavingRowId(null);
      }
    },
    [toast, updateLocalRow],
  );

  const startEdit = (row: BarangBalikanRow, field: EditableField) => {
    setSelectedRowId(row.id);
    setEdit({ rowId: row.id, field, value: formatValue(row[field]) });
  };

  const saveEdit = async () => {
    if (!edit) return;
    const row = filteredRows.find((item) => item.id === edit.rowId);
    if (!row) return;
    await persistRowChange(row, edit.field, edit.value);
    setEdit(null);
  };

  const selectedRow = selectedRowId ? filteredRows.find((row) => row.id === selectedRowId) : null;

  const applyLocationToSelectedRow = async (lokasi: string) => {
    if (!selectedRow) {
      toast?.addToast?.({ message: 'Pilih row terlebih dahulu sebelum update lokasi.', type: 'info' });
      return;
    }
    await persistRowChange(selectedRow, 'lokasi', lokasi);
  };

  const resetFilter = () => {
    setSelectedSheet('');
    setQuery('');
    setDebouncedQuery('');
    setPage(1);
    searchInputRef.current?.focus();
  };

  return (
    <Page maxWidthClassName="max-w-7xl" className="space-y-6">
      <header className="rounded-3xl border border-border bg-surface-1 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-sm font-semibold text-brand">
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              Barang Balikan
            </div>
            <h1 className="text-2xl font-semibold text-text">Pencarian Barang Balikan lintas sheet TRIP</h1>
            <p className="max-w-3xl text-sm text-muted">
              Jika sheet kosong, pencarian otomatis memakai cache semua sheet Barang Balikan yang mengandung kata TRIP. Jika sheet dipilih, hasil dibatasi ke sheet tersebut.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadIndex()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-surface-2 px-4 text-sm font-semibold text-text transition hover:bg-border/60"
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Muat ulang cache
          </button>
        </div>
      </header>

      <section className="grid gap-4 rounded-3xl border border-border bg-surface-1 p-4 shadow-sm lg:grid-cols-[220px_1fr_auto]">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-text">Sheet</span>
          <select
            value={selectedSheet}
            onChange={(event) => {
              setSelectedSheet(event.target.value);
              setPage(1);
            }}
            className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm text-text focus:outline-none focus:ring-2 focus:ring-brand/60"
          >
            <option value="">Semua sheet TRIP</option>
            {tripSheets.map((sheetName) => (
              <option key={sheetName} value={sheetName}>{sheetName}</option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-text">Cari SKU, barcode, nama barang, lokasi, atau keterangan</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 w-full rounded-2xl border border-border bg-background pl-10 pr-10 text-sm text-text focus:outline-none focus:ring-2 focus:ring-brand/60"
              placeholder="Contoh: pushcat blue / SKU123 / A1-01"
            />
            {query ? (
              <button type="button" onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text" aria-label="Bersihkan search">
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </label>
        <div className="flex items-end">
          <button type="button" onClick={resetFilter} className="h-11 rounded-2xl border border-border px-4 text-sm font-semibold text-text transition hover:bg-border/60">
            Reset filter
          </button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-3xl border border-border bg-surface-1 p-4 shadow-sm">
          <h2 className="text-base font-semibold text-text">Lokasi</h2>
          <p className="mt-1 text-sm text-muted">{lokasiSummary.total} lokasi ditemukan</p>
          <div className="mt-4 space-y-4">
            {lokasiSummary.bySheet.map((item) => (
              <div key={item.sheetName} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className={clsx('rounded-full px-2.5 py-1 text-xs font-bold ring-1', getSheetBadgeClass(item.sheetName))}>{item.sheetName}</span>
                  <span className="text-xs text-muted">{item.count} lokasi</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.locations.slice(0, 16).map((lokasi) => (
                    <button
                      type="button"
                      key={`${item.sheetName}-${lokasi}`}
                      onClick={() => void applyLocationToSelectedRow(lokasi)}
                      className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-text transition hover:border-brand hover:text-brand"
                    >
                      {lokasi}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {lokasiSummary.bySheet.length === 0 ? <p className="text-sm text-muted">Belum ada lokasi pada hasil tampil.</p> : null}
          </div>
        </aside>

        <div className="space-y-4">
          <div className="rounded-3xl border border-border bg-surface-1 p-4 text-sm text-muted shadow-sm">
            {loading ? 'Membangun cache semua sheet TRIP…' : `Menampilkan ${visibleRows.length} dari ${filteredRows.length} data (${searchScopeSheets.length} sheet TRIP)`}
            {error ? <span className="ml-2 text-red-500">{error}</span> : null}
          </div>

          <div className="overflow-hidden rounded-3xl border border-border bg-surface-1 shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3">✓</th>
                    <th className="px-4 py-3">Sheet</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Nama Barang</th>
                    <th className="px-4 py-3">Lokasi</th>
                    <th className="px-4 py-3">Qty</th>
                    <th className="px-4 py-3">Keterangan</th>
                    <th className="px-4 py-3">Highlight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibleRows.map((row) => {
                    const rowSaving = savingRowId === row.id;
                    const rowSelected = selectedRowId === row.id;
                    return (
                      <tr key={row.id} className={clsx('transition', row.highlighted && 'bg-amber-400/10', rowSelected && 'outline outline-2 outline-brand/40')} onClick={() => setSelectedRowId(row.id)}>
                        <td className="px-4 py-3 align-top">
                          <button type="button" className={clsx('inline-flex h-7 w-7 items-center justify-center rounded-lg border', row.checked ? 'border-brand bg-brand text-brand-foreground' : 'border-border')} onClick={() => void persistRowChange(row, 'checked', !row.checked)} disabled={rowSaving} aria-label="Checklist row">
                            {row.checked ? <Check className="h-4 w-4" /> : null}
                          </button>
                        </td>
                        <td className="px-4 py-3 align-top"><span className={clsx('inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ring-1', getSheetBadgeClass(row.sheetName))}>{row.sheetName}</span></td>
                        <td className="px-4 py-3 align-top font-mono font-semibold text-text">{row.sku || '-'}</td>
                        <td className="min-w-[260px] px-4 py-3 align-top text-text">{row.namaBarang || '-'}</td>
                        {EDITABLE_FIELDS.map((field) => (
                          <td key={field} className="min-w-[140px] px-4 py-3 align-top text-text">
                            {edit?.rowId === row.id && edit.field === field ? (
                              <div className="flex min-w-[180px] gap-2">
                                <input className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-background px-2 text-sm" value={edit.value} onChange={(event) => setEdit({ ...edit, value: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter') void saveEdit(); }} autoFocus />
                                <button type="button" className="rounded-xl bg-brand px-3 text-xs font-semibold text-brand-foreground" onClick={() => void saveEdit()}>Simpan</button>
                              </div>
                            ) : (
                              <button type="button" className="group inline-flex items-center gap-2 text-left" onClick={(event) => { event.stopPropagation(); startEdit(row, field); }} disabled={rowSaving}>
                                <span>{formatValue(row[field]) || '-'}</span>
                                <Edit2 className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
                              </button>
                            )}
                          </td>
                        ))}
                        <td className="px-4 py-3 align-top">
                          <button type="button" className={clsx('rounded-full px-3 py-1 text-xs font-semibold ring-1', row.highlighted ? 'bg-amber-400/20 text-amber-700 ring-amber-400/40' : 'bg-surface-2 text-muted ring-border')} onClick={() => void persistRowChange(row, 'highlighted', !row.highlighted)} disabled={rowSaving}>
                            {row.highlighted ? 'Highlighted' : 'Normal'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {!loading && visibleRows.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted">Tidak ada data ditemukan.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-surface-1 p-4 text-sm shadow-sm">
            <span className="text-muted">Halaman {safePage} dari {totalPages}</span>
            <div className="flex gap-2">
              <button type="button" className="rounded-xl border border-border px-3 py-2 disabled:opacity-50" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage <= 1}>Sebelumnya</button>
              <button type="button" className="rounded-xl border border-border px-3 py-2 disabled:opacity-50" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={safePage >= totalPages}>Berikutnya</button>
            </div>
          </div>
        </div>
      </section>
    </Page>
  );
}
