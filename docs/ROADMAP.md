# TaradinMu — Status & Roadmap

Dokumen ini **bukan** pengganti PRD. PRD tetap sumber kebenaran tunggal dan kini
berada di dalam repo: [`TARADINMU-PRD.md`](../TARADINMU-PRD.md).

Tujuan dokumen ini sempit dan praktis: mencatat **batas fase yang berlaku**,
**konflik di dalam PRD yang butuh keputusan pemilik produk**, dan **status
implementasi yang sudah diverifikasi dari kode** — supaya tidak ada lagi fitur
yang dibangun dari dugaan.

Terakhir diaudit: seluruh temuan di bawah diperiksa langsung dari kode pada
repositori ini, bukan dari ingatan.

Audit ulang terakhir: **2026-09-23**. Enam klaim dikoreksi karena tidak cocok
dengan kode dan ditandai `[dikoreksi]` di bawah: §4 P4 (migrasi), P2 #10
(kalkulator zakat manual), P1 #1 (role Kasir → konflik baru K8), dan §7 (sandi
OWNER, modul `toko-demo`, jumlah layar `preview/`).

---

## 1. Aturan kontribusi (mengikat)

Tiga insiden nyata di repo ini melahirkan aturan berikut. Semuanya wajib.

1. **PRD-first.** Tidak ada fitur baru tanpa lebih dulu menambah/mengubah entri
   di `TARADINMU-PRD.md`, termasuk menandai fasenya. Fitur yang tidak ada di PRD
   tidak boleh ditulis.
2. **Satu penulis per file.** Dua agen/sesi tidak boleh menulis ke repo yang sama
   tanpa pembagian kepemilikan file tertulis. Ini pernah menyebabkan file
   ditimpa dan rute dipindahkan diam-diam.
3. **Dilarang menempel potongan kode ke dalam file modul.** `import` hanya di
   bagian atas file, dan satu file hanya boleh punya satu `export default`.
   Pelanggaran aturan ini pernah membuat `src/app/(tenant)/layout.tsx` tidak bisa
   di-compile.
4. **Gerbang wajib sebelum menyatakan selesai:**
   `npx tsc --noEmit` **dan** `npm run lint` **dan** `npm run test` **dan**
   `npm run build` — keempatnya harus hijau. (`npm run test` ditambahkan saat
   fase K; sebelumnya proyek ini tidak punya tes otomatis sama sekali.)
5. **Perubahan skema database wajib disertai migrasi** di `prisma/migrations/`.
   `prisma db push` hanya untuk eksperimen lokal, bukan untuk jalur rilis.
6. Aturan PRD Bagian 6 tetap berlaku dan **sudah dipatuhi**: dilarang `any`
   (terverifikasi 0 pemakaian pada audit 2026-09-23), modul tidak saling
   mengimpor UI (0 pelanggaran), semua input divalidasi Zod, Server Action
   mengembalikan `ActionResponse` — `{ success, message, data?, error?, code? }`
   (`src/shared/types.ts`).

---

## 2. Konflik di dalam PRD — butuh keputusan pemilik produk

PRD bertabrakan dengan dirinya sendiri. Selama ini belum diputuskan, sehingga
agen berikutnya mengarang sendiri penyelesaiannya.

| # | Konflik | Usulan penyelesaian |
|---|---|---|
| K1 | Bagian 7 menulis *"Fase 1 (Fokus Saat Ini) — JANGAN buat fitur di luar ini"* dan daftarnya hanya Core, Inventory, Billing, Dashboard Owner. Tetapi Bagian 4.C/D/E (ditambahkan setelah v1.0.0) berisi Industry Presets, Zakat, Freemium Gating, dan AI Agent. | Angkat 4.C/D/E menjadi **Fase 1B** (nyatanya sudah terbangun), lalu perbarui Bagian 7 agar tidak lagi melarang. |
| K2 | Bagian 4.D.3 meminta modal upgrade dengan **efek blur di latar belakang**; `desain.md` melarang backdrop-blur. | Blur diizinkan **hanya** pada overlay modal upgrade (pengecualian tercatat). Sudah begitu implementasinya. |
| K3 | PRD menyebut `src/middleware.ts`; Next.js 16 menamainya `src/proxy.ts`. | Kode sudah benar. Perbarui PRD. |
| K4 | Laporan: Bagian 4.D menaruh "Laba Rugi Sederhana" di FREE dan "Neraca/Arus Kas/Pajak" di PRO, tetapi Bagian 7 menaruh seluruh pelaporan di Fase 2. | Tetapkan pelaporan = Fase 2, dan turunkan janji di Bagian 4.D. |
| K5 | Batas FREE: PRD menulis *"maksimal 50 Invoice **per bulan**"* dan *"maksimal 1 User"*. | **Sudah diputuskan & dikerjakan** — 50 **per bulan**. `feature-guards.ts` menghitung invoice dengan filter `createdAt >= awal bulan` (helper bersama `src/lib/periode.ts`), dan batas user FREE 1 / PRO tanpa batas. Lihat §6. |
| K6 | `businessType` di PRD (8 nilai) berbeda dari kode (6 nilai). Lihat §4. | **Sudah diputuskan & dikerjakan** (lihat §6). |
| K7 | Preset `batchTracking` (jenis usaha) vs `plan-limits` (paket) sama-sama menentukan akses fitur batch, dan keduanya bertabrakan: FREE+RETAIL_FNB diizinkan preset tetapi ditolak plan-limits. | Paket adalah **satu-satunya** penentu (PRD 4.D). `isBatchTrackingEnabled()` kini mendelegasikan ke `plan-limits.ts`. Diverifikasi 2026-09-23 (`business-presets.ts:164`). |
| K8 | **`[dikoreksi]`** Bagian 4.D (baris 371) menjanjikan PRO bisa menambah *"Admin, **Kasir**, Staff, Akuntan"*, tetapi `enum Role` di PRD sendiri (baris 59–65) hanya punya `SUPER_ADMIN, OWNER, ADMIN, STAFF, ACCOUNTANT` — tidak ada `KASIR`. | **Sudah diputuskan & dikerjakan**: kata "Kasir" dihapus dari PRD (peran itu diwakili `STAFF`); `enum Role` tidak diubah sehingga tidak perlu migrasi enum. Lihat §6. |

---

## 3. Batas fase yang berlaku

### Fase 1 — MVP (inti yang sudah terbangun)

- Multi-tenant: path `taradinmu.id/nama-toko` dan subdomain `nama-toko.taradinmu.id`
- Auth (NextAuth v5, sesi JWT, 5 role) + registrasi tenant lewat preset
- Super Admin: daftar tenant, provisioning, ubah paket & modul
- Inventory: Produk, Varian (SKU unik), Batch + tanggal kedaluwarsa, Stok Masuk/Keluar, alokasi **FEFO**
- Billing: Pelanggan, Invoice multi-item + pajak, status `DRAFT/SENT/PAID/OVERDUE`
- Dashboard Owner: piutang, pendapatan bulan berjalan, stok menipis, hampir kedaluwarsa
- Branding white-label (logo + warna) untuk PRO
- Pembatasan paket FREE/PRO (`plan-limits.ts` + `checkLimit()`)

### Fase 1B — fitur dari PRD Bagian 4 yang sudah terbangun

- Industry Presets (registrasi otomatis mengisi modul, batch, dan kategori)
- Zakat ganda: penghasilan (otomatis) & perniagaan (manual, PRO)
- Pengeluaran / Akuntansi dasar (8 kategori)
- Upgrade prompt (modal + gembok pada menu yang terkunci)
- Asisten AI (khusus PRO)

### Fase 2 — **JANGAN dibuat sekarang**

Chart of Accounts, jurnal otomatis, Laba/Rugi, Neraca, Arus Kas, integrasi pajak (PPN, PPh Final), pelaporan lengkap.

### Fase 3 — **JANGAN dibuat sekarang**

B2B Marketplace antar tenant, modul khusus Klinik, modul khusus Sekolah (integrasi SKULV).

---

## 4. Gap yang sudah diverifikasi

Diurutkan berdasarkan dampak. Semua diverifikasi dari kode.

### P0 — Tenant aktif bisa terkunci permanen (ditemukan 2026-09-24, **jalur pemulihannya sudah dibangun** — lihat fase S)

Empat fakta yang masing-masing masuk akal, tapi bila bertemu menghasilkan jalan
buntu bagi pemilik toko yang lupa kata sandi:

1. Paket FREE dibatasi **1 pengguna** (`plan-limits.ts`) → satu-satunya akun tenant
   FREE adalah **OWNER**. Tidak ada rekan kerja yang bisa tolong-menolong.
2. `/lupa-sandi` memerlukan `RESEND_API_KEY`. Di produksi kosong, jadi `email.ts`
   menolak mengirim — perilaku yang benar, tetapi **waktu itu tidak ada jalur kedua**.
3. Super Admin pun tidak bisa menolong: `updateUser` dan `deleteUser` menolak akun
   ber-role OWNER (`PESAN_AKUN_ISTIMEWA`), dan halaman Pengguna menandai
   barisnya `tidakDapatDiubah`. Larangan ini tepat untuk sesama anggota tenant
   (mencegah perebutan kepemilikan) — yang belum dipikirkan adalah pemulihan.
4. Verifikasi email belum ada, jadi belum ada jaminan alamat email tenant benar
   sejak awal.

**Akibatnya (sebelum fase S):** satu-satunya pemulihan adalah menulis SQL manual ke database produksi
— membuat hash bcrypt sendiri dan menimpa kolom `User.password`. Tidak teraudit,
mudah salah, dan berisiko salah sasaran.

**Sudah ditutup sebagian (fase S, 2026-09-24):** fakta 1–3 tidak lagi jadi jalan
buntu. `resetKataSandiAkun()` boleh mengubah sandi akun mana pun, termasuk OWNER
dan SUPER_ADMIN, dari `/admin`, dijaga `assertSuperAdmin()`, dan tercatat ke log.
Proteksi `PESAN_AKUN_ISTIMEWA` di halaman Pengguna tenant **tetap utuh** — ia
hanya melarang jalur dari dalam tenant.

Yang masih terbuka: fakta 2 (belum ada penyuplai email terkonfigurasi di produksi,
jadi pemulihan rutin tetap harus lewat Super Admin sampai `RESEND_API_KEY` diisi)
dan fakta 4 (email belum diverifikasi, jadi langkah ini bertumpu pada kepercayaan
penuh kepada pemegang akun Super Admin).

### P1 — Lubang Fase 1 (PRD sendiri menyebut ini bagian MVP)

| # | Yang PRD minta | Kondisi kode |
|---|---|---|
| 1 | **User Management + Role-based access**: FREE maks 1 user, PRO unlimited | **Selesai.** Halaman `/dashboard/settings/users` + 4 Server Action (baca/tambah/ubah/hapus) + batas paket `USERS`; role yang tersedia `ASSIGNABLE_ROLES = ADMIN/STAFF/ACCOUNTANT` (K8: kata "Kasir" dihapus dari PRD). Lihat §6 |
| 2 | **Impersonate** — Super Admin "login sebagai tenant" untuk debugging (4.B) | **Selesai.** Tombol "Masuk sebagai tenant" di `/admin`, penanda di JWT, banner + tombol keluar. Catatan jujur: ini **bukan penurunan hak** — `role` tetap SUPER_ADMIN (agar `/admin` tidak terkunci), hanya konteks tenant yang berubah. Lihat §6 |
| 3 | **`businessType` & preset sesuai PRD 4.C** | **Selesai.** Enum kini 8 nilai sesuai PRD (`RETAIL_FNB, TRAVEL_UMROH, JASA_ORDER, PROJECT_BASED, TRADING, EDUCATION, HEALTH_CLINIC, OTHER`), preset 8 buah, data tenant lama sudah dimigrasikan. Lihat §6 |
| 4 | Dashboard Owner: "Ringkasan **Kas**, Piutang, Stok menipis" | Piutang ✅, Stok menipis ✅, **Kas ✅** — kartu "Arus Kas Bulan Ini". Keputusan pemilik produk: yang dimaksud PRD adalah **arus kas** (bukan saldo kas, yang akan butuh fitur saldo awal). Butir ditutup. Lihat §6 |
| 5 | Invoice maks 50 **per bulan** | **Selesai.** Dihitung dari invoice **bulan berjalan** saja, ditopang index `Invoice(tenantId, createdAt)`; halaman billing menampilkan sisa kuota dan mengganti form dengan ajakan upgrade saat penuh. Lihat §6 |

### P2 — Janji PRO yang belum ada sama sekali

| # | Janji (PRD 4.D) | Kondisi kode |
|---|---|---|
| 6 | **Cicilan / pembayaran bertahap** (kebutuhan Travel & Kontraktor) | Tidak ada. Padahal ini alasan utama orang berlangganan PRO |
| 7 | **Multi-Gudang** | Tidak ada |
| 8 | **Favicon kustom** white-label | Logo ✅ warna ✅ favicon ❌ |
| 9 | **Cetak Laporan Zakat** + periode bulanan (4.D.3) | **Selesai.** `ZakatCalculation` menyimpan `periodMonth`/`periodYear` (migrasi + backfill), riwayat dikelompokkan per periode, dan ada tombol "Cetak Laporan Zakat" (`window.print()` + blok `@media print` pertama di repo). Bagian zakat otomatis **tidak ikut dicetak** untuk FREE agar gating tidak bocor lewat hasil cetak. Lihat §6 |
| 10 | FREE: "Zakat hanya kalkulator manual (input angka sendiri)" | **Terpenuhi** (`[dikoreksi]`). Tab *"Zakat Perniagaan (Manual)"* (`ZakatPerniagaanPanel` + `calculateZakatPerniagaan`) menerima input aset & hutang dan **tidak dipagari paket**, jadi FREE memang punya kalkulator manual. Yang dikunci PRO hanyalah Zakat Penghasilan **otomatis** (tab sebelah) dan penyimpanan riwayat `type: "INCOME"` lewat `checkLimit(..., "ZAKAT")` |
| 11 | **Asisten AI**: PRO-only ✅, FAB + drawer ✅, baca data *read-only* ❌, tulis dengan konfirmasi ❌ | Endpoint & gating PRO **sudah berfungsi** (diperbaiki dari kondisi rusak). **Belum tersambung ke data tenant** — prompt sudah diperintahkan untuk tidak mengarang angka, tetapi RAG/tools belum ada |

### P3 — Kapabilitas per preset (PRD 4.C) yang belum dibangun

`RETAIL_FNB` → POS · `TRAVEL_UMROH` → ~~CRM Jamaah~~ + cicilan · `JASA_ORDER` → Order Tracking/status workflow · `PROJECT_BASED` → ~~Billing per proyek~~ · `TRADING` → Invoice B2B

Yang dicoret sudah dilayani **mesin Program** (fase U, PRD 4.F): satu entitas berlabel
industri — Kloter untuk travel, Proyek untuk kontraktor/EO, Tahun Ajaran untuk
pendidikan, Pesanan untuk jasa — dengan peserta menaut `Customer` dan uang dihitung
dari `Invoice`/`Expense` yang sudah ada. Sisa pekerjaan tiap preset adalah yang **tidak**
bisa diwakili satu mesin: cicilan (Tahap 3), alur status pesanan, dan invoice B2B.

### P4 — Fondasi produksi (tidak ada di PRD, tapi wajib untuk rilis)

- ~~**0 tes otomatis**~~ **Selesai**: `npm run test` memakai Node test runner lewat `tsx`
  (keduanya sudah tersedia) — **177 tes** untuk logika murni (perhitungan zakat, kontras
  merek, ringkasan stok, batas paket, batas bulan, transisi invoice, siklus hidup &
  tanggal program, pemisahan laba vs arus kas, HPP & rata-rata tertimbang harga modal,
  rencana alokasi FEFO, penyamaran nilai rahasia di log), ditambah
  **isolasi tenant** dan **penjaga struktur Server Action** (lihat fase Q). Tanpa
  dependensi baru.
- ~~Tidak ada `prisma/migrations/`~~ `[dikoreksi]` **tidak lagi berlaku**:
  `prisma/migrations/` sudah ada (`0_init`, `20260922150000_selaraskan_business_type_dengan_prd`,
  `migration_lock.toml`) sejak fase C — lihat §6.
- ~~Tidak ada rate limiting di `/api/chat` dan `/login`~~ **Selesai**: tabel `RateLimit` +
  `src/lib/rate-limit.ts`. Ditegakkan di `authorize()` (per email **dan** per IP — jalur
  `/api/auth/*` tidak lewat proxy, jadi ini choke point-nya) dan di `/api/chat` (per pengguna).
- ~~Belum ada reset password~~ **Selesai**: alur `/lupa-sandi` → `/reset-sandi` memakai
  `VerificationToken` (token di-hash, sekali pakai, berlaku 30 menit, jawaban netral).
  **Prasyarat produksi:** `RESEND_API_KEY` untuk pengiriman email; tanpa itu produksi
  menolak dengan pesan jelas, bukan diam-diam mengaku terkirim.
- Belum ada verifikasi email
- ~~Belum ada error tracking / logging terpusat~~ **Selesai** (fase R): `src/lib/log.ts`
  menulis satu baris JSON per kejadian ke stdout (ditangkap `pm2 logs`), dipasang di
  dalam `pesanErrorUmum()` sehingga **44** catch block Server Action tercakup tanpa
  mengubah call site-nya. Ditambah `src/app/error.tsx` + `global-error.tsx`
  (sebelumnya: **nol** pagar error di seluruh aplikasi). Tanpa dependensi baru.
  Dua batas yang diterima dan sengaja dicatat:
  1. Pagar error **tidak** menampilkan UI-nya saat SSR crash sebelum shell terkirim —
     jalur itu tetap balas 500 dengan dokumen `__next_error__` (dibuktikan di server
     produksi). Cakupan nyatanya: navigasi sisi klien, komponen klien, dan segmen
     yang error setelah shell ter-flush.
  2. Logger Next sendiri mencetak error mentah ke stdout dan tidak bisa disaring,
     jadi penyamaran nilai rahasia di `log.ts` hanya melindungi baris milik kita.
     Berkas log harus diperlakukan sebagai data rahasia.

---

### P5 — Temuan struktural (audit lanjutan 2026-09-23)

Ditemukan saat menilai kesiapan aplikasi untuk **semua** jenis usaha SUMU, bukan
hanya yang menjual barang. Semua diverifikasi dari kode.

| # | Temuan | Dampak | Status |
|---|---|---|---|
| 12 | **Invoice selalu memotong stok** — `invoiceItemSchema` mewajibkan `variantId` (`invoice-schema.ts:44`) dan `createInvoice` tanpa syarat memanggil `alokasiFefoKeluar` (`invoice-actions.ts:392`); stok kurang → seluruh invoice dibatalkan | Usaha jasa (travel, laundry, pendidikan, kontraktor, klinik) tidak bisa menagih apa pun kecuali membuat batch stok palsu | **Selesai — Tahap 1** |
| 13 | **Preset usaha jasa buntu** — `TRAVEL_UMROH:62`, `JASA_ORDER:75`, `EDUCATION:116` hanya memberi `enabledModules: ["BILLING"]`, padahal pembuatan produk & varian digerbangi modul INVENTORY | Tenant yang mendaftar sebagai usaha jasa tidak bisa membuat satu pun item yang bisa ditagih; `seed-demo.ts:132` harus menyalakan INVENTORY manual untuk tenant travel | **Selesai — Tahap 1** |
| 14 | **Tidak ada harga pokok (HPP)** — `ProductVariant` hanya punya `price`; pembelian stok dicatat sebagai `Expense` kategori `PURCHASE`, dan agregat pengeluaran di `dashboard-summary.ts` menjumlahkan **semua** kategori tanpa filter | Laba kotor mustahil dihitung, dan membeli stok tampak seperti kerugian — bukan hanya pada kartu "Arus Kas", tetapi juga pada **laba bersih dan dasar zakat penghasilan** | **Selesai — fase X (PRD 4.G)**: `costPrice` di batch, `unitCost` di movement OUT, entitas `Supplier`, laba = pendapatan − beban usaha − HPP |
| 15 | **Tidak ada preset yang menyalakan ACCOUNTING** | Tenant baru tidak dapat mencatat pengeluaran; kartu arus kas dan estimasi zakat selalu 0 | **Selesai — Tahap 1** (+ migrasi data) |
| 16 | **`tenant.categories` ditulis saat registrasi tetapi tidak pernah dibaca** | Kategori preset (mis. "Paket Umrah", "Laundry") tidak muncul di mana pun — preset kategori masih data mati | Belum — butuh kolom kategori di produk |
| 17 | **Tidak ada impor/ekspor CSV sama sekali** (nol kode, nol dependensi) | Onboarding berarti mengetik ratusan SKU manual, dan tenant sulit menarik datanya keluar | Belum — Tahap 4 |

Urutan pengerjaan yang disetujui pemilik produk: **Tahap 1** (barang vs jasa,
preset, navigasi adaptif) → **Tahap 2** HPP & pemasok *(selesai 2026-09-24,
belum dideploy)* → **Tahap 3** pembayaran
bertahap → **Tahap 4** impor/ekspor CSV & Laba/Rugi → baru memutuskan POS.

---

## 5. Penyimpangan yang sudah diterima (tercatat, bukan bug)

- `src/proxy.ts` menggantikan `src/middleware.ts` (penamaan Next.js 16).
- Token `--primary-solid` (#078360) menggantikan `--primary` untuk latar/teks merek,
  karena `#059669` hanya 3.77:1 di atas putih dan gagal WCAG AA.
- Identitas tenant ditempatkan di footer sidebar, bukan Topbar.
- Modul yang belum aktif **tetap bisa diklik** (halamannya menjelaskan cara
  mengaktifkan), bukan baris mati.
- Landing page saat ini berupa HTML statis mandiri di `src/landing/index.html`
  yang dibaca `src/app/route.ts` — **di luar sistem desain aplikasi**. Ini
  penyimpangan yang perlu ditinjau ulang agar bahasa visualnya tidak terbelah.

---

## 6. Riwayat pengerjaan

Setiap entri sudah melewati gerbang wajib (§1 butir 4):
`npx tsc --noEmit` + `npm run lint` + `npm run build` hijau, kecuali dicatat lain.

### Sudah selesai

| Fase | Pekerjaan | Bukti |
|---|---|---|
| A | Memperbaiki 3 file yang membuat repo tidak bisa di-compile: `(tenant)/layout.tsx` (dua `export default`), `api/chat/route.ts` (API `ai` v3/v4 dipakai di v7), `ai-assistant-chat.tsx` (impor `ai/react` & `ui/scroll-area`). | build hijau; `/api/chat` kembali muncul di daftar rute |
| A2 | Asisten AI dipasang di shell tenant dengan gating PRO (PRD 4.E): gembok + ajakan upgrade untuk FREE, panel streaming untuk PRO. Tanpa menambah dependensi klien. | build hijau |
| B | PRD dipindahkan ke dalam repo + dokumen ini dibuat. | Saat dipindahkan: `TARADINMU-PRD.md` 17.426 byte (hash SHA-256 identik dengan berkas asli). **Sudah berubah sejak itu** — lihat baris "PRD diselaraskan" di bawah |
| PRD | PRD diselaraskan dengan keputusan pemilik produk: kata **"Kasir"** dihapus dari Bagian 4.D (K8), Bagian 4.D.3 dicatat bahwa periode zakat kini tersimpan & laporan bisa dicetak, dan batas zakat FREE ditegaskan sebagai kalkulator manual pada tab "Zakat Perniagaan". | `TARADINMU-PRD.md` kini **17.794 byte**. Hash memang **tidak lagi** sama dengan berkas asli — ini perubahan yang disengaja, bukan drift |
| C | Baseline `prisma/migrations/` tanpa reset DB, supaya `db push` tidak lagi jadi satu-satunya jalur. | `0_init` ditandai applied; `migrate status` = *up to date*; `migrate diff` = tidak ada drift |
| D | Selaraskan `businessType` + preset dengan PRD 4.C; migrasi data tenant lama; satukan aturan gating batch. | 8 preset tervalidasi; `berkah-haramain` SERVICE→TRAVEL_UMROH; `migrate status` bersih; tsc/lint/build hijau |
| E | **User Management** (lubang Fase 1): halaman `/dashboard/settings/users`, 4 Server Action (`getUsers`, `createUser`, `updateUser`, `deleteUser`), skema Zod, batas paket `USERS` (FREE 1 / PRO tanpa batas), menu sidebar khusus OWNER/ADMIN. Proteksi: batas tenant ditegakkan di klausa query, tidak bisa menghapus/menurunkan diri sendiri, akun OWNER/SUPER_ADMIN tidak bisa disentuh dari daftar. | tsc/lint/build hijau; ketiga tenant demo mengembalikan 200 dan daftar pengguna ter-render; gating kuota diverifikasi di kode (`bolehTambah ? UserFormDialog : UpgradeModal`) |
| G | **Arus kas di Dashboard Owner** (PRD Fase 1 "Ringkasan Kas"): `arusKasBulanIni` = pendapatan diterima − pengeluaran, ditampilkan sebagai kartu metrik ke-5. | tsc/lint/build hijau; kedua tenant demo mengembalikan 200 dengan kartu "Arus Kas Bulan Ini" ter-render |
| Audit | Audit ulang **seluruh** klaim dokumen ini terhadap kode (2026-09-23): 6 klaim dikoreksi (migrasi sudah ada, kalkulator zakat manual ternyata ada, role `KASIR` tidak ada di enum → K8, sandi OWNER tercatat di `.env`, `toko-demo` tanpa ACCOUNTING, `preview/` 10 berkas HTML). | `tsc --noEmit` + `lint` + `build` dijalankan ulang **hijau** (`BUILD_ID` baru, `/api/chat` terdaftar); 8 preset & 8 nilai `BusinessType` dihitung ulang; `prisma/migrations/` = 3 entri; 0 pemakaian tipe `any`; 20 berkas dengan tak lebih dari satu `export default` |
| H | **Batas invoice FREE per bulan** (K5): helper bersama `src/lib/periode.ts` (sekaligus menghapus perhitungan `awalBulan` yang disalin di 3 berkas); `feature-guards.ts` menyaring bulan berjalan; index `Invoice(tenantId, createdAt)`; halaman billing menampilkan sisa kuota dan mengganti form dengan ajakan upgrade saat penuh. | tsc/lint/build hijau; migrasi `tambah_index_invoice_periode` (status bersih, tanpa drift); helper periode ditutup 40 tes |
| F | **Impersonate** (PRD 4.B): augmentasi tipe sesi & JWT, `masukSebagaiTenant`/`keluarDariImpersonasi` lewat `unstable_update`, banner + tombol keluar di `(tenant)/layout.tsx`, tombol masuk di `/admin`, dan pengecualian pengalihan subdomain saat mode ini aktif (subdomain tidak resolve di dev). | tsc/lint/build hijau; **diuji lewat HTTP**: JWT SUPER_ADMIN berhasil ditulis ulang, banner muncul, keluar mengembalikan `tenantId: null` |
| I | **Zakat periode + Cetak Laporan** (P2 #9): `periodMonth`/`periodYear` pada `ZakatCalculation` + backfill, riwayat dikelompokkan per periode, komponen `zakat-report.tsx`, tombol cetak, dan blok `@media print` pertama di repo (`.cetak-sembunyi`/`.cetak-laporan`). | tsc/lint/build hijau; diuji lewat HTTP: label periode ter-render, dan laporan tenant FREE **tidak** memuat bagian zakat otomatis |
| K | **Pengerasan produksi** (P4): rate limit berbasis tabel `RateLimit` (login per email & per IP di `authorize()`, `/api/chat` per pengguna), reset password `/lupa-sandi` + `/reset-sandi` dengan token di-hash sekali pakai, adapter email `src/lib/email.ts`, dan `npm run test` (Node test runner lewat `tsx`, 40 tes, tanpa dependensi baru). | tsc/lint/build hijau; 40 tes lulus; **rate limit diuji lewat HTTP dengan menembak `/api/auth/callback/credentials` langsung** — sandi yang benar pun ditolak setelah kuota habis; alur reset diuji ujung ke ujung terhadap database (token sekali pakai, token palsu ditolak, email tak terdaftar dijawab netral) |
| Tahap 1 | **Membuka jalan usaha jasa** (P5 #12, #13, #15): `enum ItemKind` + `Product.kind`, invoice melewati potong stok untuk item jasa, preset memberi INVENTORY+ACCOUNTING ke semua jenis usaha (+ `defaultItemKind`), navigasi adaptif (menu stok disembunyikan bila tenant tidak punya item barang), dan migrasi data untuk tenant lama. | tsc/lint/**47 tes**/build hijau; 2 migrasi bersih tanpa drift; **diuji lewat Server Action sungguhan**: invoice item JASA berhasil tanpa stok (`INV-...-0006`, nol `StockMovement`), invoice BARANG tetap memotong stok (3→1) dan tetap ditolak saat stok kurang; menu stok hilang pada tenant jasa, tetap ada pada tenant barang |
| Q | **Tes isolasi tenant** (risiko terbesar yang belum dijaga): aturan izin dipindahkan dari `tenant-access.ts` ke berkas murni baru `src/lib/tenant-rules.ts` (`nilaiAksesTenant`), sehingga halaman (`requireTenantX`) dan Server Action (`assertTenantX`) kini memakai **satu** aturan yang sama — sebelumnya aturan yang sama ditulis dua kali dan bisa menyimpang. Ditambah dua lapis tes: `tenant-rules.test.ts` (matriks role × tenant) dan `server-action-guards.test.ts` (memindai berkas dari disk, memastikan setiap fungsi yang diekspor dari `*-actions.ts` memanggil gerbang, dengan daftar pengecualian publik yang beralasan). | tsc/lint/**67 tes**/build hijau; **tes dibuktikan bisa gagal lewat dua mutasi**: membalik `user.tenantId !== tenantId` menjadi `===` memerahkan 7 tes, dan menghapus satu baris `aksesTenant()` dari `getProducts()` memerahkan tes struktur dengan menyebut `product-actions -> getProducts()` |
| R | **Pencatatan error + pagar error** (P4): `src/lib/log.ts` (satu baris JSON ke stdout, tanpa dependensi baru) dipasang di dalam `pesanErrorUmum()` sehingga 44 catch block tercakup sekaligus; `pesanValidasi`/`isUniqueConstraintError`/`isRecordNotFoundError`/`pesanErrorUmum` yang selama ini dityalin secara lokal di `tenant-actions.ts` dihapus dan diganti impor dari `src/lib/action.ts` — akibat duplikasi itu, aksi Super Admin justru satu-satunya yang tidak tercatat. Ditambah `src/app/error.tsx` + `src/app/global-error.tsx`; sebelumnya **nol** pagar error di seluruh aplikasi. `global-error` memakai gaya inline karena tidak ikut memuat `globals.css`, dan memakai `retry` bukan `reset` (`retry` baru stabil di Next.js 16.3.0). | tsc/lint/**85 tes**/build hijau; **diuji terhadap server produksi sungguhan** (`next start -p 3100` + rute sementara yang melempar error): balasan 500, teks error mentah **tidak** bocor ke HTML, `digest` terkirim untuk korelasi. **Penyamaran nilai rahasia diuji 18 tes, dan tes itu menemukan dua bug pada versi pertama:** `Authorization: Bearer <token>` hanya menyamarkan kata "Bearer" sehingga tokennya tetap lolos, dan "sandi" tanpa pemisah `:`/`=` tidak ikut tersamar. Rute sementara sudah dihapus. |
| S | **Pemulihan akun oleh Super Admin** (§4 P0 / PRD 4.B): `resetKataSandiAkun()` di `user-actions.ts` — satu-satunya jalur yang boleh menyentuh akun OWNER dan SUPER_ADMIN, dijaga `assertSuperAdmin()`, target dipilih lewat email, token reset target yang masih hidup ikut dicabut, kejadiannya dicatat `catatPeringatan()` (dua field baru `aktorId`/`targetId` di `KonteksLog`). UI: dialog di bilah alat daftar tenant `/admin`. Prefix & hash token reset dipindah ke `src/modules/core/auth/reset-token.ts` karena kini dipakai dua pihak (yang memasang dan yang mencabut). | tsc/lint/**97 tes**/build hijau; **diuji lewat HTTP sungguhan** dengan rute sementara (sudah dihapus): dengan sesi SUPER_ADMIN sandi OWNER benar-benar berganti (cocok `bcrypt.compare`), sandi lama ditolak, tautan reset lama hilang, email tak dikenal dan konfirmasi beda sama-sama ditolak; tanpa sesi rute menjawab 403. **Tes struktur dibuktikan bisa gagal:** menghapus baris `assertSuperAdmin()` memerahkan `server-action-guards.test.ts` dengan menyebut `user-actions.ts -> resetKataSandiAkun()`. Baris log hasil uji diperiksa tidak memuat kata sandi. |

| T | **Diperbaiki lewat pemeriksaan browser** (temuan yang tidak terlihat dari tes): (1) sidebar menyalakan dua menu sekaligus — `Pengaturan Toko` dan `Produk & Layanan` adalah induk dari baris lain tetapi tidak diberi `exact`, sehingga `itemAktif()` ikut cocok lewat `startsWith`; (2) login tanpa `?callbackUrl` mendarat di `/` yang merupakan halaman pemasaran, bukan dashboard pengguna — aturan rumah per peran kini hidup di fungsi murni `rumahSetelahMasuk()` di `tenant-rules.ts`, dibaca `loginAction` dan halaman `/login` lewat `rumahUntukEmail()` yang sama, dan selaras dengan alur daftar yang sejak awal mengirim ke `/${slug}/dashboard`; (3) nama tenant panjang benar-benar terpotong di footer sidebar (terukur 371px isi dalam 180px ruang) — ditambah `title` supaya nilai lengkapnya tetap terjangkau. | tsc/lint/**102 tes**/build hijau; **ketiganya diverifikasi di Chrome**, bukan hanya dibaca dari kode: login sebagai OWNER menghasilkan alamat `/berkah-haramain/dashboard` dan sebagai SUPER_ADMIN `/admin` (sebelumnya dua-duanya mendarat di `/`); di `/settings/users` hanya "Pengguna" yang membawa `aria-current="page"`, di `/inventory/stock` hanya "Stok"; `title` terpasang pada baris nama tenant. Mutasi pada cabang `SUPER_ADMIN` di `rumahSetelahMasuk()` memerahkan 2 tes. |

| U | **Modul Program** (PRD 4.F — menjawab P3 travel/kontraktor/pendidikan dengan **satu** mesin, bukan tiga modul vertikal): model `Program` + `ProgramParticipant`, migrasi tulisan tangan `20260924060000_tambah_modul_program`, `programId` nullable pada `Invoice`/`Expense`. **Tanpa ledger kedua** — Terkumpul dihitung dari `Invoice` PAID, Terpakai dari `Expense`, jadi menghapus program hanya melepas label dan uangnya tetap utuh. Peserta menaut `Customer` yang sudah ada (dilarang membuat model Jamaah/Siswa/Klien sendiri), label per industri diambil dari `businessType` saat render (Kloter/Proyek/Tahun Ajaran/Pesanan/Acara), transisi status dijaga di `utils.ts`, gerbang PRO ditegakkan di server lewat `ambilBatasFitur(plan, "PROGRAM")` dengan `code: "UPGRADE_REQUIRED"`; tulis khusus OWNER/ADMIN, STAFF baca saja. Halaman `/dashboard/program` + `/dashboard/program/[programId]`, menu sidebar bergembok untuk FREE. | tsc/lint/**128 tes**/build hijau; migrasi + `migrate status` bersih tanpa drift; **dijalankan ujung ke ujung di Chrome pada tenant buang (sudah dihapus)**: buat → peserta (tambah/keluar/cari) → taut invoice & pengeluaran → angka ringkasan dicocokkan dengan query mentah → transisi status (jalan ilegal tidak ditawarkan) → ubah → hapus. Penghapusan dibuktikan aman: 3 invoice Rp 5.000.000 dan pengeluaran Rp 750.000 **bertahan** dengan `programId=NULL`. Kedua cabang gembok terverbatim di layar (MODUL pada tenant FREE nyata, PAKET setelah plan dibalik), dan STAFF tidak merender satu pun kontrol tulis. **Dua cacat ditemukan oleh pemeriksaan browser ini, bukan oleh tes:** (1) tanggal disimpan sebagai tengah malam *lokal* sehingga "1 Jan 2027" tersimpan & tampil "31 Des 2026" pada zona UTC+7 — kini memakai `parseTanggalInput()` (tengah malam UTC) seperti invoice/pengeluaran, dan pemetaannya dipindah ke `program/utils.ts` agar tertutup tes (mutasi −5 jam memerahkan 2 tes); (2) teks petunjuk uang memakai label peserta alih-alih label program ("…menaut jamaah ini"), diperbaiki lewat prop `sebutanProgram` |

| V | **Menu "Invoice" menunjuk rute yang tidak pernah ada** (dilaporkan pemilik produk: "fitur invoice error di server"): sidebar shell tenant memakai `${basePath}/dashboard/billing/invoices`, padahal daftar invoice memang tinggal di `/dashboard/billing` — jadi tautan itu 404 sejak commit `831add9` dan tidak ada satu pun jalan masuk ke halaman Invoice lewat menu. Diperbaiki dengan mengarahkan barisnya ke `/dashboard/billing` + `exact: true` (induk dari `/billing/customers`, tanpa exact dua menu menyala — aturan yang sudah dilanggar dua kali sebelumnya). Ditambah `src/lib/nav-hrefs.test.ts`: memindai `app/(tenant)/layout.tsx` dari disk dan memastikan (a) tiap href menu punya `page.tsx` sungguhan, (b) href induk selalu `exact`. | tsc/lint/**132 tes**/build hijau; **dibuktikan bisa gagal**: mengembalikan href lama memerahkan tes dengan menyebut `/dashboard/billing/invoices` dan mencantumkan daftar halaman yang benar-benar ada. Versi pertama tes ini sendiri lolos dari jebakan: regex `{[^{}]*}` tidak cocok karena `${basePath}` mengandung kurung akar — **0 tautan terbaca dan tes akan "hijau" tanpa memeriksa apa pun**, sehingga ada penangkal `length >= 10` yang justru menangkapnya |

| W | **Remah "Keuangan" juga tautan mati** (temuan kedua dari menyisir log produksi dengan cara yang sama): `breadcrumbs.tsx` merakit href dari **tiap awalan segmen URL** dan hanya membuang remah yang tidak ada di `SEGMEN_LABEL`. Folder `keuangan` hanyalah pengelompok di URL (`/dashboard/keuangan/pengeluaran`) tanpa `page.tsx` sendiri, tetapi berlabel — jadi "Dashboard › Keuangan › Pengeluaran" menaut `/dashboard/keuangan` yang 404. Teramati 2 permintaan nyata dari tenant `bang-arsyad-nangka`. Diperbaiki dengan mencabut label `keuangan` (dan `invoices` yang sudah menjadi bangkai config sejak fase V) dari `SEGMEN_LABEL`; remahnya hilang, jalurnya tetap "Dashboard › Pengeluaran". | tsc/lint/**132 tes**/build hijau; invarian baru di `nav-hrefs.test.ts` menegakkan aturannya untuk seluruh rute: *setiap segmen penengah yang berlabel wajib punya halaman sendiri* — **dibuktikan dengan mutasi**: mengembalikan `keuangan: "Keuangan"` memerahkan tes dengan menyebut `/dashboard/keuangan (label "keuangan")`. Audit menyeluruh terhadap ±45 target tautan/redirect internal (landing HTML mentah, bottom-nav, kartu dashboard, admin, auth, URL di email reset, aset manifest PWA) tidak menemukan tautan mati lain |

| X | **HPP & pemasok** (PRD 4.G — menutup cacat uang yang belum pernah dicatat sebagai lubang): satu agregat `expense` tanpa penyaring kategori dipakai sebagai "laba" di dashboard **dan** sebagai dasar zakat penghasilan, jadi setiap rupiah pembelian stok (`PURCHASE`) dua kali menurunkan laba — padahal PRD 4.D.2 sejak awal menulis "Laba Rugi **Operasional**". Yang dibangun: (1) `src/lib/laba.ts` memilah beban usaha vs pembelian stok, `src/lib/hpp.ts` + `src/lib/hpp-query.ts` menghitung HPP dari `StockMovement.unitCost`, `src/lib/stock-allocation.ts` menyimpan potret modal saat FEFO memotong (keputusan pemilihannya dipecah jadi `rencanaAlokasiFefo()` murni agar bisa diuji tanpa DB); (2) entitas `Supplier` sungguhan + `InventoryBatch.costPrice`/`supplierId` + `StockMovement.unitCost` lewat migrasi tulisan tangan `20260924120000_tambah_hpp_dan_pemasok` (`onDelete: SetNull`, menghapus pemasok tidak menghapus batch); (3) halaman `/dashboard/inventory/suppliers` (daftar + form + hapus, tulis khusus OWNER/ADMIN lewat pembungkus baru `aksesTenantTulis()`), kolom modal/pemasok di Stok Masuk & dialog batch; (4) kartu **Laba Bersih** (semua paket — ini koreksi angka) dan **Margin Kotor** (PRO, `LockedFeature`), baris HPP + laba kotor di dialog detail invoice yang angkanya **tidak dikirim** pada paket FREE (`checkLimit(tenantId, "HPP")` di `getInvoiceDetail`); (5) pembatalan invoice DRAFT otomatis membalikkan HPP karena `#BATAL` dikecualikan dari perhitungan. | tsc/lint/**177 tes**/build hijau; 45 tes baru (`laba` 13, `hpp` 22, `stock-allocation` 9, matriks paket +1 — sebelumnya jalur FEFO ini **nol** tes padahal ia memotong uang); `migrate status` bersih + `migrate diff` menghasilkan "empty migration"; `nav-hrefs.test.ts` menjaga menu Pemasok baru (href punya halaman, induk tetap `exact`), `server-action-guards.test.ts` mencatat `aksesTenantTulis()` sebagai gerbang lokal. **Satu jebakan ditemukan sendiri:** menyaring `#BATAL` lewat Prisma `not: { endsWith }` akan ikut membuang `reference: null` (stok keluar manual) sehingga HPP tampak lebih kecil — penyaringan itu kini fungsi murni ber-tes. **Diverifikasi di browser** (build produksi `next start`, tenant uji khusus yang dihapus lagi): CRUD pemasok, Stok Masuk 20 unit @ Rp 60.000 (pemasok tersimpan di batch), invoice 5 unit memotong stok dan menulis `unitCost` 60.000 pada movement OUT, dialog batch menampilkan kolom Modal/unit + Pemasok, dashboard menunjukkan HPP Rp 300.000 / laba Rp 75.000 / zakat 2,5% × Rp 75.000, kartu Margin terkunci di FREE dan terbuka di PRO, dialog detail invoice **tidak** mengirim angka HPP pada FREE. **Verifikasi ini menemukan bug yang lolos keempat gerbang:** HPP periode dihitung dari `movement.createdAt` sedangkan pendapatan dihitung dari invoice PAID — satu invoice draft langsung menjadi rugi phantom sebesar seluruh modalnya (dashboard menunjukkan "Laba Bersih −Rp 300.000" sementara "Total Pendapatan Rp 0"). Perbaikannya: `hppPeriode()` → `hppInvoiceLunas()` (saring `reference` lewat nomor invoice lunas; stok keluar manual tanpa dokumen keluar dari HPP, dicatat di PRD 4.G.3 dan tetap tercatat di sisa Tahap 2), + 3 tes penjaga basis (`hpp.test.ts`) yang membaca sumber `hpp-query.ts`/`dashboard-summary.ts`/`zakat-actions.ts` dari disk agar aturan tidak bisa kembali diam-diam |

Konflik gating batch (K7) juga diselesaikan di fase D: `isBatchTrackingEnabled()` kini hanya menerima `plan` dan mendelegasikan ke `plan-limits.ts`, sehingga tidak ada lagi dua aturan yang bertabrakan.

### Belum dikerjakan (urutan yang disarankan)

| Fase | Pekerjaan | Catatan penting |
|---|---|---|
| Tahap 3 | **Pembayaran bertahap** (P2 #6) | Model pembayaran (DP/cicilan/termin) + pengakuan pendapatan per pembayaran; menyentuh `updateInvoiceStatus` dan `dashboard-summary.ts`. Juga membuka kebutuhan kontraktor |
| Sisa Tahap 2 | **Yang sengaja ditinggal** (PRD 4.G.6) | Valuasi stok otomatis untuk zakat perniagaan (`costPrice` sudah membuka jalannya); perbaikan massal harga modal batch lama (obyeknya impor stok Tahap 4); laporan Laba/Rugi penuh per periode (bukan hanya kartu dashboard) |
| Tahap 4 | **Impor & ekspor CSV, lalu Laba/Rugi sederhana** (P5 #17) | Impor produk/pelanggan/piutang awal/stok awal adalah penentu adopsi; Laba/Rugi bergantung Tahap 2 |
| J | Fitur PRO: **cicilan/bertahap**, **multi-gudang**, **favicon kustom** | Cicilan menyatu dengan Tahap 3. Multi-gudang greenfield (`Warehouse` + `warehouseId` di `InventoryBatch`, `alokasiFefoKeluar`, 4 query baca, 3 tabel, 2 form). Favicon jauh lebih kecil |
| Kategori | **Kategori produk dari preset** (P5 #16) | Butuh kolom kategori di produk; `tenant.categories` sudah terisi tetapi belum dipakai |
| L | **Pemilih periode zakat** di UI | Fase I baru menyimpan & mengelompokkan periode; memilih periode lain untuk dicetak belum ada |
| M | **Asisten AI tersambung ke data tenant** (PRD 4.E) | Perlu tools/RAG *read-only* + konfirmasi untuk aksi tulis |
| N | **Verifikasi email** | Reset password sudah ada; verifikasi email belum |
| Sandi | **Ganti kata sandi untuk pengguna yang sudah masuk** | Sampai hari ini tidak ada caranya: `updateUser` melarang menyentuh baris OWNER milik sendiri, jadi pemilik tenant FREE tidak pernah bisa mengganti sandinya secara sukarela. Fase S hanya menutup kasus *lupa* sandi. Kecil: satu form + satu action berpemanggil-sama (`getSessionUser()`, wajib cocokkan sandi lama) |
| O | Error tracking / logging terpusat; pertimbangkan limiter berbasis Redis bila trafik naik | Limiter sekarang berbasis database — cukup untuk skala kini, tetapi menambah satu query per percobaan login |
| POS | Keputusan produk tersendiri untuk RETAIL_FNB | POS sungguhan butuh offline, barcode, printer struk, laci uang — praktisnya produk kedua. Jangan dibangun setengah jalan |

---

## 7. Cara melanjutkan (catatan untuk sesi berikutnya)

### Lingkungan

- **Database**: PostgreSQL lokal Prisma dev di `localhost:51214`. Bila mati, jalankan
  `npx prisma dev` (port-nya sama seperti di `.env`, jadi tidak perlu diubah).
- **Akun**: `superadmin@taradinmu.id` / sandi ada di `.env` (`SUPER_ADMIN_PASSWORD`).
  SUPER_ADMIN bisa membuka `/admin` **dan** dashboard tenant mana pun.
  Akun OWNER demo juga dibaca dari `.env` (`OWNER_EMAIL` + `OWNER_PASSWORD`,
  keduanya terisi — `[dikoreksi]`, sebelumnya diklaim tidak tercatat).
- **Tenant demo**: `toko-demo` (FREE, `seed.ts` mengisi
  `enabledModules: ["INVENTORY", "BILLING"]` — **tanpa ACCOUNTING**, jadi halaman
  Keuangan/Zakat tenant ini terkunci; `[dikoreksi]`),
  `berkah-haramain` (PRO, TRAVEL_UMROH), `toko-berkah` (FREE, RETAIL_FNB).
- **Seeder**: `npm run db:seed` (akun dasar) dan `npm run db:seed:demo` (data demo).
- **Produksi**: EC2 Ubuntu (`ssh taradinmu-ec2`), proyek di `/var/www/taradinmu`,
  dijalankan PM2 (`npm start`, port 3000 di balik nginx), database PostgreSQL 14
  **di server yang sama** (`localhost:5432`) — **bukan RDS**. Backup `pg_dump` ke
  `~/backup-taradinmu/` sebelum tiap migrasi. Prosedur deploy lengkap (termasuk
  alasan "build dulu, baru stop") ada di [`DEPLOYMENT.md`](./DEPLOYMENT.md) §0.
  Catatan: `RESEND_API_KEY` belum diisi di server, jadi fitur lupa kata sandi
  menolak dengan pesan jelas sampai diisi. Sejak fase S ada jalur kedua: Super Admin
  bisa mereset kata sandi akun mana pun dari `/admin`.

### Perintah verifikasi

```bash
npx tsc --noEmit        # tipe
npm run lint            # eslint
npm run test            # 177 tes logika murni (Node test runner lewat tsx)
npm run build           # wajib: sekaligus meregenerasi tipe rute baru
npx prisma migrate status
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```

Catatan: `npx tsc` sendirian bisa gagal pada rute yang baru dibuat karena
`.next/types` masih basi — jalankan `npm run build` lebih dulu.

### Membuat migrasi di repo ini (penting)

`npx prisma migrate dev` **gagal** di sini: ia memakai *shadow database*, dan
baseline `0_init` dibuat lewat `migrate resolve` (bukan run sungguhan) sehingga
tidak idempoten — hasilnya `ERROR: type "Role" already exists`. Jangan
menghabiskan waktu memperbaikinya; ikuti cara yang sudah dipakai fase C/H/I/K:

```bash
# 1. ubah prisma/schema.prisma, lalu tulis SQL-nya sendiri:
#    prisma/migrations/<YYYYMMDDHHMMSS>_<nama_snake_case>/migration.sql
#    (beri komentar bahasa Indonesia + langkah bernomor, seperti migrasi lain)
npx prisma db execute --file prisma/migrations/<folder>/migration.sql
npx prisma migrate resolve --applied <nama_folder>
npx prisma generate
# 2. pastikan bersih:
npx prisma migrate status          # "Database schema is up to date!"
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```

### Menguji halaman yang butuh login

Server produksi lalu login lewat curl/PowerShell:

```powershell
npm run start -- -p 3100
# 1. GET /api/auth/csrf   (simpan cookie sesi)
# 2. POST /api/auth/callback/credentials dengan email, password, csrfToken, callbackUrl
#    dan header X-Auth-Return-Redirect: 1
# 3. GET halaman dengan cookie yang sama
```

Sembilan jebakan yang sudah memakan waktu dan sebaiknya dihindari lagi:
1. **Nilai `.env` ditulis dengan tanda kutip**, dan `dotenv` membuangnya sedangkan
   parser buatan sendiri tidak. Baca kredensial dengan membuang kutip di ujung,
   atau login akan selalu gagal (`error=CredentialsSignin`).
2. `Invoke-WebRequest` **mengikuti redirect**, jadi status `200` pada `/admin` bisa
   berarti halaman `/login`. Periksa isi halaman (`Manajemen Tenant`, banner), jangan
   hanya kode status.
3. Bila skrip PowerShell memuat tanda baca non-ASCII, baca dengan
   `Get-Content -Raw -Encoding UTF8` saat menjalankan lewat `Invoke-Expression`;
   tanpa itu teks terbaca sebagai ANSI dan skripnya gagal di-parse.
4. Skrip `tsx` yang memakai `DATABASE_URL` berisi `localhost` bisa kena
   `ECONNREFUSED` di Windows sementara `npx prisma migrate status` biasa saja —
   Node mencoba `::1` lebih dulu, sedangkan `prisma dev` hanya listen di
   `127.0.0.1`. Tulis ulang `@localhost` → `@127.0.0.1` di `process.env`
   **sebelum** modul `@/lib/prisma` diimpor.
5. Server `next start`/`next dev` dari sesi sebelumnya bisa masih hidup dan
   melayani **build lama**. Kalau port-nya sudah dipakai, `npm run start` hanya
   gagal pelan di log. Cek dengan `netstat -ano | grep ":3100"` sebelum percaya
   pada hasil uji.
6. Setelah menghapus rute sementara, `.next/dev/types/validator.ts` masih
   menyebut berkas yang sudah tidak ada dan `npm run build` gagal
   (`TS2307: Cannot find module .../route.js`). Hapus folder `.next/dev`, lalu
   build ulang.
7. **`next dev` mencetak argumen Server Action ke stdout**, jadi sandi plaintext
   ikut masuk log: `ƒ resetKataSandiAkun({"password":"..."})`. Ini berasal dari
   `next/dist/server/dev/log-requests.js` yang hanya dipakai `next-dev-server`,
   jadi `next start` (yang dijalankan PM2) **tidak** melakukannya. Tapi jangan
   pernah menjalankan `next dev` di mesin produksi dan menahan stdout-nya ke
   berkas. `loginAction` kebetulan aman karena menerima `FormData` — tracer
   mencetaknya sebagai `{}`. Aksi baru yang menerima objek biasa akan bocisi
   isinya di log dev; kalau aksinya membawa rahasia, pakai `FormData` atau
   jangan percaya log dev bersih.
8. **`prisma generate` tidak membuat `next dev` yang sedang berjalan mengenal
   kolom baru.** `src/lib/prisma.ts` menyimpan client di `globalThis`, jadi hot
   reload memakai client lama dan query kolom baru gagal dengan
   `PrismaClientValidationError: Unknown field 'unitCost' for select statement
   on model StockMovement` — persis seperti migrasi belum dijalankan. Jangan
   langsung mengubah kode: cek kolom di DB dan client yang ter-generate, lalu
   **restart dev server** (atau pakai `next start` hasil build, seperti yang
   dilakukan verifikasi fase X).
9. **`window.print()` membekukan CDP.** Tombol "Cetak Laporan Zakat"
   (`src/modules/core/components/zakat-tabs.tsx`) memanggil print native; begitu
   dialognya terbuka, setiap perintah chrome-devtools berikutnya
   timeout (`MCP error -32603`) dan menimpa `window.print` setelahnya tidak
   menolong — browser harus ditutup paksa. Untuk UI yang bersentuhan dengan
   pencetakan, verifikasi permukaan lain dulu dan jangan klik tombol cetak.

Tiga hal yang bisa diuji lewat rute sementara seperti ini (pola yang sama dipakai
fase R dan S): memanggil Server Action dengan sesi asli dari cookie, memeriksa
baris log yang dihasilkannya, dan memastikan nilai rahasia tidak ikut tercetak.

Akun demo hasil `npm run db:seed:demo`: `owner@berkah-haramain.id` (PRO) dan
`owner@toko-berkah.id` (FREE), sandi `DemoTaradinMu#2026` (dicetak oleh seeder).

### Berkas sementara yang sengaja ditinggalkan

- `preview/` — snapshot HTML hasil render (dibuat sebelum fase D–G, jadi **basi**).
  Isinya 10 berkas HTML (`[dikoreksi]`, sebelumnya ditulis 9); berguna sebagai
  rujukan visual, bukan keadaan terkini.
- `.opencode/task/ui-redesign/*.log` — log server verifikasi.
- Skrip sementara sudah dibersihkan; `scripts/` hanya berisi `build-brand-assets.mjs`.

### Keputusan yang masih menunggu pemilik produk

Sudah diputuskan (jangan dibuka lagi): **K5** (invoice 50 per bulan), **Kas**
(arus kas, bukan saldo kas), **K8** (kata "Kasir" dihapus dari PRD), dan
**pemulihan akun OWNER** — dipilih jalur reset khusus Super Admin, dibangun di
fase S (§4 P0).

1. **Penyedia email — memblokir peluncuran fitur.** Fitur lupa kata sandi sudah
   jadi dan teruji, tetapi produksi menolak mengirim selama `RESEND_API_KEY`
   kosong (`src/lib/email.ts`). Pilih: Resend via HTTP (tanpa dependensi baru,
   sudah diimplementasikan), atau `nodemailer` + `SMTP_*` (nodemailer adalah peer
   opsional NextAuth) — keduanya hanya menuntut mengganti isi `kirimEmail()`.
2. **K4/K6** — pelaporan (Laba/Rugi sederhana di FREE vs Neraca/Arus Kas di PRO) ditaruh di Fase 2; perlu ditegaskan agar tidak dikerjakan keliru.
3. **Landing page** — saat ini HTML statis mandiri di `src/landing/index.html` dan berada di luar sistem desain aplikasi. Perlu ditinjau ulang agar bahasa visualnya tidak terbelah.
4. **Asisten AI** — gating PRO dan endpoint sudah jalan, tetapi belum tersambung ke data tenant. PRD 4.E meminta akses *read-only* ke data; itu pekerjaan tersendiri (tools/RAG + konfirmasi untuk aksi tulis).
5. **Ambang rate limit** — kini 10 percobaan/15 menit per email, 30/15 menit per IP,
   20 pesan/5 menit untuk Asisten AI, dan 3 permintaan tautan reset/15 menit.
   Semuanya terpusat di `src/lib/rate-limit.ts` bila perlu disetel setelah melihat
   trafik nyata.
6. **Role `ACCOUNTANT` saat ini tidak bisa apa-apa — perlu keputusan.** Ditemukan
   saat menulis tes isolasi tenant (fase Q). Akun Akuntan **bisa dibuat** (tercantum
   di `ASSIGNABLE_ROLES`, `src/modules/core/schemas/user-schema.ts:13`, dan diberi
   label "Akuntan" di UI) dan PRD 4.D memang menjanjikan PRO dapat menambah Akuntan,
   tetapi `ACCOUNTANT` tidak masuk `TENANT_MANAGER_ROLES`, sehingga
   `requireTenantMember()` langsung mengalihkannya ke `/` — akun itu bisa masuk lalu
   tidak bisa membuka apa pun. Pilihannya: (a) masukkan `ACCOUNTANT` ke
   `TENANT_MANAGER_ROLES`, atau (b) jadikan akuntan **hanya baca** (butuh peran baru
   di setiap gerbang tulis), atau (c) hapus dari `ASSIGNABLE_ROLES` bila memang belum
   dipakai. Keadaan sekarang dikunci apa adanya oleh
   `src/lib/tenant-rules.test.ts` supaya tidak berubah diam-diam; ubah keduanya
   bersamaan setelah diputuskan.
7. **Verifikasi email — jadi lebih penting setelah fase S.** Pemulihan akun OWNER
   sudah ada jalurnya (butir di atas), tetapi aksi itu sendiri melewati bukti
   kepemilikan email: yang menjamin identitas penelepon hanyalah kepercayaan kepada
   pemegang akun Super Admin. Dua hal yang masih diterima apa adanya dan perlu
   diputuskan nanti: (a) belum ada verifikasi email saat pendaftaran (fase N), dan
   (b) mengganti kata sandi **tidak** mengakhiri sesi JWT yang sedang aktif, jadi
   reset karena curiga akun dibajak tidak mengusir penyusupnya.
