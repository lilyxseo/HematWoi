import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import Modal from '../../Modal.jsx';
import type {
  AdminUserItem,
  AdminUserProfileInput,
  CreateAdminUserPayload,
  UpdateAdminUserPayload,
} from '../../../lib/api/adminUsers.ts';

const INPUT_CLASS =
  'h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm transition focus:outline-none focus:ring-2 focus:ring-primary';
const LABEL_CLASS = 'text-xs font-semibold text-muted-foreground';

export type CreateUserFormValues = CreateAdminUserPayload;
export type UpdateUserFormValues = UpdateAdminUserPayload;

type UserFormModalProps = {
  open: boolean;
  mode: 'create' | 'edit';
  initialUser?: AdminUserItem | null;
  submitting?: boolean;
  forcePasswordReset?: boolean;
  onClose: () => void;
  onSubmit: (values: CreateUserFormValues | UpdateUserFormValues) => void;
};

type FormState = {
  email: string;
  password: string;
  sendEmailInvite: boolean;
  role: 'admin' | 'user';
  is_active: boolean;
  full_name: string;
  username: string;
  avatar_url: string;
  locale: string;
  timezone: string;
  theme: 'system' | 'light' | 'dark';
  showPasswordField: boolean;
};

const DEFAULT_FORM: FormState = {
  email: '',
  password: '',
  sendEmailInvite: false,
  role: 'user',
  is_active: true,
  full_name: '',
  username: '',
  avatar_url: '',
  locale: 'id-ID',
  timezone: 'Asia/Jakarta',
  theme: 'system',
  showPasswordField: false,
};

const THEMES: Array<'system' | 'light' | 'dark'> = ['system', 'light', 'dark'];

function normalizeProfile(values: FormState): AdminUserProfileInput {
  return {
    role: values.role,
    is_active: values.is_active,
    full_name: values.full_name.trim() ? values.full_name.trim() : null,
    username: values.username.trim() ? values.username.trim() : null,
    avatar_url: values.avatar_url.trim() ? values.avatar_url.trim() : null,
    locale: values.locale.trim() ? values.locale.trim() : null,
    timezone: values.timezone.trim() ? values.timezone.trim() : null,
    theme: values.theme,
  };
}

function populateFromUser(user: AdminUserItem | null | undefined, forcePasswordReset = false): FormState {
  if (!user) return { ...DEFAULT_FORM };
  return {
    email: user.email ?? '',
    password: '',
    sendEmailInvite: false,
    role: user.profile.role,
    is_active: user.profile.is_active,
    full_name: user.profile.full_name ?? '',
    username: user.profile.username ?? '',
    avatar_url: user.profile.avatar_url ?? '',
    locale: user.profile.locale ?? 'id-ID',
    timezone: user.profile.timezone ?? 'Asia/Jakarta',
    theme: (user.profile.theme ?? 'system') as 'system' | 'light' | 'dark',
    showPasswordField: forcePasswordReset,
  };
}

export default function UserFormModal({
  open,
  mode,
  initialUser,
  submitting = false,
  forcePasswordReset = false,
  onClose,
  onSubmit,
}: UserFormModalProps) {
  const [form, setForm] = useState<FormState>({ ...DEFAULT_FORM });

  useEffect(() => {
    if (open) {
      setForm(mode === 'edit' ? populateFromUser(initialUser, forcePasswordReset) : { ...DEFAULT_FORM });
    }
  }, [open, mode, initialUser, forcePasswordReset]);

  const title = mode === 'create' ? 'Tambah Pengguna' : 'Edit Pengguna';

  const passwordHint = useMemo(() => {
    if (mode === 'create' && form.sendEmailInvite) {
      return 'Password akan dibuat oleh pengguna melalui email undangan.';
    }
    return 'Minimal 8 karakter, mengandung huruf besar, huruf kecil, dan angka.';
  }, [mode, form.sendEmailInvite]);

  const canSubmit = useMemo(() => {
    if (!form.email.trim()) return false;
    if (mode === 'create' && !form.sendEmailInvite && !form.password.trim()) return false;
    if (mode === 'edit' && form.showPasswordField && !form.password.trim()) return false;
    return true;
  }, [form.email, form.password, form.sendEmailInvite, form.showPasswordField, mode]);

  const handleChange = (key: keyof FormState) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = event.target.type === 'checkbox' ? (event.target as HTMLInputElement).checked : event.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    if (mode === 'create') {
      const payload: CreateUserFormValues = {
        email: form.email.trim(),
        password: form.sendEmailInvite ? undefined : form.password,
        sendEmailInvite: form.sendEmailInvite,
        profile: normalizeProfile(form),
      };
      onSubmit(payload);
      return;
    }

    const profile = normalizeProfile(form);
    const updates: UpdateUserFormValues = {
      email: form.email.trim(),
      profile,
    };
    if (form.showPasswordField && form.password.trim()) {
      updates.password = form.password;
    }
    onSubmit(updates);
  };

  const togglePasswordField = () => {
    setForm((prev) => ({
      ...prev,
      showPasswordField: !prev.showPasswordField,
      password: '',
    }));
  };

  return (
    <Modal open={open} title={title} onClose={onClose}>
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 md:col-span-2">
            <span className={LABEL_CLASS}>Email</span>
            <input
              required
              type="email"
              value={form.email}
              onChange={handleChange('email')}
              className={INPUT_CLASS}
              placeholder="nama@contoh.com"
            />
          </label>

          {mode === 'create' ? (
            <label className="space-y-1">
              <span className={LABEL_CLASS}>Password Awal</span>
              <input
                type="password"
                value={form.password}
                onChange={handleChange('password')}
                className={clsx(INPUT_CLASS, !form.sendEmailInvite ? '' : 'bg-muted/40 cursor-not-allowed')}
                placeholder="Password sementara"
                disabled={form.sendEmailInvite}
              />
              <p className="text-[11px] text-muted-foreground">{passwordHint}</p>
            </label>
          ) : (
            <div className="space-y-2 md:col-span-2">
              <button
                type="button"
                onClick={togglePasswordField}
                className="h-10 rounded-2xl border border-border px-4 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
              >
                {form.showPasswordField ? 'Batalkan setel ulang password' : 'Setel password baru'}
              </button>
              {form.showPasswordField ? (
                <label className="space-y-1">
                  <span className={LABEL_CLASS}>Password Baru</span>
                  <input
                    type="password"
                    value={form.password}
                    onChange={handleChange('password')}
                    className={INPUT_CLASS}
                    placeholder="Password baru"
                  />
                  <p className="text-[11px] text-muted-foreground">{passwordHint}</p>
                </label>
              ) : null}
            </div>
          )}

          {mode === 'create' ? (
            <label className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
              <input
                type="checkbox"
                checked={form.sendEmailInvite}
                onChange={handleChange('sendEmailInvite')}
              />
              Kirim email undangan agar pengguna membuat password sendiri
            </label>
          ) : null}

          <label className="space-y-1">
            <span className={LABEL_CLASS}>Peran</span>
            <select value={form.role} onChange={handleChange('role')} className={INPUT_CLASS}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </label>

          <label className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={handleChange('is_active')}
            />
            Akun aktif
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className={LABEL_CLASS}>Nama Lengkap</span>
            <input
              value={form.full_name}
              onChange={handleChange('full_name')}
              className={INPUT_CLASS}
              placeholder="Opsional"
            />
          </label>
          <label className="space-y-1">
            <span className={LABEL_CLASS}>Username</span>
            <input
              value={form.username}
              onChange={handleChange('username')}
              className={INPUT_CLASS}
              placeholder="Opsional"
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className={LABEL_CLASS}>Avatar URL</span>
            <input
              value={form.avatar_url}
              onChange={handleChange('avatar_url')}
              className={INPUT_CLASS}
              placeholder="https://..."
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1">
            <span className={LABEL_CLASS}>Locale</span>
            <input value={form.locale} onChange={handleChange('locale')} className={INPUT_CLASS} />
          </label>
          <label className="space-y-1">
            <span className={LABEL_CLASS}>Zona Waktu</span>
            <input value={form.timezone} onChange={handleChange('timezone')} className={INPUT_CLASS} />
          </label>
          <label className="space-y-1">
            <span className={LABEL_CLASS}>Tema</span>
            <select value={form.theme} onChange={handleChange('theme')} className={INPUT_CLASS}>
              {THEMES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-2xl border border-border px-5 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
            disabled={submitting}
          >
            Batal
          </button>
          <button
            type="submit"
            className="h-11 rounded-2xl bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting || !canSubmit}
          >
            {submitting ? 'Menyimpan…' : mode === 'create' ? 'Tambah Pengguna' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
