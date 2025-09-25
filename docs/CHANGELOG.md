# Changelog

- Remove Resume Last Page to resolve navigation lock bug.
- Catat pembayaran hutang kini otomatis membuat transaksi keluar dengan tautan `related_tx_id`. Hapus pembayaran jika perlu rollback—transaksi terkait akan di-soft delete.
