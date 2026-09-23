# Panduan Deployment — TaradinMu (Vercel + PostgreSQL)

Runbook ini disusun khusus untuk arsitektur proyek ini:
Next.js 16 (App Router, Turbopack) + Prisma 7 (driver adapter `@prisma/adapter-pg`) +
Auth.js v5 (JWT) + AI SDK v7 (DeepSeek).

> **Baca dulu bagian "⚠️ Sebelum deploy" di bawah** — ada 3 hal di proyek ini yang
> berbeda dari tutorial Next.js/Prisma pada umumnya.

---

## ⚠️ Sebelum deploy — 3 hal khas proyek ini

1. **Nama variabel auth BUKAN `NEXTAUTH_SECRET`/`NEXTAUTH_URL`.**
   Proyek memakai Auth.js v5, yang membaca **`AUTH_SECRET`**. Karena
   `trustHost: true` sudah di-set di `src/modules/core/auth/auth.config.ts`,
   **`NEXTAUTH_URL`/`AUTH_URL` tidak diperlukan** (host dideteksi dari request).
   Menambah `NEXTAUTH_SECRET` tidak akan dipakai — sesi jadi tidak valid.

2. **Migrasi sudah ada (7 berkas di `prisma/migrations/`) dan urutannya penting.**
   Database produksi yang lebih dulu dibuat dengan `prisma db push` **belum punya
   tabel `_prisma_migrations`**, sehingga `prisma migrate deploy` akan mencoba
   menjalankan `0_init` dari nol dan gagal dengan `type "Role" already exists`.
   Basiskan dulu — caranya di Bagian 4.

   Kode yang sekarang juga **membutuhkan kolom/tabel baru** (`Product.kind`,
   `ZakatCalculation.periodMonth`/`periodYear`, tabel `RateLimit`, index pada
   `Invoice`). Jadi migrasi wajib dijalankan di produksi **sebelum atau
   bersamaan** dengan deploy kode; kalau tidak, halaman katalog, invoice, stok,
   dan zakat akan error.

3. **Upload logo tenant sudah aman** — logo disimpan sebagai data URI di kolom
   `Tenant.customLogoUrl` (bukan berkas di disk), jadi fitur white-label PRO
   berjalan di Vercel tanpa storage eksternal. Detail di Bagian 7.

---

## 0. Target deploy saat ini: server AWS + Amazon RDS

> Bagian 1–6 di bawah ditulis untuk **Vercel**. Target yang berlaku sekarang
> adalah **server AWS dengan database Amazon RDS**, jadi bagian Vercel disimpan
> sebagai alternatif saja. Langkah migrasi di Bagian 4 tetap berlaku untuk
> keduanya.

### Urutan rilis yang benar (jangan dibalik)

1. **Migrasi database produksi lebih dulu**, sebelum kode baru berjalan:

   ```bash
   # dari mesin yang punya akses jaringan ke RDS — biasanya server EC2 itu
   # sendiri, bukan laptop (lihat catatan security group di bawah)
   $env:DATABASE_URL="<connection string RDS>"
   npm run db:migrate:status     # periksa keadaan
   npm run db:migrate            # terapkan
   npm run db:migrate:status     # harus "Database schema is up to date!"
   ```

2. **Baru** deploy kode (`git pull` + `npm ci` + `npm run build` + restart proses).

Kalau dibalik, halaman **Produk & Layanan**, **Invoice**, **Stok**, dan **Zakat**
akan error karena kode membaca kolom/tabel yang belum ada (`Product.kind`,
`ZakatCalculation.periodMonth`, `RateLimit`). Halaman lain — landing, login,
`/admin`, dashboard owner, dan pengeluaran — tetap jalan.

### Catatan jaringan database

Saat ini database berjalan **di server yang sama** (`localhost:5432`), jadi migrasi
dijalankan langsung dari EC2 dan tidak ada urusan security group.

Kalau kelak pindah ke **Amazon RDS**, RDS biasanya berada di subnet privat di balik
security group sehingga migrasi belum tentu bisa dijalankan dari laptop. Dua pilihan:
- jalankan dari server EC2 yang punya akses ke RDS (paling mudah), atau
- buka sementara security group untuk IP Anda, jalankan migrasi, lalu tutup lagi.

### Keadaan server produksi (terverifikasi 2026-09-23)

| Hal | Nilai |
|---|---|
| Host | EC2 Ubuntu 22.04, `ubuntu@56.10.70.36` — alias SSH: `ssh taradinmu-ec2` |
| Direktori proyek | `/var/www/taradinmu` |
| Proses | PM2, nama `taradinmu`, menjalankan `npm start` (`next start`) |
| Node.js | 22.23.2 |
| Port aplikasi | `3000`; nginx di port 80 sebagai pintu depan |
| Database | **PostgreSQL 14.24 di server yang sama** (`localhost:5432/taradinmu`) — **bukan RDS** |
| Backup | `~/backup-taradinmu/` — `pg_dump` sebelum setiap migrasi |
| Konfigurasi | `.env` di `/var/www/taradinmu` (memuat `DATABASE_URL`, `AUTH_SECRET`, `ROOT_DOMAIN`, `DEEPSEEK_*`) |
| Autostart | `pm2-ubuntu.service` (enabled) + `~/.pm2/dump.pm2` — aman setelah reboot |

Catatan: `RESEND_API_KEY` **belum diisi** di server, sehingga fitur Lupa Kata
Sandi menolak dengan pesan "belum dikonfigurasi" (bukan error). Isi bila fitur
itu ingin dipakai.

### Perintah deploy (ini yang dipakai 2026-09-23)

```bash
ssh taradinmu-ec2
cd /var/www/taradinmu

# 1. Backup database
DBURL=$(grep -E '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"' | sed 's/?schema=public//')
pg_dump "$DBURL" -f ~/backup-taradinmu/taradinmu-$(date +%Y%m%d-%H%M%S).sql

# 2. Tarik kode baru — aplikasi lama tetap melayani
git pull --ff-only
npx prisma generate

# 3. Build DULU
npm run build

# 4. Baru stop -> migrasi -> start
pm2 stop taradinmu
npm run db:migrate
npm run db:migrate:status        # harus "Database schema is up to date!"
pm2 start taradinmu

# 5. Verifikasi
curl -s -o /dev/null -w 'login HTTP %{http_code}\n' http://localhost:3000/login
```

> **Kenapa build dulu, baru stop?** Migrasi `20260922150000_selaraskan_business_type_dengan_prd`
> mengubah nilai `BusinessType` (mis. `SERVICE` → `TRAVEL_UMROH`). Klien Prisma
> **lama** tidak mengenal nilai baru itu, sehingga membaca tenant akan gagal.
> Urutan di atas memastikan aplikasi yang berjalan selalu cocok dengan skema,
> dengan jendela pemeliharaan hanya selama proses migrasi berlangsung.

---

## 1. Database Production (Neon — rekomendasi)

**Kenapa Neon:** PostgreSQL serverless, free tier cukup untuk demo/tim kecil,
region Singapura dekat dengan pengguna Indonesia, dan punya *connection pooler*
yang penting untuk serverless.

1. Daftar di <https://neon.tech> → **Create project**
   - Name: `taradinmu`
   - Region: **Asia Pacific (Singapore)**
   - Postgres version: 16
2. Setelah selesai, buka **Connection string** → pilih **Pooled connection**
   (host-nya mengandung `-pooler`). Bentuknya:
   ```
   postgresql://<user>:<password>@ep-xxxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
3. Simpan dua nilai:
   - **Pooled** → dipakai aplikasi (`DATABASE_URL`)
   - **Direct** (host tanpa `-pooler`) → dipakai untuk migration

> **Alternatif Supabase:** Project → *Settings → Database → Connection string*.
> Ambil **Transaction pooler** (port `6543`) untuk aplikasi dan **Direct
> connection** (port `5432`) untuk migration. Tambahkan `?sslmode=require`.

---

## 2. Environment Variables di Vercel

Urutan sesuai kode: semua nama di bawah ini benar-benar dibaca dari `src/`.
Tambahkan di **Vercel → Project → Settings → Environment Variables**
(untuk *Production*, *Preview*, dan *Development*).

### Wajib

| Variabel | Contoh / cara mengisi |
|---|---|
| `DATABASE_URL` | Connection string **pooled** dari Bagian 1 |
| `AUTH_SECRET` | Rahasia baru khusus produksi. Generate: `openssl rand -base64 33` |
| `ROOT_DOMAIN` | Domain produksi, mis. `taradinmu.vercel.app` (dipakai untuk URL gambar OG & deteksi subdomain) |
| `NEXT_PUBLIC_WHATSAPP_ADMIN` | Nomor WA admin, format `628970991994` (tanpa `+`, tanpa `0` depan) |

### Opsional (fitur tetap jalan tanpa ini)

| Variabel | Fungsi bila diisi |
|---|---|
| `DEEPSEEK_API_KEY` | Mengaktifkan `/api/chat`. Tanpa ini endpoint balas **503** dengan pesan jelas (bukan error kasar) |
| `DEEPSEEK_MODEL` | Default `deepseek-chat` |
| `DEEPSEEK_BASE_URL` | Default `https://api.deepseek.com/v1` |
| `HARGA_EMAS_PER_GRAM` | Dasar hitung nisab zakat (default `1500000`). **Isi dengan harga emas nyata** agar angka zakat kredibel |
| `RESEND_API_KEY` | Mengaktifkan pengiriman email untuk fitur **Lupa Kata Sandi** (`src/lib/email.ts`, HTTP API Resend — tanpa dependensi baru). Tanpa ini, produksi menolak permintaan reset dengan pesan jelas, bukan diam-diam mengaku terkirim |
| `EMAIL_FROM` | Pengirim email reset sandi, mis. `TaradinMu <no-reply@taradinmu.id>`. Default sudah ada, tetapi domain pengirim harus terverifikasi di Resend |
| `SUPER_ADMIN_NAME` / `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` | Hanya bila ingin menjalankan seed dari dashboard Vercel |
| `OWNER_NAME` / `OWNER_EMAIL` / `OWNER_PASSWORD` / `DEMO_TENANT_NAME` / `DEMO_TENANT_SLUG` | Hanya untuk `npm run db:seed` |
| `DEMO_OWNER_PASSWORD` | Hanya untuk `npm run db:seed:demo` |

### JANGAN ditambahkan (tidak dipakai)

`NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `AUTH_URL`, `OPENAI_API_KEY`.

> `DIRECT_URL` tidak dipakai kode saat ini — lihat catatan di Bagian 4.

---

## 3. Build Check di lokal (wajib sebelum push)

```bash
# 1. Pastikan dependency & Prisma Client sinkron
npm install
npx prisma generate

# 2. Build produksi (sekaligus type-check Next)
npm run build

# 3. Lint
npm run lint
```

Semua harus **hijau**. Jika `npm run build` gagal karena `.next/dev/types`
(bekas dev server), bersihkan lalu ulangi:

```bash
rmdir /s /q .next\dev\types      # Windows
rm -rf .next/dev/types           # macOS/Linux
```

---

## 4. Migrasi database (lokal & produksi)

### 4.1 Membuat migrasi baru (di lokal)

> **`npx prisma migrate dev` tidak bisa dipakai di repo ini.** Ia memakai *shadow
> database*, sedangkan baseline `0_init` dibuat lewat `migrate resolve` (bukan run
> sungguhan) sehingga tidak idempoten — hasilnya `ERROR: type "Role" already
> exists`. Ini perilaku yang sudah diketahui, bukan kerusakan baru.

Prosedur yang dipakai sejak fase C:

```bash
# 1. ubah prisma/schema.prisma
# 2. tulis SQL-nya sendiri:
#    prisma/migrations/<YYYYMMDDHHMMSS>_<nama_snake_case>/migration.sql
#    (komentar bahasa Indonesia + langkah bernomor, seperti migrasi yang ada)
npx prisma db execute --file prisma/migrations/<folder>/migration.sql
npx prisma migrate resolve --applied <nama_folder>
npx prisma generate

# 3. pastikan bersih
npx prisma migrate status
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
#    → harus berbunyi "-- This is an empty migration."
```

### 4.2 Menerapkan ke database produksi

Arahkan ke koneksi **direct** produksi (DDL sebaiknya tidak lewat pooler):

```bash
$env:DATABASE_URL="<connection string DIRECT produksi>"
npx prisma migrate status
```

- Bila berbunyi **"Database schema is up to date!"** → sudah terbaseline, lanjut
  `npx prisma migrate deploy`.
- Bila **semua migrasi tampil sebagai "not yet applied"** (kasus paling mungkin
  untuk database hasil `db push`) → perlu dibaseline dulu, kalau tidak
  `migrate deploy` akan gagal di `0_init`.

**Membaseline** — menandai migrasi yang isinya *sudah ada* di produksi sebagai
applied, **tanpa menjalankannya**:

```bash
npx prisma migrate resolve --applied 0_init
# tambahkan baris berikut HANYA bila migrasi itu pun sudah diterapkan manual:
npx prisma migrate resolve --applied 20260922150000_selaraskan_business_type_dengan_prd
```

> **Hati-hati:** `migrate resolve --applied` hanya mencatat di
> `_prisma_migrations`, ia tidak menyentuh skema. Pastikan dulu isinya
> benar-benar sudah ada, kalau tidak skema produksi akan dianggap lengkap padahal
> belum.

Setelah terbaseline, terapkan sisanya:

```bash
npx prisma migrate deploy
npx prisma migrate status      # harus "Database schema is up to date!"
```

**Urutan aman untuk rilis ini: migrasi produksi dulu → baru push kode.**
Kode sekarang membaca `Product.kind`, jadi halaman katalog/invoice/stok/zakat
akan error bila kolom itu belum ada.

### 4.3 Menjalankan otomatis saat deploy (opsional)

Vercel memakai `vercel-build` bila script itu ada:

```json
"vercel-build": "prisma migrate deploy && next build"
```

Saat ini script itu **belum ditambahkan** — Vercel hanya menjalankan
`npm run build`, sehingga migrasi tidak dijalankan otomatis. Tambahkan **hanya
setelah produksi terbaseline**; selama belum, perintah itu akan menggagalkan
build (dan itu memang lebih baik daripada deploy "sukses" dengan aplikasi rusak).

Catatan: `prisma7.config.ts` hanya membaca `DATABASE_URL`. Bila kelak ingin
migrasi otomatis dengan koneksi direct, ubah berkas itu agar memakai `DIRECT_URL`
untuk keperluan migrasi.

---

## 5. Push ke GitHub

Repo ini **sudah** terhubung ke GitHub: `origin` =
`https://github.com/khayzerrrrr/Taradinmu.id.git`, branch `main`. Jadi tidak perlu
`git init` lagi — cukup:

```bash
git add .
git commit -m "<pesan>"
git push
```

Vercel terhubung lewat integrasi GitHub (bukan CLI — tidak ada folder `.vercel`
di repo ini), sehingga **push ke `main` = deploy**. Ingat urutan di Bagian 4:
migrasi produksi lebih dulu, baru push.

**.env sudah otomatis ter-ignore** (`.gitignore` memuat `.env*`), jadi kredensial
tidak akan ikut ter-push. Periksa sekali lagi dengan:

```bash
git status --short        # .env TIDAK boleh muncul
```

---

## 6. Deploy ke Vercel

1. <https://vercel.com> → **Add New → Project** → **Import Git Repository** →
   pilih repo di atas.
2. **Framework Preset:** Next.js (terdeteksi otomatis).
3. **Root Directory:** biarkan `./` (repo = root proyek).
4. **Build Command:** `npm run vercel-build` (setelah Bagian 4).
5. **Node.js Version:** **22.x** (Next.js 16 butuh ≥ 20.9; AI SDK v7
   menyarankan ≥ 22).
6. **Environment Variables:** tempel semua dari Bagian 2 → **Deploy**.
7. Tunggu build. Log akan menampilkan `prisma migrate deploy` lalu
   `next build`. Sukses = aplikasi online di `https://<nama>.vercel.app`.

### Setelah deploy pertama: isi akun & data demo

Jalankan dari komputer Anda, arahkan ke database produksi:

```bash
# Windows (PowerShell)
$env:DATABASE_URL="<connection string DIRECT produksi>"
npm run db:seed        # akun SUPER_ADMIN
npx prisma db seed     # data demo (Berkah Haramain PRO + Toko Berkah FREE)
```

> Seed demo hanya menyentuh 2 tenant demo; akun SUPER_ADMIN tidak ditimpa.

---

## 7. Upload logo — sudah siap untuk Vercel

Logo tenant **tidak ditulis ke disk**. `src/lib/logo-storage.ts` mengubah berkas
menjadi **data URI** (`data:image/png;base64,...`) dan menyimpannya di kolom
`Tenant.customLogoUrl`. Batas ukuran logo 512 KB membuat pendekatan ini wajar,
dan fitur "Ganti Logo" (PRO) langsung jalan di Vercel tanpa storage eksternal.

Kapan sebaiknya pindah ke storage eksternal:
- Logo menambah ukuran baris tabel `tenants` sekitar 33% dari ukuran berkas
  (efek base64). Untuk beberapa tenant ini tidak masalah.
- Bila tenant bertambah banyak atau logo membesar, ganti isi `simpanLogo()`
  di berkas itu ke **Vercel Blob / S3 / Supabase Storage**. Pemanggil dan
  komponen tampilan tidak perlu berubah karena keduanya hanya memakai URL.
- Bila nanti memakai `next/image`, tambahkan host-nya ke `images.remotePatterns`
  di `next.config.ts`.

---

## 8. Checklist verifikasi setelah deploy

- [ ] `https://<domain>/login` terbuka, tidak ada error 500
- [ ] Login `SUPER_ADMIN` → `/admin` menampilkan daftar tenant
- [ ] Login `owner@berkah-haramain.id` (PRO) → dashboard menampilkan pendapatan & estimasi zakat
- [ ] Login `owner@toko-berkah.id` (FREE) → tab "Zakat Penghasilan (Otomatis)" terkunci + modal upgrade muncul
- [ ] `/berkah-haramain/dashboard/billing` → badge "Jatuh Tempo" terlihat
- [ ] `POST /api/chat` dari UI/aplikasi mengembalikan jawaban (atau 503 rapi bila key kosong)
- [ ] Nomor WA pada modal upgrade mengarah ke admin yang benar

### Khusus rilis ini (Tahap 1 — membuka jalan usaha jasa)

- [ ] `/berkah-haramain/dashboard/inventory` → menu berbunyi **"Produk & Layanan"**, dan form tambah menawarkan **Jenis: Barang / Jasa**
- [ ] Buat item **Jasa** → buat invoice untuk item itu → **berhasil tanpa stok**, pesannya menyebut "tidak ada stok yang dipotong"
- [ ] Buat invoice item **Barang** → stok tetap terpotong (periksa halaman Stok)
- [ ] Invoice item barang dengan jumlah melebihi stok → **tetap ditolak** dengan pesan stok
- [ ] Tenant yang hanya punya item jasa → menu **Stok / Stok Masuk / Stok Keluar tidak muncul**, katalog tetap ada
- [ ] `/lupa-sandi` mengirim tautan bila `RESEND_API_KEY` terisi; bila kosong muncul pesan "belum dikonfigurasi", bukan error 500
- [ ] Beberapa kali login dengan sandi salah → mulai ditolak (tanda tabel `RateLimit` bekerja)

---

## 9. Catatan operasional

- **Tenant lewat path (bukan subdomain):** di domain Vercel, tenant diakses
  sebagai `https://<domain>/<slug>` (mis. `/berkah-haramain`). Mode subdomain
  (`toko.<ROOT_DOMAIN>`) butuh **custom domain + wildcard DNS** `*.taradinmu.id`.
- **Region fungsi:** pilih Singapore agar dekat DB & pengguna.
- **Backup:** Neon/Supabase menyediakan backup otomatis pada tier berbayar;
  untuk data presentasi, cukup ekspor manual sesekali.
- **Folder `preview/`** (ekspor HTML statis untuk pratinjau desain) ikut ter-commit.
  Tidak mengganggu build; bisa ditambahkan ke `.gitignore` bila tidak diperlukan.
- **Landing page** (`/`) membaca `src/landing/index.html` saat build
  (`src/app/route.ts`, `force-static`) dan disajikan sebagai HTML statis — aman
  di Vercel.
