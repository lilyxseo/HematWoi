// @ts-nocheck
import { useMemo, useState } from 'react';
import { DownloadCloud, Loader2, RefreshCw, UploadCloud } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getCurrentUserId } from '../../lib/session';

const ENTITY_TABLES = {
  transactions: 'transactions',
  categories: 'categories',
  subscriptions: 'subscriptions',
  goals: 'goals',
  debts: 'debts',
};

async function downloadJSON(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return blob;
}

export default function BackupRestore({ activeTab, onRestoreComplete }) {
  const [busy, setBusy] = useState(false);
  const [persistHistory, setPersistHistory] = useState(false);
  const [error, setError] = useState('');
  const [restorePreview, setRestorePreview] = useState(null);
  const [restoring, setRestoring] = useState(false);

  const allowedEntities = useMemo(() => {
    if (activeTab && ENTITY_TABLES[activeTab]) {
      return [activeTab];
    }
    return Object.keys(ENTITY_TABLES);
  }, [activeTab]);

  const handleBackup = async () => {
    setBusy(true);
    setError('');
    try {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('User belum masuk');
      const payload: Record<string, unknown> = {
        generated_at: new Date().toISOString(),
        entities: {},
      };
      for (const key of allowedEntities) {
        const table = ENTITY_TABLES[key];
        if (!table) continue;
        const { data, error: queryError } = await supabase.from(table).select('*').eq('user_id', userId);
        if (queryError) throw queryError;
        payload.entities[key] = data || [];
      }
      const timestamp = new Date();
      const formatted = `${timestamp.getFullYear()}${String(timestamp.getMonth() + 1).padStart(2, '0')}${String(timestamp.getDate()).padStart(2, '0')}-${String(timestamp.getHours()).padStart(2, '0')}${String(timestamp.getMinutes()).padStart(2, '0')}`;
      const fileName = `hematwoi-${allowedEntities.length === 1 ? allowedEntities[0] : 'backup'}-${formatted}.json`;
      const blob = await downloadJSON(fileName, payload);
      if (persistHistory) {
        const path = `${userId}/${fileName}`;
        const { error: storageError } = await supabase.storage.from('backups').upload(path, blob, {
          contentType: 'application/json',
          upsert: true,
        });
        if (storageError) throw storageError;
      }
    } catch (err) {
      setError(err.message || 'Gagal melakukan backup');
    } finally {
      setBusy(false);
    }
  };

  const handleRestoreFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Format file tidak dikenali');
      }
      const entities = parsed.entities || parsed.data || parsed;
      const summary = Object.entries(entities || {}).reduce(
        (acc, [key, value]) => {
          if (Array.isArray(value)) {
            acc[key] = value.length;
          }
          return acc;
        },
        {},
      );
      setRestorePreview({ file, entities, summary });
    } catch (err) {
      setError(err.message || 'File tidak valid');
    }
  };

  const handleRestore = async () => {
    if (!restorePreview) return;
    setRestoring(true);
    setError('');
    try {
      const userId = await getCurrentUserId();
      if (!userId) throw new Error('User belum masuk');
      for (const [key, rows] of Object.entries(restorePreview.entities || {})) {
        if (!ENTITY_TABLES[key] || !Array.isArray(rows) || rows.length === 0) continue;
        const table = ENTITY_TABLES[key];
        for (let i = 0; i < rows.length; i += 500) {
          const chunk = rows.slice(i, i + 500).map((row) => ({ ...row, user_id: row.user_id || userId }));
          const { error: upsertError } = await supabase.from(table).upsert(chunk, { onConflict: 'id' });
          if (upsertError) throw upsertError;
        }
      }
      setRestorePreview(null);
      onRestoreComplete?.();
    } catch (err) {
      setError(err.message || 'Gagal melakukan restore');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="rounded-3xl border border-border bg-card/70 p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Backup &amp; Restore</h3>
          <p className="text-xs text-muted-foreground">Simpan data lokal dan pulihkan kapan saja.</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-muted"
            checked={persistHistory}
            onChange={(event) => setPersistHistory(event.target.checked)}
          />
          Simpan ke Supabase Storage
        </label>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={handleBackup}
          disabled={busy}
          className="inline-flex h-[48px] items-center justify-center gap-2 rounded-2xl border border-border bg-background text-sm font-semibold shadow-sm disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadCloud className="h-4 w-4" />}
          Backup {allowedEntities.length === 1 ? allowedEntities[0] : 'semua'}
        </button>
        <label className="flex h-[48px] cursor-pointer items-center justify-center gap-2 rounded-2xl border border-border bg-background text-sm font-semibold shadow-sm">
          <UploadCloud className="h-4 w-4" />
          Pilih file JSON
          <input type="file" accept="application/json" className="sr-only" onChange={handleRestoreFile} />
        </label>
      </div>
      {restorePreview && (
        <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-4 text-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">Pratinjau Restore</p>
              <p className="text-xs text-muted-foreground">{restorePreview.file.name}</p>
            </div>
            <button
              type="button"
              onClick={() => setRestorePreview(null)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="h-3 w-3" /> Reset
            </button>
          </div>
          <ul className="mt-3 space-y-1 text-muted-foreground">
            {Object.entries(restorePreview.summary || {}).map(([key, count]) => (
              <li key={key} className="flex items-center justify-between">
                <span className="capitalize">{key}</span>
                <span className="font-semibold text-foreground">{count}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={handleRestore}
            disabled={restoring}
            className="mt-4 inline-flex h-[44px] items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm disabled:opacity-50"
          >
            {restoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Restore Sekarang
          </button>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
    </div>
  );
}
