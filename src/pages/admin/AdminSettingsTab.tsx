import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Loader2, Paintbrush, Save } from 'lucide-react';
import clsx from 'clsx';
import { useToast } from '../../context/ToastContext.jsx';
import {
  AppDescriptionSetting,
  BrandingSetting,
  getAppDescription,
  getBranding,
  setAppDescription,
  setBranding,
} from '../../lib/adminApi';

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={clsx(
        'min-h-[160px] w-full rounded-2xl border border-border/60 bg-background px-3 py-3 text-sm text-foreground shadow-sm ring-2 ring-transparent transition focus:border-transparent focus:outline-none focus:ring-primary',
        props.className
      )}
    />
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        'h-11 w-full rounded-2xl border border-border/60 bg-background px-3 text-sm text-foreground shadow-sm ring-2 ring-transparent transition focus:border-transparent focus:outline-none focus:ring-primary',
        props.className
      )}
    />
  );
}

function formatMeta(setting?: { updated_at: string | null; updated_by: string | null }) {
  if (!setting) return '';
  const { updated_at, updated_by } = setting;
  const parts: string[] = [];
  if (updated_at) {
    const date = new Date(updated_at);
    if (!Number.isNaN(date.getTime())) {
      parts.push(`Terakhir diperbarui ${date.toLocaleString()}`);
    }
  }
  if (updated_by) {
    parts.push(`Oleh ${updated_by}`);
  }
  return parts.join(' · ');
}

function isValidHex(color: string) {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color.trim());
}

export default function AdminSettingsTab() {
  const { addToast } = useToast();
  const [description, setDescription] = useState('');
  const [descriptionMeta, setDescriptionMeta] = useState<AppDescriptionSetting | null>(null);
  const [loadingDescription, setLoadingDescription] = useState(true);
  const [savingDescription, setSavingDescription] = useState(false);
  const [descriptionError, setDescriptionError] = useState('');

  const [branding, setBrandingState] = useState<BrandingSetting | null>(null);
  const [loadingBranding, setLoadingBranding] = useState(true);
  const [savingBranding, setSavingBranding] = useState(false);
  const [brandingError, setBrandingError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadDescription = async () => {
      try {
        const data = await getAppDescription();
        if (!mounted) return;
        setDescription(data.text);
        setDescriptionMeta(data);
      } catch (error) {
        if (!mounted) return;
        addToast('Gagal memuat deskripsi aplikasi', 'error');
        setDescriptionError('Tidak dapat memuat deskripsi aplikasi.');
      } finally {
        if (mounted) {
          setLoadingDescription(false);
        }
      }
    };

    const loadBranding = async () => {
      try {
        const data = await getBranding();
        if (!mounted) return;
        setBrandingState(data);
      } catch (error) {
        if (!mounted) return;
        addToast('Pengaturan branding tidak tersedia', 'warning');
        setBrandingState({
          primary: '#6366f1',
          secondary: '#22d3ee',
          updated_at: null,
          updated_by: null,
        });
      } finally {
        if (mounted) {
          setLoadingBranding(false);
        }
      }
    };

    void loadDescription();
    void loadBranding();

    return () => {
      mounted = false;
    };
  }, [addToast]);

  const descriptionMetaText = useMemo(() => formatMeta(descriptionMeta ?? undefined), [descriptionMeta]);

  const brandingValues = useMemo(() => {
    if (!branding) {
      return { primary: '#6366f1', secondary: '#22d3ee' };
    }
    return { primary: branding.primary, secondary: branding.secondary };
  }, [branding]);

  const brandingMetaText = useMemo(() => formatMeta(branding ?? undefined), [branding]);

  const handleSaveDescription = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!description.trim()) {
      setDescriptionError('Deskripsi tidak boleh kosong.');
      return;
    }
    setDescriptionError('');
    setSavingDescription(true);
    try {
      const saved = await setAppDescription(description.trim());
      setDescriptionMeta(saved);
      addToast('Deskripsi aplikasi tersimpan', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menyimpan deskripsi.';
      setDescriptionError(message);
      addToast(message, 'error');
    } finally {
      setSavingDescription(false);
    }
  };

  const handleSaveBranding = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!branding) return;
    if (!isValidHex(branding.primary) || !isValidHex(branding.secondary)) {
      setBrandingError('Gunakan format warna hex, contoh: #4f46e5.');
      return;
    }
    setBrandingError('');
    setSavingBranding(true);
    try {
      const saved = await setBranding({ primary: branding.primary, secondary: branding.secondary });
      setBrandingState(saved);
      addToast('Branding aplikasi tersimpan', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menyimpan branding.';
      setBrandingError(message);
      addToast(message, 'error');
    } finally {
      setSavingBranding(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        onSubmit={handleSaveDescription}
        className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm md:p-8"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-primary/10 p-2 text-primary">
            <Save className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Deskripsi Aplikasi</h2>
            <p className="text-sm text-muted-foreground">
              Informasi singkat yang muncul di onboarding atau halaman publik.
            </p>
            {descriptionMetaText ? (
              <p className="mt-2 text-xs text-muted-foreground/80">{descriptionMetaText}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-6 space-y-3">
          {loadingDescription ? (
            <div className="space-y-3">
              <div className="h-6 w-24 animate-pulse rounded-xl bg-border/60" />
              <div className="h-36 animate-pulse rounded-2xl bg-border/60" />
            </div>
          ) : (
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Tuliskan deskripsi singkat aplikasi di sini..."
            />
          )}
          {descriptionError ? <p className="text-sm text-destructive">{descriptionError}</p> : null}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingDescription || loadingDescription}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingDescription ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Simpan Deskripsi
            </button>
          </div>
        </div>
      </form>
      <form
        onSubmit={handleSaveBranding}
        className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm md:p-8"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-primary/10 p-2 text-primary">
            <Paintbrush className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Branding</h2>
            <p className="text-sm text-muted-foreground">
              Pilih warna utama dan sekunder untuk tema aplikasi.
            </p>
            {brandingMetaText ? (
              <p className="mt-2 text-xs text-muted-foreground/80">{brandingMetaText}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-6 space-y-4">
          {loadingBranding ? (
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="h-11 animate-pulse rounded-2xl bg-border/60" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="branding-primary" className="text-sm font-semibold text-muted-foreground">
                  Warna primer
                </label>
                <div className="flex items-center gap-3">
                  <div
                    className="h-11 w-11 rounded-2xl border border-border/60"
                    style={{ backgroundColor: brandingValues.primary }}
                    aria-hidden="true"
                  />
                  <Input
                    id="branding-primary"
                    value={branding?.primary ?? brandingValues.primary}
                    onChange={(event) =>
                      setBrandingState((prev) =>
                        prev
                          ? { ...prev, primary: event.target.value }
                          : { primary: event.target.value, secondary: brandingValues.secondary, updated_at: null, updated_by: null }
                      )
                    }
                    placeholder="#6366f1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="branding-secondary" className="text-sm font-semibold text-muted-foreground">
                  Warna sekunder
                </label>
                <div className="flex items-center gap-3">
                  <div
                    className="h-11 w-11 rounded-2xl border border-border/60"
                    style={{ backgroundColor: brandingValues.secondary }}
                    aria-hidden="true"
                  />
                  <Input
                    id="branding-secondary"
                    value={branding?.secondary ?? brandingValues.secondary}
                    onChange={(event) =>
                      setBrandingState((prev) =>
                        prev
                          ? { ...prev, secondary: event.target.value }
                          : { primary: brandingValues.primary, secondary: event.target.value, updated_at: null, updated_by: null }
                      )
                    }
                    placeholder="#22d3ee"
                  />
                </div>
              </div>
            </div>
          )}
          {brandingError ? <p className="text-sm text-destructive">{brandingError}</p> : null}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingBranding || loadingBranding}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingBranding ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Simpan Branding
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
