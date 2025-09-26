import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useAccent } from '../../context/AccentContext';
import { useToast } from '../../context/ToastContext';
import { normalizeAccentHex } from '../../lib/api-user-settings';

const PRESET_COLORS = [
  '#3898f8',
  '#2584e4',
  '#50b6ff',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#14b8a6',
] as const;

function toUpperHex(value: string) {
  return value.startsWith('#') ? value.toUpperCase() : `#${value}`.toUpperCase();
}

export default function AccentPicker() {
  const { accent, loading, setAccent } = useAccent();
  const { addToast } = useToast();
  const [textValue, setTextValue] = useState(accent);
  const [colorValue, setColorValue] = useState(accent);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const normalizedTextValue = useMemo(() => {
    try {
      return normalizeAccentHex(textValue);
    } catch {
      return null;
    }
  }, [textValue]);

  useEffect(() => {
    setTextValue(accent);
    setColorValue(accent);
  }, [accent]);

  useEffect(() => {
    try {
      const normalized = normalizeAccentHex(textValue);
      setColorValue(normalized);
    } catch {
      // ignore invalid typing, keep last valid color
    }
  }, [textValue]);

  const previewStyle = useMemo(() => ({
    backgroundColor: colorValue,
    color: '#fff',
  }), [colorValue]);

  const handleSave = async (value?: string) => {
    setSaving(true);
    setError(null);
    try {
      const normalized = normalizeAccentHex(value ?? textValue);
      setTextValue(normalized);
      setColorValue(normalized);
      const result = await setAccent(normalized);
      if (result.error) {
        addToast('Warna tersimpan lokal. Sinkronisasi akan dicoba lagi (ACC-32).', 'warning');
      } else if (result.synced) {
        addToast('Warna aksen berhasil disimpan!', 'success');
      } else {
        addToast('Warna aksen disimpan di perangkat ini.', 'info');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Format warna tidak valid (ACC-02).';
      setError(message);
      addToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3" aria-live="polite">
        <div className="h-4 w-32 animate-pulse rounded-full bg-border/70" />
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`accent-skeleton-${index}`} className="h-9 rounded-full bg-border/60 animate-pulse" />
          ))}
        </div>
        <div className="h-24 rounded-2xl bg-border/50 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4" aria-live="polite">
      <div className="space-y-2">
        <p className="text-sm font-medium text-text">Pilih warna aksen</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8" role="group" aria-label="Preset warna aksen">
          {PRESET_COLORS.map((preset) => {
            const normalized = toUpperHex(preset);
            const isActive = normalizedTextValue === normalized;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setTextValue(normalized);
                  setColorValue(normalized);
                  setError(null);
                }}
                aria-label={`Gunakan warna ${normalized}`}
                className={clsx(
                  'relative h-9 w-full rounded-full border transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
                  isActive
                    ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]'
                    : 'border-border-subtle hover:border-[var(--accent)]'
                )}
              >
                <span className="absolute inset-1 rounded-full" style={{ backgroundColor: normalized }} />
                <span className="sr-only">{normalized}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-[auto,1fr]">
        <label className="flex flex-col gap-2 text-sm font-medium text-text" htmlFor="accent-color-input">
          Warna custom
          <input
            id="accent-color-input"
            type="color"
            value={colorValue}
            onChange={(event) => {
              const value = event.target.value.toUpperCase();
              setTextValue(value);
              setColorValue(value);
              setError(null);
            }}
            className="h-11 w-24 cursor-pointer rounded-2xl border border-border-subtle bg-surface-alt"
            aria-label="Pilih warna aksen custom"
          />
        </label>
        <div className="space-y-2">
          <label className="text-sm font-medium text-text" htmlFor="accent-hex-input">
            Hex kode
          </label>
          <input
            id="accent-hex-input"
            type="text"
            value={textValue}
            onChange={(event) => setTextValue(event.target.value)}
            placeholder="#3898F8"
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={error ? 'accent-error' : undefined}
          />
          {error ? (
            <p id="accent-error" className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="flex h-16 flex-1 items-center justify-center rounded-2xl border border-border-subtle"
          style={previewStyle}
          aria-label="Pratinjau warna aksen"
        >
          <span className="text-sm font-semibold uppercase tracking-wide">Accent preview</span>
        </div>
        <button
          type="button"
          className="btn btn-primary sm:w-40"
          onClick={() => handleSave()}
          disabled={saving}
          aria-label="Simpan warna aksen"
        >
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
      </div>
    </div>
  );
}
