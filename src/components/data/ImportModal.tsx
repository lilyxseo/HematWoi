// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, FileUp, Loader2, TriangleAlert, Upload } from 'lucide-react';
import {
  parseCsv,
  mapRowsToTransactions,
  ensureCategories,
  insertTransactionsChunked,
} from '../../lib/api-data';

const PRESETS = {
  wallet: {
    label: 'Wallet',
    mapping: { date: 'Date', amount: 'Amount', type: 'Type', category: 'Category', note: 'Description' },
  },
  monarch: {
    label: 'Monarch',
    mapping: { date: 'Date', amount: 'Amount', type: 'Transaction Type', category: 'Category', note: 'Memo' },
  },
  ynab: {
    label: 'YNAB',
    mapping: { date: 'Date', amount: 'Amount', type: 'Type', category: 'Category', note: 'Memo', account: 'Account' },
  },
};

function ModalShell({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
      <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center justify-center rounded-full border border-border px-3 text-sm"
          >
            Tutup
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">{children}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> OK
      </span>
    );
  }
  if (status === 'warning') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
        <TriangleAlert className="h-3 w-3" /> Warning
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
      <TriangleAlert className="h-3 w-3" /> Error
    </span>
  );
}

export default function ImportModal({
  open,
  onClose,
  onImported,
  existingCategories,
  existingAccounts,
  existingHashes,
  userId,
}) {
  const [step, setStep] = useState(0);
  const [fileInfo, setFileInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({ date: '', amount: '', type: '', category: '', account: '', note: '', tags: '' });
  const [preview, setPreview] = useState(null);
  const [autoCreateCategory, setAutoCreateCategory] = useState(true);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [progress, setProgress] = useState({ processed: 0, total: 0, inserted: 0, failed: 0 });
  const [importing, setImporting] = useState(false);
  const [resultSummary, setResultSummary] = useState(null);

  useEffect(() => {
    if (!open) {
      setStep(0);
      setFileInfo(null);
      setRows([]);
      setHeaders([]);
      setMapping({ date: '', amount: '', type: '', category: '', account: '', note: '', tags: '' });
      setPreview(null);
      setError('');
      setProgress({ processed: 0, total: 0, inserted: 0, failed: 0 });
      setImporting(false);
      setResultSummary(null);
    }
  }, [open]);

  const hasValidMapping = useMemo(() => {
    return Boolean(mapping.date && mapping.amount && mapping.type && mapping.note);
  }, [mapping]);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setLoading(true);
    try {
      const parsed = await parseCsv(file);
      setFileInfo({
        name: file.name,
        size: file.size,
        delimiter: parsed.delimiter,
        encoding: parsed.encoding,
      });
      setRows(parsed.rows);
      setHeaders(parsed.headers);
      const guess = inferMapping(parsed.headers);
      setMapping((prev) => ({ ...prev, ...guess }));
      setStep(1);
    } catch (err) {
      setError(err.message || 'Gagal membaca file');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (step !== 2) return;
    if (!hasValidMapping) return;
    try {
      const categoryMap = new Map(existingCategories?.map((cat) => [cat.name.toLowerCase(), cat]));
      const accountMap = new Map(existingAccounts?.map((acc) => [acc.name.toLowerCase(), acc]));
      const previewResult = mapRowsToTransactions(rows, mapping, {
        existingCategories: categoryMap,
        existingAccounts: accountMap,
        skipDuplicates,
        existingHashes,
        userId,
      });
      setPreview(previewResult);
    } catch (err) {
      setError(err.message || 'Gagal melakukan mapping data');
    }
  }, [step, hasValidMapping, rows, mapping, existingCategories, existingAccounts, skipDuplicates, existingHashes, userId]);

  const handleNext = () => {
    if (step === 1) {
      setStep(2);
    }
  };

  const handlePreset = (presetKey: string) => {
    const preset = PRESETS[presetKey];
    if (!preset) return;
    const newMapping = { ...mapping };
    Object.entries(preset.mapping).forEach(([field, header]) => {
      if (headers.includes(header)) {
        newMapping[field] = header;
      }
    });
    setMapping(newMapping);
  };

  const handleImport = async () => {
    if (!preview) return;
    setImporting(true);
    setError('');
    try {
      let categoryMap = new Map((existingCategories || []).map((cat) => [cat.name.toLowerCase(), cat]));
      let workingPreview = preview;
      if (autoCreateCategory && preview.missingCategories.size) {
        const created = await ensureCategories(preview.missingCategories, 'mixed');
        created.forEach((cat) => {
          categoryMap.set(cat.name.toLowerCase(), cat);
        });
        const rerun = mapRowsToTransactions(rows, mapping, {
          existingCategories: categoryMap,
          existingAccounts: new Map((existingAccounts || []).map((acc) => [acc.name.toLowerCase(), acc])),
          skipDuplicates,
          existingHashes,
          userId,
        });
        workingPreview = rerun;
        setPreview(rerun);
      }
      const validRows = (workingPreview.valid || []).map(({ hash, ...rest }) => rest);
      if (!validRows.length) {
        setError('Tidak ada baris yang valid untuk diimpor.');
        setImporting(false);
        return;
      }
      setProgress({ processed: 0, total: validRows.length, inserted: 0, failed: 0 });
      const summary = await insertTransactionsChunked(validRows, {
        onProgress: (payload) => {
          setProgress(payload);
        },
      });
      setResultSummary({
        inserted: summary.inserted,
        skipped: workingPreview.duplicateHashes.size,
        failed: summary.failed,
      });
      onImported?.(summary.inserted);
    } catch (err) {
      setError(err.message || 'Gagal mengimpor data');
    } finally {
      setImporting(false);
    }
  };

  return (
    <ModalShell open={open} title="Import CSV" onClose={onClose}>
      {step === 0 && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-dashed border-border bg-card/70 p-8 text-center">
            <FileUp className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Unggah file CSV dari Wallet, Monarch, YNAB, atau sumber lain. Kami akan mendeteksi pemisah otomatis.
            </p>
            <label className="mt-4 inline-flex h-[44px] cursor-pointer items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Pilih File CSV'}
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={handleFile} />
            </label>
            {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button type="button" className="inline-flex items-center gap-2 text-sm text-muted-foreground" onClick={() => setStep(0)}>
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </button>
            <div className="text-xs text-muted-foreground">
              Delimiter: <span className="font-semibold">{fileInfo?.delimiter || ','}</span> • Encoding: <span className="font-semibold">{fileInfo?.encoding || 'utf-8'}</span>
            </div>
          </div>
          <div className="rounded-2xl border bg-card/80 p-4">
            <p className="text-sm font-medium">Mapping Kolom</p>
            <p className="text-xs text-muted-foreground">Sesuaikan kolom CSV ke field HematWoi.</p>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {['date', 'type', 'category', 'account', 'amount', 'note', 'tags'].map((field) => (
                <div key={field} className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{labelForField(field)}</label>
                  <select
                    value={mapping[field] || ''}
                    onChange={(event) => setMapping((prev) => ({ ...prev, [field]: event.target.value }))}
                    className="h-[40px] w-full rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="">Pilih kolom</option>
                    {headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              Preset:
              {Object.entries(PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  type="button"
                  className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-muted"
                  onClick={() => handlePreset(key)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <button type="button" className="inline-flex items-center gap-2 text-sm text-muted-foreground" onClick={() => setStep(0)}>
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </button>
            <button
              type="button"
              className="inline-flex h-[44px] items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm disabled:opacity-50"
              onClick={handleNext}
              disabled={!hasValidMapping}
            >
              Lanjut
            </button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="flex flex-col gap-2 rounded-2xl border bg-card/80 p-4 text-sm text-foreground">
            <div className="flex flex-wrap items-center gap-4">
              <button type="button" className="inline-flex items-center gap-2 text-sm text-muted-foreground" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4" />
                Ubah mapping
              </button>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={autoCreateCategory}
                  onChange={(event) => setAutoCreateCategory(event.target.checked)}
                  className="h-4 w-4 rounded border-muted"
                />
                Buat kategori baru otomatis
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(event) => setSkipDuplicates(event.target.checked)}
                  className="h-4 w-4 rounded border-muted"
                />
                Lewati duplikat
              </label>
            </div>
            {preview && (
              <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground md:grid-cols-4">
                <div>Baris valid: <span className="font-semibold text-foreground">{preview.valid.length}</span></div>
                <div>Duplikat: <span className="font-semibold text-foreground">{preview.duplicateHashes.size}</span></div>
                <div>Butuh kategori baru: <span className="font-semibold text-foreground">{preview.missingCategories.size}</span></div>
                <div>Total baris: <span className="font-semibold text-foreground">{rows.length}</span></div>
              </div>
            )}
          </div>
          <div className="rounded-2xl border bg-card/60">
            <table className="w-full table-auto text-sm">
              <thead className="sticky top-0 bg-background/95 backdrop-blur">
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Tanggal</th>
                  <th className="px-3 py-2">Tipe</th>
                  <th className="px-3 py-2">Kategori</th>
                  <th className="px-3 py-2 text-right">Jumlah</th>
                  <th className="px-3 py-2">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {(preview?.rows || []).slice(0, 20).map((row, index) => (
                  <tr key={index} className="odd:bg-muted/30">
                    <td className="px-3 py-2"><StatusBadge status={row.status} /></td>
                    <td className="px-3 py-2 text-xs">{row.mapped?.date?.slice(0, 10) || '-'}</td>
                    <td className="px-3 py-2 text-xs capitalize">{row.mapped?.type || '-'}</td>
                    <td className="px-3 py-2 text-xs">{row.original?.[mapping.category] || '-'}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums">{row.mapped?.amount?.toLocaleString?.('id-ID') || '-'}</td>
                    <td className="px-3 py-2 text-xs">{row.mapped?.title || row.original?.[mapping.note] || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-col gap-4">
            {importing && (
              <div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: progress.total ? `${Math.min(100, Math.round((progress.processed / progress.total) * 100))}%` : '0%' }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Diproses {progress.processed}/{progress.total} • Berhasil {progress.inserted} • Gagal {progress.failed}
                </p>
              </div>
            )}
            {resultSummary && (
              <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
                <p className="font-semibold text-foreground">Import selesai</p>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  <li>Berhasil: <span className="font-semibold text-emerald-600">{resultSummary.inserted}</span></li>
                  <li>Duplikat dilewati: <span className="font-semibold text-amber-600">{resultSummary.skipped}</span></li>
                  {resultSummary.failed > 0 && (
                    <li>Gagal: <span className="font-semibold text-destructive">{resultSummary.failed}</span></li>
                  )}
                </ul>
              </div>
            )}
            <div className="flex items-center justify-end gap-3">
              <button type="button" className="inline-flex items-center gap-2 text-sm text-muted-foreground" onClick={onClose}>
                Batal
              </button>
              <button
                type="button"
                className="inline-flex h-[44px] items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm disabled:opacity-50"
                onClick={handleImport}
                disabled={importing || !preview || !preview.valid.length}
              >
                {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

function labelForField(field: string) {
  switch (field) {
    case 'date':
      return 'Tanggal';
    case 'type':
      return 'Tipe';
    case 'category':
      return 'Kategori';
    case 'account':
      return 'Akun';
    case 'amount':
      return 'Jumlah';
    case 'note':
      return 'Catatan';
    case 'tags':
      return 'Tag';
    default:
      return field;
  }
}

function inferMapping(headers: string[]) {
  const lower = headers.map((header) => header.toLowerCase());
  const find = (candidates: string[]) => headers[lower.findIndex((value) => candidates.includes(value))] || '';
  return {
    date: find(['date', 'tanggal', 'time', 'posted at']),
    amount: find(['amount', 'jumlah', 'nilai', 'nominal']),
    type: find(['type', 'tipe', 'jenis', 'transaction type']),
    category: find(['category', 'kategori', 'group']),
    account: find(['account', 'akun', 'wallet']),
    note: find(['note', 'catatan', 'memo', 'description', 'title']),
    tags: find(['tags', 'label']),
  };
}
