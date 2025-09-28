import clsx from 'clsx';
import { Fragment } from 'react';
import type { AdminUserItem } from '../../../lib/api/adminUsers';
import { Icon } from '../../icons';

type UserTableProps = {
  items: AdminUserItem[];
  onEdit: (user: AdminUserItem) => void;
  onDelete: (user: AdminUserItem) => void;
  onToggleActive: (user: AdminUserItem, next: boolean) => void;
  onChangeRole: (user: AdminUserItem, next: 'admin' | 'user') => void;
  pendingIds?: string[];
  sessionUserId?: string | null;
};

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const relativeFormatter = new Intl.RelativeTimeFormat('id', { numeric: 'auto' });

function formatRelative(date: string | null): string {
  if (!date) return '—';
  const target = new Date(date);
  if (Number.isNaN(target.getTime())) return '—';
  const now = Date.now();
  const diff = target.getTime() - now;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (Math.abs(diff) < hour) {
    const value = Math.round(diff / minute);
    return relativeFormatter.format(value, 'minute');
  }
  if (Math.abs(diff) < day) {
    const value = Math.round(diff / hour);
    return relativeFormatter.format(value, 'hour');
  }
  const value = Math.round(diff / day);
  return relativeFormatter.format(value, 'day');
}

function ProviderIcons({ providers }: { providers: { provider: string }[] }) {
  if (!providers?.length) return <span className="text-xs text-muted-foreground">Email</span>;
  return (
    <div className="flex items-center gap-2">
      {providers.map((item, index) => {
        const provider = item.provider || 'email';
        const key = `${provider}-${index}`;
        if (provider === 'google') {
          return (
            <span
              key={key}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-border/40 bg-white text-[10px] font-semibold text-muted-foreground shadow-sm"
              title="Google"
            >
              G
            </span>
          );
        }
        if (provider === 'github') {
          return (
            <span
              key={key}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-border/40 bg-foreground text-[10px] font-semibold text-background"
              title="GitHub"
            >
              GH
            </span>
          );
        }
        return (
          <span
            key={key}
            className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full border border-border/40 bg-muted/40 px-2 text-[10px] font-semibold uppercase text-muted-foreground"
            title={provider}
          >
            {provider.slice(0, 4)}
          </span>
        );
      })}
    </div>
  );
}

function Avatar({ user }: { user: AdminUserItem }) {
  const initials = (user.profile.full_name || user.profile.username || user.email || user.id)
    ?.trim()
    .charAt(0)
    .toUpperCase();
  const avatarUrl = user.profile.avatar_url;
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={user.profile.full_name ?? user.profile.username ?? user.email ?? 'Avatar'}
        className="h-10 w-10 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
      {initials || 'U'}
    </div>
  );
}

function Toggle({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      disabled={disabled}
      className={clsx(
        'relative inline-flex h-6 w-11 items-center rounded-full transition',
        checked ? 'bg-primary' : 'bg-muted',
        disabled ? 'cursor-not-allowed opacity-60' : 'hover:ring-2 hover:ring-primary/40'
      )}
    >
      <span
        className={clsx(
          'inline-block h-5 w-5 transform rounded-full bg-white transition',
          checked ? 'translate-x-5' : 'translate-x-1'
        )}
      />
    </button>
  );
}

export default function UserTable({
  items,
  onEdit,
  onDelete,
  onToggleActive,
  onChangeRole,
  pendingIds = [],
  sessionUserId,
}: UserTableProps) {
  const pendingSet = new Set(pendingIds);

  const renderRow = (user: AdminUserItem) => {
    const isPending = pendingSet.has(user.id);
    const isSelf = sessionUserId === user.id;
    const disableToggle = isPending || (isSelf && user.profile.role === 'admin');

    return (
      <tr key={user.id} className="odd:bg-muted/10">
        <td className="px-4 py-4">
          <div className="flex items-center gap-3">
            <Avatar user={user} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.profile.full_name || user.profile.username || 'Tanpa nama'}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email || '—'}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-4">
          <select
            className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
            value={user.profile.role}
            onChange={(event) => onChangeRole(user, event.target.value as 'admin' | 'user')}
            disabled={isPending || (isSelf && user.profile.role === 'admin')}
          >
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
        </td>
        <td className="px-4 py-4">
          <Toggle checked={user.profile.is_active} disabled={disableToggle} onChange={(next) => onToggleActive(user, next)} />
        </td>
        <td className="px-4 py-4 text-sm">
          <div className="flex flex-col text-xs">
            <span title={user.last_sign_in_at ? dateFormatter.format(new Date(user.last_sign_in_at)) : undefined}>
              {formatRelative(user.last_sign_in_at)}
            </span>
            <span className="text-muted-foreground">
              {user.last_sign_in_at ? dateFormatter.format(new Date(user.last_sign_in_at)) : 'Belum pernah login'}
            </span>
          </div>
        </td>
        <td className="px-4 py-4 text-sm text-muted-foreground">
          {user.created_at ? dateFormatter.format(new Date(user.created_at)) : '—'}
        </td>
        <td className="px-4 py-4">
          <ProviderIcons providers={user.identities} />
        </td>
        <td className="px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
              onClick={() => onEdit(user)}
              disabled={isPending}
            >
              <Icon name="edit" className="h-4 w-4" />
              Edit
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-xs font-medium text-destructive transition hover:border-destructive hover:bg-destructive/10"
              onClick={() => onDelete(user)}
              disabled={isPending || (isSelf && user.profile.role === 'admin')}
            >
              <Icon name="trash" className="h-4 w-4" />
              Hapus
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const renderCard = (user: AdminUserItem) => {
    const isPending = pendingSet.has(user.id);
    const isSelf = sessionUserId === user.id;
    const disableToggle = isPending || (isSelf && user.profile.role === 'admin');

    return (
      <div key={user.id} className="rounded-2xl border border-border/60 bg-background p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <Avatar user={user} />
          <div className="flex-1 space-y-1">
            <div>
              <p className="text-sm font-semibold">{user.profile.full_name || user.profile.username || 'Tanpa nama'}</p>
              <p className="text-xs text-muted-foreground">{user.email || '—'}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span>Dibuat {user.created_at ? dateFormatter.format(new Date(user.created_at)) : '—'}</span>
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Peran</span>
            <select
              className="rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
              value={user.profile.role}
              onChange={(event) => onChangeRole(user, event.target.value as 'admin' | 'user')}
              disabled={isPending || (isSelf && user.profile.role === 'admin')}
            >
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</span>
            <Toggle checked={user.profile.is_active} disabled={disableToggle} onChange={(next) => onToggleActive(user, next)} />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Terakhir masuk</span>
            <p className="text-xs">{formatRelative(user.last_sign_in_at)}</p>
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Provider</span>
            <div className="mt-1">
              <ProviderIcons providers={user.identities} />
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm font-medium text-muted-foreground transition hover:border-primary hover:text-primary"
            onClick={() => onEdit(user)}
            disabled={isPending}
          >
            <Icon name="edit" className="h-4 w-4" />
            Edit
          </button>
          <button
            type="button"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/20"
            onClick={() => onDelete(user)}
            disabled={isPending || (isSelf && user.profile.role === 'admin')}
          >
            <Icon name="trash" className="h-4 w-4" />
            Hapus
          </button>
        </div>
      </div>
    );
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/10 p-10 text-center">
        <Icon name="user" className="h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium text-muted-foreground">Belum ada pengguna dengan filter saat ini.</p>
      </div>
    );
  }

  return (
    <Fragment>
      <div className="grid gap-3 md:hidden">{items.map((user) => renderCard(user))}</div>
      <div className="hidden md:block">
        <div className="overflow-hidden rounded-2xl border border-border/60">
          <table className="min-w-full divide-y divide-border/60 text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Pengguna</th>
                <th className="px-4 py-3 text-left font-semibold">Peran</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Terakhir Masuk</th>
                <th className="px-4 py-3 text-left font-semibold">Dibuat</th>
                <th className="px-4 py-3 text-left font-semibold">Provider</th>
                <th className="px-4 py-3 text-left font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">{items.map((user) => renderRow(user))}</tbody>
          </table>
        </div>
      </div>
    </Fragment>
  );
}
