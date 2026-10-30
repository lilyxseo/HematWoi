# Memasang HematWoi dari browser tanpa bilah alamat

HematWoi menyediakan manifest PWA dengan `display: standalone`, scope `/`, start URL `/`, identitas aplikasi yang tetap, serta ikon instalasi 192 dan 512 piksel. Saat dipasang sebagai aplikasi dan dibuka melalui ikonnya, browser yang mendukung PWA menampilkan aplikasi tanpa toolbar alamat/judul browser. Status bar Android (jam, baterai, sinyal) tetap merupakan bagian sistem.

## Android / Chrome

1. Pastikan deployment web terbaru telah berhasil.
2. Buka alamat HTTPS aplikasi, misalnya `https://hw-p1.vercel.app`, langsung di Chrome.
3. Jika sebelumnya hanya membuat pintasan yang masih menampilkan alamat, hapus pintasan lama dari layar utama. Jangan menghapus data situs/local storage: data lokal dapat tersimpan di sana.
4. Pilih menu Chrome → **Instal aplikasi** / **Tambahkan ke layar utama**, lalu pilih pemasangan aplikasi jika tersedia.
5. Tutup tab dan buka HematWoi melalui ikon yang baru dipasang.

Instalasi menggunakan domain yang sedang dibuka. Gunakan domain yang sama saat login dan navigasi aplikasi. Halaman pada origin/domain lain (misalnya login Google) dapat menampilkan UI browser demi keamanan. Tab browser biasa juga tetap mempunyai bilah alamat; CSS situs tidak dapat menyembunyikannya.

## iPhone / iPad

Buka situs melalui Safari, lalu Bagikan → Tambahkan ke Layar Utama. Metadata Apple dan ikon sentuh telah disediakan. Tampilan aktual perlu diperiksa pada perangkat iOS.

## Implementasi dan validasi

Service worker `/sw.js` didaftarkan hanya pada build produksi web, bukan aplikasi Capacitor native. Worker meneruskan permintaan jaringan tanpa menyimpan bundle atau data keuangan ke Cache Storage. Ini mendukung instalasi PWA tanpa menjanjikan pemuatan aplikasi ketika offline. Kegagalan registrasi worker tidak menghentikan startup aplikasi.

Vercel menyediakan tipe konten manifest yang benar serta revalidasi untuk manifest dan worker. Ikon diturunkan dari logo aplikasi yang sudah ada. Pengujian lokal menggunakan hasil `npm run build` dan `npm run preview`, lalu memeriksa manifest serta status installability Chrome melalui DevTools Protocol, registrasi worker, dan pemuatan halaman aplikasi. Pengujian browser desktop tidak menggantikan pemeriksaan akhir di Android/iOS.

Pengujian installability dapat diulang setelah menjalankan `npm run build` dan `npm run preview -- --host 127.0.0.1 --port 5180 --strictPort`:

```bash
npm install --prefix /tmp/hematwoi-pwa-tests --no-audit --no-fund playwright-core@1.56.1
NODE_PATH=/tmp/hematwoi-pwa-tests/node_modules node tests/pwa/installability.cjs
```

Tes memakai Chromium di `/usr/bin/chromium` (bisa diubah dengan `CHROMIUM_PATH`) dan origin preview di port 5180 (bisa diubah dengan `PWA_TEST_URL`).
