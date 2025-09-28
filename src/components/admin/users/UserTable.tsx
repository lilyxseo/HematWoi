import clsx from 'clsx';
import { Edit3, Mail, Moon, ShieldCheck, Trash2, UserCheck2, UserCog } from 'lucide-react';
import type { AdminUserItem } from '../../../lib/api/adminUsers';

const relativeFormatter = new Intl.RelativeTimeFormat('id-ID', { numeric: 'auto' });
const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatRelative(dateString: string | null) {
  if (!dateString) return 'Belum pernah login';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return 'Tidak diketahui';
  }
  const diff = date.getTime() - Date.now();
  const diffSeconds = Math.round(diff / 1000);
  const diffMinutes = Math.round(diffSeconds / 60);
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);

  if (Math.abs(diffSeconds) < 60) {
    return relativeFormatter.format(Math.round(diffSeconds), 'second');
  }
  if (Math.abs(diffMinutes) < 60) {
    return relativeFormatter.format(Math.round(diffMinutes), 'minute');
  }
  if (Math.abs(diffHours) < 24) {
    return relativeFormatter.format(Math.round(diffHours), 'hour');
  }
  return relativeFormatter.format(Math.round(diffDays), 'day');
}

function ProviderBadge({ provider }: { provider: string }) {
  const normalized = provider.toLowerCase();
  if (normalized === 'google') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Google
      </span>
    );
  }
  if (normalized === 'email') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
        <Mail className="h-3 w-3" /> Email
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {provider}
    </span>
  );
}

export type UserTableProps = {
  items: AdminUserItem[];
  loading: boolean;
  onToggleActive: (user: AdminUserItem, nextValue: boolean) => void;
  onEdit: (user: AdminUserItem) => void;
  onDelete: (user: AdminUserItem) => void;
  onResetPassword: (user: AdminUserItem) => void;
};

export default function UserTable({
  items,
  loading,
  onToggleActive,
  onDelete,
  onEdit,
  onResetPassword,
}: UserTableProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="animate-pulse rounded-2xl border border-border/60 bg-muted/40 p-4" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-border/60 bg-muted/10 p-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UserCog className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Belum ada pengguna</h3>
          <p className="text-sm text-muted-foreground">Mulai dengan menambahkan pengguna baru atau ubah filter pencarian.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-border/60 text-left text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Pengguna</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Peran</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Provider</th>
            <th className="px-4 py-3">Terakhir login</th>
            <th className="px-4 py-3">Dibuat</th>
            <th className="px-4 py-3 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {items.map((user) => {
            const providers = user.identities?.length ? user.identities : [{ provider: 'email' }];
            const lastSignInLabel = formatRelative(user.last_sign_in_at);
            const lastSignInTooltip = user.last_sign_in_at ? dateFormatter.format(new Date(user.last_sign_in_at)) : '—';
            return (
              <tr key={user.id} className="transition hover:bg-muted/30">
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {(user.profile.full_name?.charAt(0) || user.profile.username?.charAt(0) || user.email.charAt(0) || 'U').toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        {user.profile.full_name || user.profile.username || user.email.split('@')[0]}
                      </div>
                      <div className="text-xs text-muted-foreground">{user.profile.username ?? '—'}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">{user.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={clsx(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                      user.profile.role === 'admin'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                    )}
                  >
                    {user.profile.role === 'admin' ? <ShieldCheck className="h-3 w-3" /> : <UserCheck2 className="h-3 w-3" />}
                    {user.profile.role === 'admin' ? 'Admin' : 'User'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className={clsx(
                      'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition',
                      user.profile.is_active
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                    )}
                    onClick={() => onToggleActive(user, !user.profile.is_active)}
                  >
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: user.profile.is_active ? '#047857' : '#e11d48' }} />
                    {user.profile.is_active ? 'Aktif' : 'Nonaktif'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {providers.map((identity, index) => (
                      <ProviderBadge key={`${user.id}-${identity.provider}-${index}`} provider={identity.provider} />
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm" title={lastSignInTooltip}>
                  {lastSignInLabel}
                </td>
                <td className="px-4 py-3 text-sm" title={dateFormatter.format(new Date(user.created_at))}>
                  {dateFormatter.format(new Date(user.created_at))}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onResetPassword(user)}
                      className="inline-flex h-9 items-center gap-1 rounded-full border border-border/60 px-3 text-xs font-semibold text-muted-foreground transition hover:border-primary hover:text-primary"
                    >
                      <Moon className="h-3.5 w-3.5" /> Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(user)}
                      className="inline-flex h-9 items-center gap-1 rounded-full border border-border/60 px-3 text-xs font-semibold text-muted-foreground transition hover:border-primary hover:text-primary"
                    >
                      <Edit3 className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(user)}
                      className="inline-flex h-9 items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-3 text-xs font-semibold text-destructive transition hover:bg-destructive/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Hapus
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
