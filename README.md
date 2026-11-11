# St Stefanus — Presentasi Login

Versi tahap pertama: **Node.js 24 + Express 5 + PostgreSQL 17 + Swagger UI standar**.

Hanya endpoint login, profil user yang sedang login, dan health check yang ditampilkan. **Schema database lengkap tetap dipertahankan**, termasuk organizations, users, rooms, bookings, audit_logs, semua foreign key, index, dan constraint. File `migrations/001_initial.sql` disalin tanpa perubahan dari project awal. Data/database project awal tidak dipindah atau diubah.

## Menjalankan dengan Docker

Folder ini sudah dilengkapi `.env` lokal dengan JWT secret baru untuk demo. File itu diabaikan Git. Untuk checkout baru, copy `.env.example` ke `.env` lalu ganti `JWT_SECRET` dengan secret acak minimal 32 karakter.

```powershell
cd D:\PersonalProject\Stefanus
docker compose up -d --build --wait
docker compose exec api node scripts/seed.js
```

Buka **<http://localhost:3001/docs/>**.

| Kebutuhan | Alamat |
| --- | --- |
| API | `http://localhost:3001` |
| Swagger UI | `http://localhost:3001/docs/` |
| PostgreSQL dari komputer | `localhost:5434`, database `booking`, user `booking` |
| PostgreSQL khusus test | `localhost:5435`, database `booking_test` |

Project Compose bernama `stefanus-login`; volume datanya terpisah dari project awal. PostgreSQL di dalam jaringan Docker tetap memakai port 5432. Password database lokal ada pada `.env.example`/Compose; default `booking_local_only`.

## Akun dummy

| Email | Role |
| --- | --- |
| `admin@ststefanus.test` | ADMIN |
| `secretariat@ststefanus.test` | SECRETARIAT |
| `member@ststefanus.test` | MEMBER |

Password mengikuti `SEED_PASSWORD`; default demo **`DemoOnly!Stefanus2026`**. Password disimpan sebagai hash scrypt dengan salt acak, bukan plaintext. Seed aman diulang dan tidak menimpa password user yang sudah ada. Seed lengkap tetap menyertakan organisasi dan contoh ruangan agar data desain database tetap tersedia; tidak ada endpoint pengelolaan ruangan/booking pada tahap ini.

## Urutan demo presentasi

1. Buka Swagger, expand **Auth → POST /auth/login**.
2. Klik **Try it out**, isi email/password dummy, lalu **Execute**.
3. Jelaskan bahwa server mengambil user aktif berdasarkan email, memverifikasi password hash, lalu mengeluarkan JWT dengan masa berlaku satu jam.
4. Salin `accessToken`. Klik **Authorize**, tempel token tanpa awalan `Bearer`, lalu authorize.
5. Jalankan **GET /auth/me**. Server memverifikasi JWT dan mengecek kembali bahwa user masih aktif. Response menampilkan profil tanpa password hash.
6. Coba password salah atau hapus token untuk menunjukkan response **401**. Format body/email salah menghasilkan **400**.
7. Tampilkan `migrations/001_initial.sql` dan diagram di `docs/database.md` untuk menjelaskan desain database keseluruhan.

Tidak ada endpoint logout server: token kedaluwarsa setelah satu jam. Tombol Logout di dialog Swagger hanya menghapus token dari Swagger. Penonaktifan user langsung menolak request berikutnya. Belum ada registrasi publik, password reset, atau refresh token pada tahap ini.


## Import cURL ke Postman

Login:

```bash
curl --request POST 'http://localhost:3001/auth/login' \
  --header 'Content-Type: application/json' \
  --data-raw '{"email":"admin@ststefanus.test","password":"DemoOnly!Stefanus2026"}'
```

Profil (buat variable Environment `token` dari response login):

```bash
curl 'http://localhost:3001/auth/me' \
  --header 'Authorization: Bearer {{token}}'
```

## Menghentikan aplikasi

```powershell
docker compose down
```

Volume database tetap disimpan. Hindari `down -v` jika data masih dibutuhkan. Jangan gunakan akun/password demo untuk deployment produksi.
