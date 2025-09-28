import { useEffect, useState } from 'react';
import Modal from '../../../components/Modal.jsx';
import type { AdminUserItem } from '../../../lib/api/adminUsers';

type DeleteMode = 'soft' | 'hard';

type DeleteUserDialogProps = {
  open: boolean;
  user?: AdminUserItem | null;
  deleting?: boolean;
  onClose: () => void;
  onConfirm: (mode: DeleteMode) => Promise<void> | void;
};

export default function DeleteUserDialog({
  open,
  user,
  deleting = false,
  onClose,
  onConfirm,
}: DeleteUserDialogProps) {
  const [mode, setMode] = useState<DeleteMode>('hard');

  useEffect(() => {
    if (!open) return;
    setMode('hard');
  }, [open]);

  if (!user) return null;

  const handleConfirm = async () => {
    await onConfirm(mode);
  };

  return (
    <Modal open={open} title="Hapus Pengguna" onClose={onClose}>
      <div className="space-y-4 text-sm text-text">
        <p>
          Tindakan ini akan {mode === 'hard' ? 'menghapus seluruh data pengguna dari sistem' : 'menonaktifkan akun sehingga pengguna tidak bisa login lagi'}.
        </p>
        <div className="rounded-2xl border border-border-subtle bg-surface-2 p-4 text-xs text-muted-foreground">
          <p className="font-semibold text-text">Ringkasan akun</p>
          <ul className="mt-2 space-y-1">
            <li><span className="text-muted">Email:</span> {user.email}</li>
            <li><span className="text-muted">Role:</span> {user.profile.role}</li>
            <li><span className="text-muted">Status:</span> {user.profile.is_active ? 'Aktif' : 'Tidak aktif'}</li>
            <li><span className="text-muted">ID:</span> <span className="font-mono">{user.id}</span></li>
          </ul>
        </div>
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-text">Pilih jenis penghapusan</legend>
          <label className="flex items-start gap-3 rounded-2xl border border-border-subtle bg-surface-1 p-3">
            <input
              type="radio"
              name="delete-mode"
              className="mt-1"
              value="hard"
              checked={mode === 'hard'}
              onChange={() => setMode('hard')}
            />
            <div>
              <p className="font-semibold text-text">Hard delete</p>
              <p className="text-xs text-muted-foreground">
                Menghapus data auth dan profil secara permanen.
              </p>
            </div>
          </label>
          <label className="flex items-start gap-3 rounded-2xl border border-border-subtle bg-surface-1 p-3">
            <input
              type="radio"
              name="delete-mode"
              className="mt-1"
              value="soft"
              checked={mode === 'soft'}
              onChange={() => setMode('soft')}
            />
            <div>
              <p className="font-semibold text-text">Soft delete</p>
              <p className="text-xs text-muted-foreground">
                Hanya menonaktifkan akun tanpa menghapus data auth.
              </p>
            </div>
          </label>
        </fieldset>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={deleting}>
            Batal
          </button>
          <button
            type="button"
            className={mode === 'hard' ? 'btn btn-danger' : 'btn btn-secondary'}
            onClick={handleConfirm}
            disabled={deleting}
          >
            {deleting ? 'Memproses…' : mode === 'hard' ? 'Hapus Permanen' : 'Nonaktifkan Pengguna'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
