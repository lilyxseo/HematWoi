import { FormEvent, useEffect, useState } from 'react';
import clsx from 'clsx';
import { useToast } from '../../context/ToastContext.jsx';
import {
  getAdminDashboardContent,
  getAppDescription,
  getBranding,
  setAdminDashboardContent,
  setAppDescription,
  setBranding,
  type AdminDashboardContentSetting,
  type AppDescriptionSetting,
  type BrandingSetting,
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

type DashboardContentForm = {
  breadcrumb: string;
  title: string;
  subtitle: string;
  badge: string;
  description: string;
};

const DASHBOARD_CONTENT_DEFAULT: DashboardContentForm = {
  breadcrumb: 'Dashboard / Admin',
  title: 'Admin Panel',
  subtitle: '',
  badge: 'Admin',
  description: 'Kelola menu, pengguna, dan pengaturan aplikasi di satu tempat.',
};

export default function AdminSettingsTab() {
  const { addToast } = useToast();
  const [description, setDescription] = useState('');
  const [descriptionMeta, setDescriptionMeta] = useState<string | null>(null);
  const [branding, setBrandingState] = useState<BrandingForm>({ primary: '#1e40af', secondary: '#0ea5e9' });
  const [brandingMeta, setBrandingMeta] = useState<string | null>(null);
  const [dashboardContent, setDashboardContent] = useState<DashboardContentForm>(DASHBOARD_CONTENT_DEFAULT);
  const [dashboardMeta, setDashboardMeta] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingDesc, setSavingDesc] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);
  const [savingDashboard, setSavingDashboard] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [desc, brand, content] = await Promise.all([
          getAppDescription(),
          getBranding(),
          getAdminDashboardContent(),
        ]);
        if (!mounted) return;
        setDescription(desc.text ?? '');
        setDescriptionMeta(desc.updated_at ?? null);
        setBrandingState({ primary: brand.primary, secondary: brand.secondary });
        setBrandingMeta(brand.updated_at ?? null);
        setDashboardContent({
          breadcrumb: content.breadcrumb,
          title: content.title,
          subtitle: content.subtitle,
          badge: content.badge,
          description: content.description,
        });
        setDashboardMeta(content.updated_at ?? null);
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

  const handleDashboardContentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingDashboard) return;
    setSavingDashboard(true);
    try {
      const result: AdminDashboardContentSetting = await setAdminDashboardContent(dashboardContent);
      setDashboardContent({
        breadcrumb: result.breadcrumb,
        title: result.title,
        subtitle: result.subtitle,
        badge: result.badge,
        description: result.description,
      });
      setDashboardMeta(result.updated_at ?? null);
      addToast('Konten dashboard admin diperbarui', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan konten dashboard';
      addToast(message, 'error');
    } finally {
      setSavingDashboard(false);
    }
  };

  const renderSkeleton = () => (
    <div className="grid gap-6 lg:grid-cols-2">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-6">
          <div className="h-6 w-32 animate-pulse rounded-full bg-muted/40" />
          <div className="h-5 w-48 animate-pulse rounded-full bg-muted/40" />
          <div className="h-24 w-full animate-pulse rounded-2xl bg-muted/30" />
          <div className="h-11 w-32 animate-pulse rounded-2xl bg-muted/30" />
        </div>
      ))}
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
            onSubmit={handleDashboardContentSubmit}
            className="space-y-4 rounded-2xl border border-border/60 bg-background p-6 shadow-sm"
          >
            <div>
              <h3 className="text-base font-semibold">Konten Dashboard Admin</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Sesuaikan judul, deskripsi, dan label untuk halaman dashboard admin agar sesuai dengan identitas tim Anda.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-muted-foreground">
                Breadcrumb
                <input
                  value={dashboardContent.breadcrumb}
                  onChange={(event) =>
                    setDashboardContent((prev) => ({ ...prev, breadcrumb: event.target.value }))
                  }
                  className={clsx(INPUT_CLASS, 'mt-1')}
                  placeholder="Dashboard / Admin"
                />
              </label>
              <label className="text-sm font-semibold text-muted-foreground">
                Label Badge
                <input
                  value={dashboardContent.badge}
                  onChange={(event) => setDashboardContent((prev) => ({ ...prev, badge: event.target.value }))}
                  className={clsx(INPUT_CLASS, 'mt-1')}
                  placeholder="Admin"
                />
              </label>
            </div>
            <label className="text-sm font-semibold text-muted-foreground">
              Judul Halaman
              <input
                value={dashboardContent.title}
                onChange={(event) => setDashboardContent((prev) => ({ ...prev, title: event.target.value }))}
                className={clsx(INPUT_CLASS, 'mt-1')}
                placeholder="Admin Panel"
              />
            </label>
            <label className="text-sm font-semibold text-muted-foreground">
              Subjudul
              <input
                value={dashboardContent.subtitle}
                onChange={(event) => setDashboardContent((prev) => ({ ...prev, subtitle: event.target.value }))}
                className={clsx(INPUT_CLASS, 'mt-1')}
                placeholder="Kelola kebutuhan operasional dengan mudah"
              />
            </label>
            <label className="text-sm font-semibold text-muted-foreground">
              Deskripsi Halaman
              <textarea
                value={dashboardContent.description}
                onChange={(event) => setDashboardContent((prev) => ({ ...prev, description: event.target.value }))}
                className={TEXTAREA_CLASS}
                placeholder="Kelola menu, pengguna, dan pengaturan aplikasi di satu tempat."
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                {dashboardMeta
                  ? `Terakhir diperbarui ${dateFormatter.format(new Date(dashboardMeta))}`
                  : 'Belum pernah disimpan'}
              </span>
              <button
                type="submit"
                className="h-11 rounded-2xl bg-primary px-6 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
                disabled={savingDashboard}
              >
                Simpan Konten
              </button>
            </div>
          </form>
          <form
            onSubmit={handleDescriptionSubmit}
            className="space-y-4 rounded-2xl border border-border/60 bg-background p-6 shadow-sm"
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
