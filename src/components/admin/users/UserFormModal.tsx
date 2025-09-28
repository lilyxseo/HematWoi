import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import type {
  AdminUserItem,
  CreateUserPayload,
  UpdateUserPayload,
} from '../../../lib/api/adminUsers';

const INPUT_CLASS =
  'w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40';

const LABEL_CLASS = 'text-xs font-medium uppercase tracking-wide text-muted-foreground';

const ROLE_OPTIONS: Array<{ value: 'admin' | 'user'; label: string }> = [
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'User' },
];

const THEME_OPTIONS: Array<{ value: 'system' | 'light' | 'dark'; label: string }> = [
  { value: 'system', label: 'Ikuti sistem' },
  { value: 'light', label: 'Terang' },
  { value: 'dark', label: 'Gelap' },
];

type CommonState = {
  email: string;
  password: string;
  confirmPassword: string;
  role: 'admin' | 'user';
  is_active: boolean;
  full_name: string;
  username: string;
  avatar_url: string;
  locale: string;
  timezone: string;
  theme: 'system' | 'light' | 'dark';
  sendEmailInvite: boolean;
  resetPassword: boolean;
};

type UserFormModalProps =
  | {
      mode: 'create';
      open: boolean;
      onClose: () => void;
      onSubmit: (payload: CreateUserPayload) => Promise<void> | void;
      loading?: boolean;
    }
  | {
      mode: 'edit';
      open: boolean;
      onClose: () => void;
      initialData: AdminUserItem | null;
      onSubmit: (payload: UpdateUserPayload) => Promise<void> | void;
      loading?: boolean;
    };

export default function UserFormModal(props: UserFormModalProps) {
  const { mode, open, onClose, loading } = props;
  const initialData = mode === 'edit'
    ? ((props as Extract<UserFormModalProps, { mode: 'edit' }>).initialData ?? null)
    : null;
  const submitHandler = props.onSubmit as (payload: CreateUserPayload | UpdateUserPayload) => Promise<void> | void;

  const [state, setState] = useState<CommonState>(() => ({
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user',
    is_active: true,
    full_name: '',
    username: '',
    avatar_url: '',
    locale: 'id-ID',
    timezone: 'Asia/Jakarta',
    theme: 'system',
    sendEmailInvite: false,
    resetPassword: false,
  }));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    if (mode === 'edit') {
      const data = initialData;
      if (data) {
        setState({
          email: data.email ?? '',
          password: '',
          confirmPassword: '',
          role: data.profile.role,
          is_active: data.profile.is_active,
          full_name: data.profile.full_name ?? '',
          username: data.profile.username ?? '',
          avatar_url: data.profile.avatar_url ?? '',
          locale: data.profile.locale ?? 'id-ID',
          timezone: data.profile.timezone ?? 'Asia/Jakarta',
          theme: data.profile.theme ?? 'system',
          sendEmailInvite: false,
          resetPassword: false,
        });
      }
    } else {
      setState({
        email: '',
        password: '',
        confirmPassword: '',
        role: 'user',
        is_active: true,
        full_name: '',
        username: '',
        avatar_url: '',
        locale: 'id-ID',
        timezone: 'Asia/Jakarta',
        theme: 'system',
        sendEmailInvite: false,
        resetPassword: false,
      });
    }
    setError(null);
  }, [open, mode, initialData]);

  useEffect(() => {
    if (!open) {
      setError(null);
    }
  }, [open]);

  const title = useMemo(() => (mode === 'create' ? 'Tambah Pengguna' : 'Edit Pengguna'), [mode]);

  const handleChange = (field: keyof CommonState) => (value: string | boolean) => {
    setState((prev) => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    if (!state.email.trim()) {
      setError('Email wajib diisi');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(state.email.trim())) {
      setError('Format email tidak valid');
      return false;
    }
    if (mode === 'create') {
      if (!state.sendEmailInvite) {
        if (!state.password.trim()) {
          setError('Password awal wajib diisi');
          return false;
        }
        if (state.password.trim().length < 8) {
          setError('Password minimal 8 karakter');
          return false;
        }
        if (!/[a-z]/.test(state.password) || !/[A-Z]/.test(state.password) || !/[0-9]/.test(state.password)) {
          setError('Password harus mengandung huruf besar, huruf kecil, dan angka');
          return false;
        }
        if (state.password !== state.confirmPassword) {
          setError('Konfirmasi password tidak cocok');
          return false;
        }
      }
    } else if (state.resetPassword) {
      if (!state.password.trim()) {
        setError('Password baru wajib diisi');
        return false;
      }
      if (state.password.trim().length < 8) {
        setError('Password minimal 8 karakter');
        return false;
      }
      if (!/[a-z]/.test(state.password) || !/[A-Z]/.test(state.password) || !/[0-9]/.test(state.password)) {
        setError('Password harus mengandung huruf besar, huruf kecil, dan angka');
        return false;
      }
      if (state.password !== state.confirmPassword) {
        setError('Konfirmasi password tidak cocok');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!validate()) return;

    try {
      if (mode === 'create') {
        const payload: CreateUserPayload = {
          email: state.email.trim(),
          profile: {
            role: state.role,
            is_active: state.is_active,
            full_name: state.full_name.trim() || undefined,
            username: state.username.trim() || undefined,
            avatar_url: state.avatar_url.trim() || undefined,
            locale: state.locale.trim() || undefined,
            timezone: state.timezone.trim() || undefined,
            theme: state.theme,
          },
          sendEmailInvite: state.sendEmailInvite,
        };
        if (!state.sendEmailInvite) {
          payload.password = state.password.trim();
        }
        await submitHandler(payload);
      } else {
        const payload: UpdateUserPayload = {
          email: state.email.trim(),
          profile: {
            role: state.role,
            is_active: state.is_active,
            full_name: state.full_name.trim() || undefined,
            username: state.username.trim() || undefined,
            avatar_url: state.avatar_url.trim() || undefined,
            locale: state.locale.trim() || undefined,
            timezone: state.timezone.trim() || undefined,
            theme: state.theme,
          },
        };
        if (state.resetPassword) {
          payload.password = state.password.trim();
        }
        await submitHandler(payload);
      }
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan pengguna';
      setError(message);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="w-full max-w-2xl rounded-2xl border border-border/40 bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            className="rounded-full p-2 text-muted-foreground transition hover:bg-muted/40"
            onClick={onClose}
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="max-h-[75vh] space-y-6 overflow-y-auto px-6 py-6">
          {error ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className={LABEL_CLASS}>Email</span>
              <input
                type="email"
                className={INPUT_CLASS}
                value={state.email}
                onChange={(event) => handleChange('email')(event.target.value)}
                required
              />
            </label>
            {mode === 'create' ? (
              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={state.sendEmailInvite}
                    onChange={(event) => handleChange('sendEmailInvite')(event.target.checked)}
                    className="h-4 w-4 rounded border-border/60"
                  />
                  Kirim email undangan (password tidak diperlukan)
                </label>
              </div>
            ) : (
              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={state.resetPassword}
                    onChange={(event) => handleChange('resetPassword')(event.target.checked)}
                    className="h-4 w-4 rounded border-border/60"
                  />
                  Setel password baru
                </label>
              </div>
            )}
            {(mode === 'create' && !state.sendEmailInvite) || (mode === 'edit' && state.resetPassword) ? (
              <>
                <label className="flex flex-col gap-1">
                  <span className={LABEL_CLASS}>Password</span>
                  <input
                    type="password"
                    className={INPUT_CLASS}
                    value={state.password}
                    onChange={(event) => handleChange('password')(event.target.value)}
                    required
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className={LABEL_CLASS}>Konfirmasi Password</span>
                  <input
                    type="password"
                    className={INPUT_CLASS}
                    value={state.confirmPassword}
                    onChange={(event) => handleChange('confirmPassword')(event.target.value)}
                    required
                  />
                </label>
              </>
            ) : null}
            <label className="flex flex-col gap-1">
              <span className={LABEL_CLASS}>Peran</span>
              <select
                className={clsx(INPUT_CLASS, 'pr-10')}
                value={state.role}
                onChange={(event) => handleChange('role')(event.target.value as 'admin' | 'user')}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <input
                type="checkbox"
                checked={state.is_active}
                onChange={(event) => handleChange('is_active')(event.target.checked)}
                className="h-4 w-4 rounded border-border/60"
              />
              Aktifkan pengguna
            </label>
            <label className="flex flex-col gap-1">
              <span className={LABEL_CLASS}>Nama lengkap</span>
              <input
                type="text"
                className={INPUT_CLASS}
                value={state.full_name}
                onChange={(event) => handleChange('full_name')(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={LABEL_CLASS}>Username</span>
              <input
                type="text"
                className={INPUT_CLASS}
                value={state.username}
                onChange={(event) => handleChange('username')(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className={LABEL_CLASS}>Avatar URL</span>
              <input
                type="url"
                className={INPUT_CLASS}
                value={state.avatar_url}
                onChange={(event) => handleChange('avatar_url')(event.target.value)}
                placeholder="https://..."
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={LABEL_CLASS}>Locale</span>
              <input
                type="text"
                className={INPUT_CLASS}
                value={state.locale}
                onChange={(event) => handleChange('locale')(event.target.value)}
                placeholder="id-ID"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={LABEL_CLASS}>Timezone</span>
              <input
                type="text"
                className={INPUT_CLASS}
                value={state.timezone}
                onChange={(event) => handleChange('timezone')(event.target.value)}
                placeholder="Asia/Jakarta"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={LABEL_CLASS}>Tema</span>
              <select
                className={clsx(INPUT_CLASS, 'pr-10')}
                value={state.theme}
                onChange={(event) => handleChange('theme')(event.target.value as 'system' | 'light' | 'dark')}
              >
                {THEME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-col-reverse gap-3 pt-2 md:flex-row md:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-xl border border-border/60 px-4 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
              disabled={loading}
            >
              Batal
            </button>
            <button
              type="submit"
              className="h-11 rounded-xl bg-primary px-6 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
              disabled={loading}
            >
              {loading ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
