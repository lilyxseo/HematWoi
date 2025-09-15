# Panduan UI Transaksi

Halaman **Transaksi** menampilkan daftar transaksi dengan filter dan tabel interaktif.

## Kolom Tabel
- **Kategori** – label kategori berwarna, dapat di-drag untuk mengubah kategori.
- **Tanggal** – tanggal transaksi.
- **Catatan/Merchant** – teks singkat, terpotong bila panjang dengan tooltip pada hover.
- **Akun** – sumber dana; tampil `-` bila kosong.
- **Tags** – chip kecil yang dapat diklik untuk filter.
- **Jumlah** – angka sejajar kanan dengan warna hijau untuk pemasukan dan merah untuk pengeluaran.
- **Aksi** – tombol *Edit* dan *Hapus* yang selalu terlihat di sisi kanan.

## Filter Chips
- Muncul di bawah bar filter ketika ada filter aktif.
- Setiap chip memiliki ikon × untuk menghapus filter tersebut.
- Container dapat di-scroll secara horizontal ketika jumlah chip banyak.

## Mode Edit
- Klik **Edit** pada baris untuk masuk mode ubah.
- Kolom catatan mendapatkan fokus pertama.
- Kolom jumlah menampilkan prefix `Rp` dan hanya menerima angka.
- Tekan **Enter** untuk menyimpan, **Esc** untuk batal.
