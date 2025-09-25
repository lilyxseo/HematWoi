# Pembayaran Hutang & Transaksi Otomatis

Pemicu basis data baru memastikan pencatatan pembayaran hutang selalu sinkron dengan transaksi keuangan pengguna:

- **Insert** ke `public.debt_payments` otomatis membuat satu baris `public.transactions` bertipe `expense` dengan tanggal `paid_at`, jumlah sesuai `amount`, akun sumber dari `account_id`, dan judul "Bayar utang: <judul hutang>" (ditambah catatan jika ada). Kolom `related_tx_id` pada pembayaran diisi dengan ID transaksi tersebut sehingga pencatatan idempoten.
- **Update** pada pembayaran akan memperbarui transaksi terkait (nominal, tanggal, akun, serta judul/catatan) selama `related_tx_id` terisi.
- **Delete** pembayaran hanya melakukan soft delete pada transaksi terkait (`deleted_at = now()`), sehingga histori arus kas tetap dapat dipulihkan.

## Cara rollback

Jika terjadi kekeliruan pada pembayaran:

1. Edit kembali baris `debt_payments` untuk mengoreksi nominal/tanggal/akun — transaksi yang terhubung ikut berubah otomatis.
2. Hapus pembayaran apabila transaksi perlu dibatalkan. Transaksi terkait tidak hilang, namun ditandai `deleted_at` sehingga dapat dipulihkan jika dibutuhkan.

> Catatan: Seluruh logika dijalankan di PostgreSQL (security definer + `search_path=public`) sehingga tetap mematuhi RLS. Tidak perlu (dan tidak boleh) membuat transaksi manual dari sisi klien.
