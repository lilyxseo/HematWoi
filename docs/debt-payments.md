# Pembayaran Hutang & Transaksi Otomatis

- Setiap baris baru di `debt_payments` secara otomatis membuat transaksi keluar (`transactions.type = 'expense'`) via trigger `handle_debt_payment_before_insert`. Deskripsi transaksi menggunakan pola `Bayar utang: <judul utang> - <catatan pembayaran?>` dan ID transaksi disimpan pada kolom `debt_payments.related_tx_id`.
- Perubahan nominal, tanggal (`paid_at`), akun (`account_id`), atau catatan pada pembayaran akan menjaga transaksi terkait tetap sinkron lewat trigger `handle_debt_payment_after_update`.
- Menghapus pembayaran tidak menghapus transaksi secara permanen. Trigger `handle_debt_payment_after_delete` hanya mengisi `transactions.deleted_at` (soft delete) sehingga arus kas bisa dipulihkan bila diperlukan.
- Form "Bayar Utang" di aplikasi meminta nominal, tanggal bayar, dan akun sumber dana. Catatan bersifat opsional. Setelah submit berhasil pengguna menerima notifikasi bahwa transaksi keluar dibuat otomatis dan daftar transaksi bulan berjalan ikut disegarkan.
- Rollback: hapus pembayaran dari panel pembayaran hutang untuk menandai transaksi keluar terkait sebagai terhapus (soft delete). Jika perlu membatalkan soft delete, pulihkan transaksi langsung dari modul transaksi.
