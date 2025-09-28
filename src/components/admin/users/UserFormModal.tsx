import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import type { AdminUserItem, AdminUserProfile } from '../../../lib/api/adminUsers';

export type UserFormValues = {
  email: string;
  password: string;
  role: 'admin' | 'user';
  is_active: boolean;
  full_name: string;
  username: string;
  avatar_url: string;
  locale: string;
  timezone: string;
  theme: 'system' | 'light' | 'dark';
  sendEmailInvite: boolean;
};

export type UserFormModalProps = {
  open: boolean;
  mode: 'create' | 'edit';
  loading?: boolean;
  initialUser?: AdminUserItem | null;
  onClose: () => void;
  onSubmit: (values: UserFormValues) => Promise<void> | void;
};

const defaultValues: UserFormValues = {
  email: '',
  password: '',
  role: 'user',
  is_active: true,
  full_name: '',
  username: '',
  avatar_url: '',
  locale: 'id-ID',
  timezone: 'Asia/Jakarta',
  theme: 'system',
  sendEmailInvite: false,
};

export default function UserFormModal({
  open,
  mode,
  loading = false,
  initialUser = null,
  onClose,
  onSubmit,
}: UserFormModalProps) {
  const [formState, setFormState] = useState<UserFormValues>(defaultValues);
  const [error, setError] = useState<string | null>(null);
  const [touchPassword, setTouchPassword] = useState(false);

  useEffect(() => {
    if (!open) {
      setFormState(defaultValues);
      setTouchPassword(false);
      setError(null);
      return;
    }

    if (initialUser && mode === 'edit') {
      const profile = initialUser.profile as AdminUserProfile;
      setFormState({
        email: initialUser.email,
        password: '',
        role: profile.role,
        is_active: profile.is_active,
        full_name: profile.full_name ?? '',
        username: profile.username ?? '',
        avatar_url: profile.avatar_url ?? '',
        locale: profile.locale ?? 'id-ID',
        timezone: profile.timezone ?? 'Asia/Jakarta',
        theme: (profile.theme as UserFormValues['theme']) ?? 'system',
        sendEmailInvite: false,
      });
    } else {
      setFormState(defaultValues);
    }
  }, [open, initialUser, mode]);

  const title = useMemo(() => (mode === 'create' ? 'Tambah Pengguna Baru' : 'Ubah Pengguna'), [mode]);

  if (!open) return null;

  const handleChange = (field: keyof UserFormValues, value: string | boolean) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!formState.email.trim()) {
      setError('Email wajib diisi');
      return;
    }

    if (mode === 'create' && !formState.password) {
      setError('Password awal wajib diisi');
      return;
    }

    if (mode === 'create' && formState.password.length < 8 && !formState.sendEmailInvite) {
      setError('Password minimal 8 karakter');
      return;
    }

    if (touchPassword && formState.password && formState.password.length < 8) {
      setError('Password minimal 8 karakter');
      return;
    }

    await onSubmit(formState);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-border/60 bg-card shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-6 p-6 md:p-8">
          <header className="space-y-1">
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">
              {mode === 'create'
                ? 'Buat akun baru untuk anggota tim atau user aplikasi.'
                : 'Ubah informasi profil, peran, dan status pengguna.'}
            </p>
          </header>

          <section className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Email</span>
              <input
                type="email"
                className="h-11 w-full rounded-xl border border-border/60 bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={formState.email}
                onChange={(event) => handleChange('email', event.target.value)}
                required
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Peran</span>
              <select
                className="h-11 w-full rounded-xl border border-border/60 bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={formState.role}
                onChange={(event) => handleChange('role', event.target.value as UserFormValues['role'])}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Status</span>
              <select
                className="h-11 w-full rounded-xl border border-border/60 bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={formState.is_active ? 'active' : 'inactive'}
                onChange={(event) => handleChange('is_active', event.target.value === 'active')}
              >
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </label>

            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border/60 text-primary focus:ring-primary"
                checked={formState.sendEmailInvite}
                onChange={(event) => handleChange('sendEmailInvite', event.target.checked)}
                disabled={mode === 'edit'}
              />
              <span>Kirim email undangan</span>
            </label>

            <label className="space-y-1 text-sm md:col-span-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Password</span>
                {mode === 'edit' && (
                  <button
                    type="button"
                    className="text-xs font-semibold text-primary hover:underline"
                    onClick={() => {
                      setTouchPassword((prev) => !prev);
                      if (touchPassword) {
                        setFormState((prev) => ({ ...prev, password: '' }));
                      }
                    }}
                  >
                    {touchPassword ? 'Batalkan' : 'Setel password baru'}
                  </button>
                )}
              </div>
              {(mode === 'create' || touchPassword) && (
                <input
                  type="password"
                  className="h-11 w-full rounded-xl border border-border/60 bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={formState.password}
                  onChange={(event) => handleChange('password', event.target.value)}
                  placeholder={mode === 'create' ? 'Minimal 8 karakter' : 'Kosongkan untuk tidak mengubah'}
                  required={mode === 'create' && !formState.sendEmailInvite}
                />
              )}
              {mode === 'create' && formState.sendEmailInvite && (
                <p className="text-xs text-muted-foreground">
                  Password tidak wajib ketika mengirim email undangan. User akan membuat password saat menerima email.
                </p>
              )}
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Nama Lengkap</span>
              <input
                type="text"
                className="h-11 w-full rounded-xl border border-border/60 bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={formState.full_name}
                onChange={(event) => handleChange('full_name', event.target.value)}
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Username</span>
              <input
                type="text"
                className="h-11 w-full rounded-xl border border-border/60 bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={formState.username}
                onChange={(event) => handleChange('username', event.target.value)}
              />
            </label>

            <label className="space-y-1 text-sm md:col-span-2">
              <span className="font-medium">Avatar URL</span>
              <input
                type="url"
                className="h-11 w-full rounded-xl border border-border/60 bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={formState.avatar_url}
                onChange={(event) => handleChange('avatar_url', event.target.value)}
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Locale</span>
              <input
                type="text"
                className="h-11 w-full rounded-xl border border-border/60 bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={formState.locale}
                onChange={(event) => handleChange('locale', event.target.value)}
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Zona Waktu</span>
              <input
                type="text"
                className="h-11 w-full rounded-xl border border-border/60 bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={formState.timezone}
                onChange={(event) => handleChange('timezone', event.target.value)}
              />
            </label>

            <label className="space-y-1 text-sm">
              <span className="font-medium">Tema</span>
              <select
                className="h-11 w-full rounded-xl border border-border/60 bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={formState.theme}
                onChange={(event) => handleChange('theme', event.target.value as UserFormValues['theme'])}
              >
                <option value="system">Ikuti Sistem</option>
                <option value="light">Terang</option>
                <option value="dark">Gelap</option>
              </select>
            </label>
          </section>

          {error && <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

          <footer className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                if (!loading) {
                  onClose();
                }
              }}
              className="inline-flex h-11 items-center rounded-xl border border-border/60 px-5 text-sm font-semibold text-muted-foreground transition hover:border-border hover:bg-muted/20"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className={clsx(
                'inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-sm transition',
                loading ? 'opacity-70' : 'hover:bg-primary/90'
              )}
            >
              {loading ? 'Menyimpan…' : mode === 'create' ? 'Buat Pengguna' : 'Simpan Perubahan'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
