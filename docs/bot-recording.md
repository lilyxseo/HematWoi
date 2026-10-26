# Pencatatan melalui bot WhatsApp

## Perintah

- `makan siang 25rb cash`: catat transaksi dengan akun eksplisit.
- Jika kategori/akun belum diketahui, bot menampilkan pilihan bernomor. Balas nomor, nama, `kategori makan`, atau `akun cash`. `batal` membuang draft tanpa menyimpan transaksi. Masa berlaku 10 menit sejak draft dibuat, tidak diperpanjang oleh jawaban berikutnya.
- `nominal 30rb`, `ganti akun seabank`, `kategori makan`, `tanggal 01/06`, `judul makan siang`: koreksi transaksi terakhir yang dicatat dalam percakapan ini. `koreksi` menampilkan bantuan.
- `undo`: soft-delete transaksi dari bukti pencatatan terakhir dalam percakapan ini. Pengulangan `undo` tidak menghapus transaksi sebelumnya. Tidak mengambil transaksi terbaru yang dibuat dari aplikasi atau chat lain.
- `akun default seabank` / `akun default hapus`: atur/hapus akun default.
- `preferensi`: tampilkan akun default, status pembelajaran, dan maksimal 20 aturan hasil koreksi.
- `belajar akun aktif` / `belajar akun mati`: aktifkan/nonaktifkan prediksi berdasarkan riwayat dan pembelajaran dari koreksi.
- `reset pembelajaran`: hapus aturan koreksi dan nonaktifkan prediksi berbasis riwayat. Riwayat transaksi tetap disimpan; `belajar akun aktif` mengizinkan penggunaannya lagi.

Akun eksplisit pada pesan selalu didahulukan. Berikutnya aturan koreksi untuk judul yang sama, akun default, lalu prediksi riwayat lama jika pembelajaran aktif. Koreksi akun disimpan berdasarkan judul yang dinormalisasi; ini bukan model AI eksternal.

## Banyak transaksi

Kirim satu transaksi per baris, maksimal 20 baris:

```text
makan siang 25rb cash
transport ojek 15rb seabank
```

Kategori dan akun harus sudah bisa dikenali untuk setiap baris. Baris yang belum lengkap dilaporkan ❌ dan tidak dijadikan sesi interaktif. Baris valid dimasukkan lewat satu INSERT database. Kirim ulang hanya baris ❌, dengan kategori/akun eksplisit. Mengirim ulang seluruh pesan dengan ID WhatsApp baru tetap dianggap permintaan baru. Koreksi cepat dan undo berlaku pada baris terakhir yang berhasil; pilih transaksi lain melalui `history` dan perintah edit berdasarkan nomor riwayat.

## Typo

Nama kategori dan akun dapat dikenali bila ada tepat satu kandidat dengan selisih satu karakter (termasuk huruf tertukar), panjang minimal empat karakter, dan tidak mengandung angka. Contoh: `seaabank` → `Seabank`, `makna` → `Makan`. Nama pendek seperti BCA harus tepat. Jika ambigu, tidak dipilih otomatis; transaksi sederhana akan meminta pilihan kategori/akun.

Perintah tertentu juga menerima typo, misalnya `sldo`, `katgori makan`, `nomnal 25rb`, dan `ganti aknu cash`. Nominal, tanggal, `hapus`, dan `undo` tidak ditebak atau dikoreksi otomatis. Operasi tambah/edit/hapus master kategori tetap membutuhkan nama tepat.

## Deployment

1. Terapkan `supabase/migrations/20261026000000_bot_recording_workflow.sql` pada proyek Supabase yang dituju **sebelum** deploy webhook baru. Pastikan deployment lama sudah dihentikan/dikuras saat beralih; worker versi lama tidak memakai claim baru.
2. Deploy `fonnte-webhook-v2`, termasuk `recording.ts`. Konfigurasi Fonnte dan Supabase service-role tetap memakai secret server yang sudah ada. Jangan meletakkan service-role di frontend.
3. Bot menerima ID pesan stabil di `id`, `message_id`, `msg_id`, `data.id`, atau `data.message_id`. Untuk payload Fonnte mode LID tanpa ID, bot membuat SHA-256 dari timestamp asli provider, pengirim, tujuan chat, perangkat, isi pesan, jenis, dan URL media. `inboxid: 0` bukan ID unik. Payload tanpa ID maupun timestamp asli yang valid ditolak HTTP 422. Dua pesan identik dari konteks yang sama pada detik timestamp yang sama tidak dapat dibedakan tanpa ID provider dan dianggap duplikat. Waktu penerimaan worker tidak digunakan untuk membuat ID.
4. Uji di proyek staging dan nomor uji: pesan baru, redelivery ID sama, dua pesan bersamaan, pilihan tertunda, koreksi, undo, batch, serta grup. Pastikan integrasi pengirim webhook melakukan retry untuk respons 503. Belum ada pengujian Fonnte/Supabase produksi pada perubahan ini.

## Konsistensi dan pemulihan

`whatsapp_inbound_requests` menyimpan claim unik `(user_id, context_key, message_id)` dan outbox balasan. Prefix perangkat disertakan dalam ID. Fungsi `claim_whatsapp_request` menggunakan advisory lock serta unique index untuk memastikan maksimal satu pesan berstatus processing per pengguna, termasuk lintas chat. Pesan lain mendapat HTTP 503 untuk dicoba ulang, tanpa perubahan data.

Setelah pemrosesan, log konteks dan balasan disimpan sebelum pengiriman ke Fonnte. Status `ready` berarti hasil tersimpan, tetapi pengiriman belum terkonfirmasi. Redelivery ID yang sama hanya mengirim balasan tersimpan; tidak menjalankan mutasi lagi. Pengiriman bersifat *at least once*: crash setelah Fonnte menerima balasan dapat menghasilkan balasan berulang, tetapi tidak mencatat transaksi ulang.

Kegagalan setelah claim memakai status `review`. Crash keras dapat meninggalkan `processing`. Keduanya **tidak otomatis diproses ulang**, karena mutasi mungkin sudah berhasil sebelum kegagalan. Admin perlu memeriksa transaksi, log, dan worker yang masih berjalan. Jangan menghapus claim atau mereset status untuk mencoba ulang secara buta. Setelah rekonsiliasi dan memastikan worker lama berhenti, admin dapat menyimpan bukti hasil yang benar sebagai `reply`/`parsed` dan mengubah status ke `ready` untuk pengiriman ulang, atau ke `review` agar tidak memblokir pesan lain. Jangan mengubah ke `ready` tanpa mengetahui hasil mutasi.

Konteks sukses yang lama sebelum migrasi tetap diperiksa untuk menghindari pemrosesan ulang saat rollout. Tabel claim dan preferensi hanya dapat diakses service role, bukan klien anonim atau pengguna frontend. Retensi claim harus mempertahankan jendela redelivery provider; menghapus claim dan log lama dapat memungkinkan redelivery lama diproses kembali.

## Pengujian lokal

Deno 2.5.4 dan Node 24 digunakan untuk validasi. Impor SDK untuk pemeriksaan tipe dipetakan ke paket npm dengan versi yang sama seperti impor esm.sh; pemeriksaan TLS tetap aktif.

```bash
# dari root repositori
npm exec --yes --package=deno@2.5.4 -- deno check --no-lock --node-modules-dir=none --import-map tests/bot/check-import-map.json supabase/functions/fonnte-webhook-v2/index.ts
npm exec --yes --package=deno@2.5.4 -- deno test --no-check --no-lock --allow-env --import-map tests/bot/import-map.json tests/bot/webhook.integration.ts

npm install --prefix /tmp/hematwoi-bot-tests --no-audit --no-fund @electric-sql/pglite@0.3.14
NODE_PATH=/tmp/hematwoi-bot-tests/node_modules node tests/bot/claims.cjs

npm test -- --maxWorkers=4
npm run lint
```

Tes integrasi menjalankan handler asli dengan SDK database dan pengiriman WhatsApp tiruan; `--no-check` digunakan hanya untuk penggantian SDK tersebut. Pemeriksaan tipe handler produksi dilakukan terpisah dengan SDK asli. Tes SQL mengeksekusi migrasi di PostgreSQL PGlite dan memeriksa claim, outbox, constraint, isolasi pengguna, serta izin. PGlite bukan uji konkurensi multi-koneksi jaringan dan tidak menggantikan pengujian staging.
