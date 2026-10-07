# GreenSport Booking

Website pemesanan lapangan olahraga online untuk project praktikum Software Quality Assurance (SQA). Role yang diuji: **Customer**. Admin hanya pendukung (verifikasi pembayaran dan kelola lapangan).

## Tujuan
Customer dapat mencari lapangan, melihat jadwal, membooking, mengonfirmasi pembayaran, dan memantau status booking. Aplikasi sengaja memiliki kondisi valid/invalid, bentrok, kosong, dan gagal sebagai bahan black-box, white-box, unit, dan automated testing.

## Teknologi
Node.js (>= 18), Express, SQLite (`better-sqlite3`), `bcryptjs` untuk hash password, HTML/CSS/JavaScript murni untuk frontend.

## Instalasi & menjalankan
```bash
npm install
npm start          # buka http://localhost:3000
npm test           # unit test business logic (node:test)
```
Jika `npm install` gagal saat membangun `better-sqlite3` di Windows, pasang Node.js LTS terbaru atau Visual Studio Build Tools.

## Konfigurasi database
SQLite, tanpa setup manual. File `data/greensport.db` dibuat otomatis saat server pertama dijalankan, lengkap dengan data dummy. Untuk reset data: hentikan server, hapus folder `data/`, lalu jalankan ulang. Variabel opsional: `PORT` (default 3000), `DB_FILE` (path file database).

Tabel: `users`, `courts`, `bookings` (FK ke users & courts), `payments` (FK 1:1 ke bookings).

## Test account
| Email | Password | Keterangan |
|---|---|---|
| customer@greensport.test | Customer123! | Akun utama testing (punya 4 booking dengan status berbeda) |
| budi@greensport.test | Budi12345 | Akun kedua, untuk menguji bahwa data booking tidak bocor antar user |
| admin@greensport.test | Admin123! | Admin: verifikasi/tolak pembayaran dan kelola lapangan |

Data dummy: 6 lapangan (Victory Tennis Court berstatus *Tidak Tersedia* untuk uji kondisi tidak tersedia). Booking dummy ada di tanggal relatif terhadap hari ini, misalnya Green Arena Futsal besok 10.00-12.00 sudah terisi (uji bentrok).

## Struktur folder
```
greensport-booking/
├── package.json
├── README.md
├── server/
│   ├── server.js       # routing/API + middleware login
│   ├── db.js           # schema SQLite + seed data
│   ├── logic.js        # validasi & business rules (mudah di-unit-test)
│   └── logic.test.js   # unit test
└── public/
    ├── index.html
    ├── style.css
    └── app.js          # router hash + semua halaman
```

## 8 fitur utama
1. Login  2. Register  3. Forgot Password (cek email, buat password baru; email disimulasikan)  4. Search & filter lapangan (nama, olahraga, lokasi, rentang harga)  5. Ketersediaan jadwal  6. Booking lapangan  7. Konfirmasi pembayaran (Transfer Bank / E-Wallet / QRIS)  8. Riwayat & status booking (detail, pembatalan)

## Business rules
- Password: minimal 8 karakter, ada huruf besar, huruf kecil, dan angka. Nomor HP: `08` + 8-11 digit. Email harus unik.
- Jam operasional 08.00-22.00, jam mulai per jam penuh, durasi 1-3 jam.
- Tanggal/jam yang sudah lewat tidak boleh dibooking.
- Booking tidak boleh bentrok dengan booking aktif lain (yang berstatus Dibatalkan tidak dihitung). Lapangan berstatus Tidak Tersedia tidak bisa dibooking.
- Total harga = harga per jam x durasi (dihitung di server). Kode booking unik (`GSB-XXXXXXXX`).
- Alur status: Menunggu Pembayaran -> (bayar) Menunggu Konfirmasi -> (konfirmasi) Dikonfirmasi -> Selesai (otomatis setelah jadwal lewat). Bisa Dibatalkan.
- Konfirmasi pembayaran dilakukan admin. Jika ditolak, booking kembali ke Menunggu Pembayaran dan customer bisa membayar ulang.
- Pembayaran: Transfer Bank wajib bank + nama rekening + bukti (hanya nama file yang disimpan); E-Wallet wajib pilih e-wallet + nomor valid; QRIS tanpa data tambahan.
- Pembatalan: minimal 3 jam sebelum jadwal; booking Selesai atau Dibatalkan tidak bisa dibatalkan.
- User hanya dapat melihat/mengubah booking miliknya (404 jika bukan miliknya).

## Foto
Foto lapangan dimuat dari Unsplash (Unsplash License) sehingga butuh koneksi internet. Jika foto gagal dimuat, otomatis tampil ilustrasi garis lapangan. Daftar foto ada di konstanta `PHOTOS` pada `public/app.js`.

## Halaman
Home `#/`, Login `#/login`, Register `#/register`, Forgot Password `#/forgot`, Dashboard `#/dashboard`, Daftar Lapangan `#/courts`, Detail Lapangan `#/courts/:id`, Ketersediaan Jadwal `#/schedule/:id`, Form Booking `#/booking/new`, Pembayaran `#/payment/:id`, Riwayat `#/bookings`, Detail Booking `#/bookings/:id`, Profil `#/profile`. Admin: Verifikasi Pembayaran `#/admin`, Kelola Lapangan `#/admin/courts`.

## Fitur admin
Login memakai akun admin lalu diarahkan ke `#/admin`. Admin dapat memfilter semua booking, memverifikasi atau menolak pembayaran (hanya untuk status Menunggu Konfirmasi), serta menambah, mengubah, dan menghapus lapangan. Aturan lapangan: nama min 3 karakter dan unik, harga Rp10.000-Rp1.000.000, lapangan yang sudah punya booking tidak bisa dihapus (ubah status menjadi Tidak Tersedia). Halaman admin dan endpoint `/api/admin/*` ditolak (403) untuk customer.

## API endpoint
| Method | Endpoint | Login |
|---|---|---|
| POST | /api/auth/register, /api/auth/login, /api/auth/forgot, /api/auth/reset | tidak |
| POST | /api/auth/logout | ya |
| GET / PUT | /api/me | ya |
| GET | /api/courts?q=&sport=&location=&minPrice=&maxPrice= | tidak |
| GET | /api/courts/:id, /api/courts/:id/slots?date=YYYY-MM-DD | tidak |
| POST / GET | /api/bookings | ya |
| GET | /api/bookings/:id | ya |
| POST | /api/bookings/:id/pay, /cancel | ya |
| GET | /api/admin/bookings | admin |
| POST | /api/admin/bookings/:id/verify, /reject | admin |
| POST / PUT / DELETE | /api/admin/courts, /api/admin/courts/:id | admin |
