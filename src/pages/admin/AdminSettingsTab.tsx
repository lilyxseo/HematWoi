import { FormEvent, useEffect, useState } from 'react';
import clsx from 'clsx';
import { useToast } from '../../context/ToastContext.jsx';
import {
  getAppDescription,
  getBranding,
  getDashboardHeroSettings,
  setAppDescription,
  setBranding,
  setDashboardHeroSettings,
  type AppDescriptionSetting,
  type BrandingSetting,
  type DashboardHeroSetting,
} from '../../lib/adminApi';

const TEXTAREA_CLASS =
  'min-h-[140px] w-full rounded-2xl border border-border bg-background px-3 py-3 text-sm transition focus:outline-none focus:ring-2 focus:ring-primary';

const INPUT_CLASS =
  'h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm transition focus:outline-none focus:ring-2 focus:ring-primary';

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

type BrandingForm = {
  primary: string;
  secondary: string;
};

type DashboardHeroForm = {
  title: string;
  subtitle: string;
  showDigestButton: boolean;
  digestButtonLabel: string;
};

export default function AdminSettingsTab() {
  const { addToast } = useToast();
  const [description, setDescription] = useState('');
  const [descriptionMeta, setDescriptionMeta] = useState<string | null>(null);
  const [branding, setBrandingState] = useState<BrandingForm>({ primary: '#1e40af', secondary: '#0ea5e9' });
  const [brandingMeta, setBrandingMeta] = useState<string | null>(null);
  const [dashboardHero, setDashboardHero] = useState<DashboardHeroForm>({
    title: 'Dashboard',
    subtitle: 'Ringkasan keuanganmu',
    showDigestButton: true,
    digestButtonLabel: 'Lihat Ringkasan Hari Ini',
  });
  const [dashboardHeroMeta, setDashboardHeroMeta] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingDesc, setSavingDesc] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);
  const [savingHero, setSavingHero] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [desc, brand, hero] = await Promise.all([
          getAppDescription(),
          getBranding(),
          getDashboardHeroSettings(),
        ]);
        if (!mounted) return;
        setDescription(desc.text ?? '');
        setDescriptionMeta(desc.updated_at ?? null);
        setBrandingState({ primary: brand.primary, secondary: brand.secondary });
        setBrandingMeta(brand.updated_at ?? null);
        const heroDefaults: DashboardHeroForm = {
          title: hero.title,
          subtitle: hero.subtitle,
          showDigestButton: hero.showDigestButton,
          digestButtonLabel: hero.digestButtonLabel,
        };
        setDashboardHero(heroDefaults);
        setDashboardHeroMeta(hero.updated_at ?? null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Gagal memuat pengaturan';
        if (mounted) {
          addToast(message, 'error');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [addToast]);

  const handleDescriptionSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingDesc) return;
    setSavingDesc(true);
    try {
      const result: AppDescriptionSetting = await setAppDescription(description);
      setDescription(result.text);
      setDescriptionMeta(result.updated_at ?? null);
      addToast('Deskripsi aplikasi disimpan', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan deskripsi';
      addToast(message, 'error');
    } finally {
      setSavingDesc(false);
    }
  };

  const handleBrandingSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingBrand) return;

    const normalizeHex = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed.startsWith('#')) return `#${trimmed}`;
      return trimmed;
    };

    const payload = {
      primary: normalizeHex(branding.primary),
      secondary: normalizeHex(branding.secondary),
    };

    setSavingBrand(true);
    try {
      const result: BrandingSetting = await setBranding(payload);
      setBrandingState({ primary: result.primary, secondary: result.secondary });
      setBrandingMeta(result.updated_at ?? null);
      addToast('Branding diperbarui', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan branding';
      addToast(message, 'error');
    } finally {
      setSavingBrand(false);
    }
  };

  const handleDashboardHeroSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingHero) return;
    setSavingHero(true);
    try {
      const result: DashboardHeroSetting = await setDashboardHeroSettings({
        title: dashboardHero.title,
        subtitle: dashboardHero.subtitle,
        showDigestButton: dashboardHero.showDigestButton,
        digestButtonLabel: dashboardHero.digestButtonLabel,
      });
      setDashboardHero({
        title: result.title,
        subtitle: result.subtitle,
        showDigestButton: result.showDigestButton,
        digestButtonLabel: result.digestButtonLabel,
      });
      setDashboardHeroMeta(result.updated_at ?? null);
      addToast('Pengaturan dashboard disimpan', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan pengaturan dashboard';
      addToast(message, 'error');
    } finally {
      setSavingHero(false);
    }
  };

  const renderSkeleton = () => (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-6 lg:col-span-2">
        <div className="h-6 w-40 animate-pulse rounded-full bg-muted/40" />
        <div className="h-5 w-64 animate-pulse rounded-full bg-muted/40" />
        <div className="h-24 w-full animate-pulse rounded-2xl bg-muted/30" />
        <div className="h-11 w-40 animate-pulse rounded-2xl bg-muted/30" />
      </div>
      <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-6">
        <div className="h-6 w-32 animate-pulse rounded-full bg-muted/40" />
        <div className="h-5 w-44 animate-pulse rounded-full bg-muted/40" />
        <div className="h-20 w-full animate-pulse rounded-2xl bg-muted/30" />
        <div className="h-11 w-32 animate-pulse rounded-2xl bg-muted/30" />
      </div>
      <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-6">
        <div className="h-6 w-32 animate-pulse rounded-full bg-muted/40" />
        <div className="h-5 w-40 animate-pulse rounded-full bg-muted/40" />
        <div className="h-16 w-full animate-pulse rounded-2xl bg-muted/30" />
        <div className="h-11 w-32 animate-pulse rounded-2xl bg-muted/30" />
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Pengaturan Aplikasi</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola deskripsi aplikasi dan elemen branding agar konsisten dengan identitas produk.
        </p>
      </div>

      {loading ? (
        renderSkeleton()
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={handleDescriptionSubmit}
            className="space-y-4 rounded-2xl border border-border/60 bg-background p-6 shadow-sm lg:col-span-2"
          >
            <div>
              <h3 className="text-base font-semibold">Deskripsi Aplikasi</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Teks ini akan tampil sebagai penjelasan singkat aplikasi pada halaman publik atau meta data.
              </p>
            </div>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className={TEXTAREA_CLASS}
              placeholder="Tuliskan deskripsi aplikasi di sini"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                {descriptionMeta ? `Terakhir diperbarui ${dateFormatter.format(new Date(descriptionMeta))}` : 'Belum pernah disimpan'}
              </span>
              <button
                type="submit"
                className="h-11 rounded-2xl bg-primary px-6 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
                disabled={savingDesc}
              >
                Simpan Deskripsi
              </button>
            </div>
          </form>

          <form
            onSubmit={handleDashboardHeroSubmit}
            className="space-y-4 rounded-2xl border border-border/60 bg-background p-6 shadow-sm"
          >
            <div>
              <h3 className="text-base font-semibold">Tampilan Dashboard</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Atur judul, deskripsi, dan tombol ringkasan harian yang tampil pada halaman dashboard utama pengguna.
              </p>
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-muted-foreground">
                Judul
                <input
                  value={dashboardHero.title}
                  onChange={(event) =>
                    setDashboardHero((prev) => ({ ...prev, title: event.target.value }))
                  }
                  className={clsx(INPUT_CLASS, 'mt-1')}
                  placeholder="Dashboard"
                />
              </label>
              <label className="block text-sm font-semibold text-muted-foreground">
                Deskripsi
                <textarea
                  value={dashboardHero.subtitle}
                  onChange={(event) =>
                    setDashboardHero((prev) => ({ ...prev, subtitle: event.target.value }))
                  }
                  className={clsx(TEXTAREA_CLASS, 'mt-1 min-h-[100px]')}
                  placeholder="Ringkasan keuanganmu"
                />
              </label>
              <label className="block text-sm font-semibold text-muted-foreground">
                Label Tombol Ringkasan
                <input
                  value={dashboardHero.digestButtonLabel}
                  onChange={(event) =>
                    setDashboardHero((prev) => ({ ...prev, digestButtonLabel: event.target.value }))
                  }
                  className={clsx(INPUT_CLASS, 'mt-1')}
                  placeholder="Lihat Ringkasan Hari Ini"
                  disabled={!dashboardHero.showDigestButton}
                />
              </label>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <input
                  type="checkbox"
                  checked={dashboardHero.showDigestButton}
                  onChange={(event) =>
                    setDashboardHero((prev) => ({ ...prev, showDigestButton: event.target.checked }))
                  }
                  className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary"
                />
                Tampilkan tombol ringkasan harian
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                {dashboardHeroMeta
                  ? `Terakhir diperbarui ${dateFormatter.format(new Date(dashboardHeroMeta))}`
                  : 'Belum pernah disimpan'}
              </span>
              <button
                type="submit"
                className="h-11 rounded-2xl bg-primary px-6 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
                disabled={savingHero}
              >
                Simpan Pengaturan Dashboard
              </button>
            </div>
          </form>

          <form
            onSubmit={handleBrandingSubmit}
            className="space-y-4 rounded-2xl border border-border/60 bg-background p-6 shadow-sm"
          >
            <div>
              <h3 className="text-base font-semibold">Branding</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Sesuaikan warna utama dan sekunder untuk tampilan aplikasi. Gunakan format HEX (#RRGGBB).
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-muted-foreground">
                Warna Primer
                <input
                  value={branding.primary}
                  onChange={(event) =>
                    setBrandingState((prev) => ({ ...prev, primary: event.target.value }))
                  }
                  className={clsx(INPUT_CLASS, 'mt-1')}
                  placeholder="#1E40AF"
                />
                <span className="mt-2 inline-flex h-6 w-16 rounded-full border border-border/60" style={{ backgroundColor: branding.primary }} />
              </label>
              <label className="text-sm font-semibold text-muted-foreground">
                Warna Sekunder
                <input
                  value={branding.secondary}
                  onChange={(event) =>
                    setBrandingState((prev) => ({ ...prev, secondary: event.target.value }))
                  }
                  className={clsx(INPUT_CLASS, 'mt-1')}
                  placeholder="#0EA5E9"
                />
                <span className="mt-2 inline-flex h-6 w-16 rounded-full border border-border/60" style={{ backgroundColor: branding.secondary }} />
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                {brandingMeta ? `Terakhir diperbarui ${dateFormatter.format(new Date(brandingMeta))}` : 'Belum pernah disimpan'}
              </span>
              <button
                type="submit"
                className="h-11 rounded-2xl bg-primary px-6 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
                disabled={savingBrand}
              >
                Simpan Branding
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
