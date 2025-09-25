import { FormEvent, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import {
  getAppDescription,
  getBranding,
  setAppDescription,
  setBranding,
  type AppDescriptionSetting,
  type BrandingSetting,
} from '../../lib/adminApi';
import { useToast } from '../../context/ToastContext.jsx';

export default function AdminSettingsTab() {
  const { addToast } = useToast();
  const [descriptionSetting, setDescriptionSetting] = useState<AppDescriptionSetting | null>(null);
  const [brandingSetting, setBrandingSetting] = useState<BrandingSetting | null>(null);
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [secondaryColor, setSecondaryColor] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingDescription, setSavingDescription] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [desc, branding] = await Promise.all([getAppDescription(), getBranding()]);
        if (!mounted) return;
        setDescriptionSetting(desc);
        setBrandingSetting(branding);
        setDescription(desc.text ?? '');
        setLogoUrl(desc.logoUrl ?? '');
        setPrimaryColor(branding.primary ?? '');
        setSecondaryColor(branding.secondary ?? '');
      } catch (err) {
        console.error('[AdminSettingsTab] gagal memuat pengaturan', err);
        if (mounted) {
          addToast('Gagal memuat pengaturan aplikasi', 'error');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [addToast]);

  function formatUpdatedInfo(setting: { updatedAt: string | null; updatedBy: string | null } | null) {
    if (!setting?.updatedAt) return 'Belum pernah diperbarui';
    const date = new Date(setting.updatedAt);
    const formatted = new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
    return `Terakhir diperbarui ${formatted}${setting.updatedBy ? ` oleh ${setting.updatedBy}` : ''}`;
  }

  async function handleSaveDescription(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingDescription) return;
    setSavingDescription(true);
    try {
      const result = await setAppDescription(description, logoUrl || null);
      setDescriptionSetting(result);
      addToast('Deskripsi aplikasi tersimpan', 'success');
    } catch (err) {
      console.error('[AdminSettingsTab] gagal menyimpan deskripsi', err);
      addToast(err instanceof Error ? err.message : 'Gagal menyimpan deskripsi', 'error');
    } finally {
      setSavingDescription(false);
    }
  }

  async function handleSaveBranding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingBranding) return;
    setSavingBranding(true);
    try {
      const result = await setBranding(primaryColor || null, secondaryColor || null);
      setBrandingSetting(result);
      addToast('Branding aplikasi tersimpan', 'success');
    } catch (err) {
      console.error('[AdminSettingsTab] gagal menyimpan branding', err);
      addToast(err instanceof Error ? err.message : 'Gagal menyimpan branding', 'error');
    } finally {
      setSavingBranding(false);
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-border/60 bg-background/60 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Deskripsi Aplikasi</h2>
            <p className="text-sm text-muted-foreground">
              Perbarui ringkasan aplikasi dan logo yang tampil di area publik.
            </p>
          </div>
          <span className="rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground">
            {formatUpdatedInfo(descriptionSetting)}
          </span>
        </div>
        {loading ? (
          <div className="mt-6 space-y-3">
            <div className="h-11 animate-pulse rounded-2xl bg-border/40" />
            <div className="h-32 animate-pulse rounded-2xl bg-border/40" />
            <div className="h-11 animate-pulse rounded-2xl bg-border/40" />
          </div>
        ) : (
          <form onSubmit={handleSaveDescription} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-muted-foreground" htmlFor="app-logo-url">
                Logo URL (opsional)
              </label>
              <input
                id="app-logo-url"
                type="url"
                value={logoUrl}
                onChange={(event) => setLogoUrl(event.target.value)}
                placeholder="https://example.com/logo.png"
                className="h-11 w-full rounded-2xl border border-border/70 px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-muted-foreground" htmlFor="app-description">
                Deskripsi
              </label>
              <textarea
                id="app-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="HematWoi membantu kamu mengelola keuangan harian dengan mudah."
                className="h-32 w-full rounded-2xl border border-border/70 px-3 py-3 text-sm leading-relaxed focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              type="submit"
              disabled={savingDescription}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" /> {savingDescription ? 'Menyimpan…' : 'Simpan deskripsi'}
            </button>
          </form>
        )}
      </div>

      <div className="rounded-2xl border border-border/60 bg-background/60 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Branding</h2>
            <p className="text-sm text-muted-foreground">
              Atur warna utama yang digunakan aplikasi untuk menyesuaikan identitas brand.
            </p>
          </div>
          <span className="rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground">
            {formatUpdatedInfo(brandingSetting)}
          </span>
        </div>
        {loading ? (
          <div className="mt-6 space-y-3">
            <div className="h-11 animate-pulse rounded-2xl bg-border/40" />
            <div className="h-11 animate-pulse rounded-2xl bg-border/40" />
            <div className="h-11 animate-pulse rounded-2xl bg-border/40" />
          </div>
        ) : (
          <form onSubmit={handleSaveBranding} className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-muted-foreground" htmlFor="branding-primary">
                  Warna primer
                </label>
                <input
                  id="branding-primary"
                  type="text"
                  value={primaryColor}
                  onChange={(event) => setPrimaryColor(event.target.value)}
                  placeholder="#7C3AED"
                  className="h-11 w-full rounded-2xl border border-border/70 px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-muted-foreground" htmlFor="branding-secondary">
                  Warna sekunder
                </label>
                <input
                  id="branding-secondary"
                  type="text"
                  value={secondaryColor}
                  onChange={(event) => setSecondaryColor(event.target.value)}
                  placeholder="#22D3EE"
                  className="h-11 w-full rounded-2xl border border-border/70 px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-muted/40 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/60" style={{ background: primaryColor || '#7C3AED' }} />
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/60" style={{ background: secondaryColor || '#22D3EE' }} />
              <div className="text-xs text-muted-foreground">
                <p>Gunakan format warna hex. Kosongkan untuk menggunakan warna default aplikasi.</p>
              </div>
            </div>
            <button
              type="submit"
              disabled={savingBranding}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" /> {savingBranding ? 'Menyimpan…' : 'Simpan branding'}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
