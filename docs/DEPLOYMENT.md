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

2. **Belum ada folder `prisma/migrations/`.** Sampai sekarang skema di-`push`
   dengan `prisma db push`. Akibatnya `prisma migrate deploy` di Vercel **belum
   melakukan apa-apa**. Langkah membuat migration ada di Bagian 4.

3. **Upload logo tenant menyimpan berkas ke disk lokal**
   (`src/lib/logo-storage.ts` → `public/uploads/tenants/...`). Di Vercel
   filesystem **read-only & efemeral**, jadi fitur "Ganti Logo" (PRO) akan gagal.
   Solusi ada di Bagian 7.

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

## 4. Membuat Migration Prisma (sekali saja, di lokal)

Ini yang membuat `prisma migrate deploy` punya sesuatu untuk dijalankan.

```bash
npx prisma migrate dev --name init
```

- Perintah ini akan menawarkan **reset database lokal** (karena skema selama ini
  di-`push`, bukan di-migrate). Database lokal (`localhost:51214` dari
  `npx prisma dev`) memang sekali pakai — jawab **yes**.
- Setelah itu, isi ulang data:
  ```bash
  npm run db:seed        # akun SUPER_ADMIN + OWNER dasar
  npx prisma db seed     # data demo presentasi
  ```
- Folder `prisma/migrations/` kini berisi SQL awal → **commit ke Git**.

### Menjalankan otomatis saat deploy

Tambahkan script ini ke `package.json` (Vercel otomatis memakai `vercel-build`
bila ada):

```json
"vercel-build": "prisma migrate deploy && next build"
```

Lalu di Vercel set **Build Command** = `npm run vercel-build` (atau biarkan
Vercel memakai `vercel-build` secara otomatis).

> **Catatan pooler:** migration (DDL) sebaiknya lewat koneksi **direct**, bukan
> pooler. Karena `prisma7.config.ts` saat ini hanya membaca `DATABASE_URL`,
> pilihannya: (a) untuk langkah migration, sementara isi `DATABASE_URL` dengan
> string *direct*, atau (b) minta saya ubah `prisma7.config.ts` agar membaca
> `DIRECT_URL` khusus untuk migration. Opsi (b) paling rapi.

---

## 5. Push ke GitHub

Proyek ini **belum berupa repository Git** (`git status` → *not a git repository*).

```bash
git init
git add .
git commit -m "TaradinMu: siap deploy"
git branch -M main
git remote add origin https://github.com/<akun>/<repo>.git
git push -u origin main
```

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

## 7. Perbaikan yang diperlukan agar PRO branding hidup di produksi

`src/lib/logo-storage.ts` menulis ke disk lokal → tidak bisa di Vercel.
Ganti isi dua fungsi (`simpanLogo`, `hapusLogo`) dengan penyimpanan eksternal:

- **Paling praktis di Vercel:** *Vercel Blob* (`@vercel/blob`) — satu SDK,
  satu `BLOB_READ_WRITE_TOKEN`, tidak perlu S3.
- **Alternatif:** Supabase Storage (sudah punya akun DB), Cloudinary, atau S3.

Setelah pindah ke storage eksternal, bila logo dirender dengan `next/image`,
tambahkan host-nya ke `images.remotePatterns` di `next.config.ts`.

Sisanya (validasi tipe/ukuran, penyimpanan URL di `Tenant.customLogoUrl`) tidak
perlu berubah — sudah dirancang agar tinggal ganti dua fungsi itu.

---

## 8. Checklist verifikasi setelah deploy

- [ ] `https://<domain>/login` terbuka, tidak ada error 500
- [ ] Login `SUPER_ADMIN` → `/admin` menampilkan daftar tenant
- [ ] Login `owner@berkah-haramain.id` (PRO) → dashboard menampilkan pendapatan & estimasi zakat
- [ ] Login `owner@toko-berkah.id` (FREE) → tab "Zakat Penghasilan (Otomatis)" terkunci + modal upgrade muncul
- [ ] `/berkah-haramain/dashboard/billing` → badge "Jatuh Tempo" terlihat
- [ ] `POST /api/chat` dari UI/aplikasi mengembalikan jawaban (atau 503 rapi bila key kosong)
- [ ] Nomor WA pada modal upgrade mengarah ke admin yang benar

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
