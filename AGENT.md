# AGENT.md — Aturan Kerja untuk Coding Agent

Dokumen ini mengikat. Kalau bertentangan dengan instruksi percakapan, dokumen ini yang menang.

---

## 0. SEBELUM MENULIS KODE

Baca tiga dokumen ini, tidak boleh dilewat:

1. **`PRD.md`** — fitur apa yang boleh dibangun, fase berapa
2. **`ARSITEKTUR.md`** — model data, aturan arsitektur, urutan
3. **`TARADINMU-PRD.md`** + **`docs/ROADMAP.md`** — keputusan produk yang sudah diambil

**Konteks adalah raja.** Kalau sebuah keputusan tidak ada di dokumen mana pun, itu **keputusan pemilik produk** — jangan mengarang. Tanyakan.

---

## 1. GERBANG WAJIB (tidak bisa dilewat)

Sebelum menyatakan selesai, keempatnya harus hijau:

```bash
npx tsc --noEmit && npm run lint && npm run test && npm run build
```

Kalau satu gagal, itu belum selesai. Tidak ada pengecualian.

---

## 2. ATURAN YANG MELARANG KODE BURUK

### 2.1 Migration — bukan `db push`
Perubahan skema **wajib** disertai migrasi di `prisma/migrations/`.
`prisma db push` hanya untuk eksperimen lokal. Jalur rilis: `npm run db:migrate`.

Verifikasi bersih:
```bash
npm run db:migrate:status   # harus "up to date"
npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --exit-code
```

⚠️ **`prisma dev` adalah emulator berbasis SQLite, bukan PostgreSQL.** Ia
menerjemahkan SQL dan melaporkan "berhasil" untuk apa pun yang bisa
diterjemahkan. Konsekuensinya:

| Yang ingin dibuktikan | Harus dibuktikan di |
|---|---|
| Skema & enum, migrasi jalan | `prisma dev` cukup |
| **PL/pgSQL trigger, CHECK lintas-tabel, deferrable constraint** | **PostgreSQL sungguhan** |

Untuk yang kedua, jalankan container:
```bash
docker run -d --name gl-test -e POSTGRES_PASSWORD=postgres -p 54329:5432 postgres:17-alpine
$env:DATABASE_URL="postgres://postgres:postgres@localhost:54329/gl_test?sslmode=disable"
npx prisma migrate deploy
```
Skrip `scripts/bukti-constraint-gl.ts` memakai ini. Melewati langkah ini berarti
trigger yang "sudah dimigrasi" belum pernah benar-benar dieksekusi sekali pun.

### 2.2 Prisma tidak selalu membuat apa yang ditulis di skema

Self-relation satu arah hanya menghasilkan **satu** kolom FK, bukan dua. Menulis
`reversedById` + `reversedFrom` menghasilkan satu kolom; yang lain tidak pernah
ada, dan trigger yang memakainya gagal saat dijalankan dengan
`record "new" has no field "reversedFromId"`.

Setelah mengubah skema yang sudah dimigrasi: **drop dan buat ulang database uji**,
lalu jalankan ulang seluruh migrasi. `migrate deploy` pada database yang sudah
memegang versi lama migrasi yang sama tidak akan memperbarui kolomnya.

### 2.2 Larangan `any`
`any` **dilarang** di seluruh `src/`. TypeScript strict.

### 2.3 Validasi Zod
Semua input form/API **wajib** divalidasi Zod sebelum menyentuh Prisma.

### 2.4 Isolasi modul
Modul tidak boleh mengimpor UI modul lain. Boleh: Prisma langsung atau `src/lib/`.

```
DILARANG:  import { X } from "@/modules/inventory/components/..."
BOLEH:     import { X } from "@/lib/..."
BOLEH:     import { X } from "@/shared/..."
```

### 2.5 Satu export default per file
Satu file = satu `export default`. `import` hanya di bagian atas.

### 2.6 Gerbang akses
Setiap Server Action wajib memanggil `aksesTenant()` / `assertTenantX()` / `aksesTenantTulis()`. Ada tes struktural yang memindai disk — lewat saja berarti tes merah.

### 2.7 Bahasa
Komentar kode dan penjelasan dalam **Bahasa Indonesia**.

---

## 3. ATURAN KEUANGAN (WAJIB DIPATUHI — INI YANG SERING SALAH)

### 3.1 Tiga angka yang tidak boleh dicampur
| Angka | Rumus |
|---|---|
| **Arus kas** | pendapatan diterima − **seluruh** pengeluaran (termasuk pembelian stok) |
| **Laba usaha** | pendapatan − beban operasional − **HPP barang terjual** |
| **Dasar zakat penghasilan** | **laba usaha** (bukan arus kas) |

Dilarang memakai satu variabel untuk dua purposes. KalauMoney belum dik Scoring HPP, tulis "belum lengkap" — jangan tampilkan angka yang terlihat utuh.

### 3.2 HPP hanya dari `StockMovement OUT`
```ts
// SALAH — menduplikasi fakta yang sama
hpp = InvoiceItem.costPrice * InvoiceItem.quantity

// BENAR
hpp = Σ(StockMovement.unitCost × quantity) WHERE type=OUT, reference=invoiceNumber
```
`.dilarang` menambah kolom harga modal ke `InvoiceItem`. Dua sumber kebenaran angka adalah cara paling pasti menghasilkan laporan yang berbeda sendiri.

### 3.3 Pelexclude pembatalan
Movement yang dibatalkan ditandai `#BATAL` pada `reference`. HPP **wajib** mengecualikannya.

### 3.4 HPP diakui saat invoice DIBayar
Bukan saat barang keluar dari rak. Kalau HPP mengikuti tanggal movement, satu invoice draft tampil sebagai rugi sebesar seluruh modalnya.

### 3.5 Zakat bergantung pembukuan
Tidak boleh menghitung zakat di atas angka yang belum dibukukan. Zakat salah = keputusan 用户 multimiliar salah.

Disclaimer wajib: **hasil estimasi**, rujuk otoritas zakat setempat (LAZISMU/BAZNAS/mufti). Dilarang mengklaim "resmi" tanpa landatan.
### 3.6 Decimal, bukan float
Semua nilai uang `Decimal`. **Jangan pernah** `parseFloat`, `Number()`, atau
operasi aritmetika floating point pada nilai uang.

⚠️ Saat Fase 0 selesai, semua kolom uang menjadi `Decimal(18,4)`. Jangan tulis
`@db.Decimal(12,2)` yang baru.

### 3.7 Aturan GL

Selama modul `accounting` ada (Fase 1+):

- **Jurnal hanya lewat `engine-jurnal.ts`.** Semua aturan pembukuan ditegakkan di
  `racikJurnal()`. Jangan menulis posting langsung dari modul lain — setiap jalur
  yang melakukan validasi sendiri adalah jalur yang bisa berbeda dengan yang lain.
- **Jurnal otomatis hanya lewat `jurnal-otomatis.ts`.** Fungsi-fungsi di sana
  idempoten (kunci `refType` + `refId` + `source`), dan itu yang membuat klik
  ganda tidak membukukan dua kali. Memanggil `simpanJurnal` langsung dari modul
  lain melewati proteksi itu.
- **Angka pada laporan TIDAK boleh dihitung dari agregat `Expense`/`Invoice`
  setelah Fase 1.** Dual-write membuat keduanya hidup berdampingan; begitu
  dashboard pindah ke journal, agregat harus berhenti jadi sumber angka.
- **`Posting` tidak boleh di-UPDATE atau di-DELETE.** Koreksi = jurnal pembalik
  (`jurnalPembalik`), yang secara default membawa tanggal pembatalan — bukan
  tanggal jurnal asli.
- **Satu akun satu kali per jurnal.** Kalau aturan bisnis butuh dua baris untuk
  satu akun, itu dua jurnal, bukan satu jurnal dengan dua baris.
- **Nominal selalu positif; yang menentukan adalah `side`.** Angka negatif
  ditulis sebagai pembalik sisi, bukan sebagai nominal negatif.
- **`subtotal` di engine adalah RUPIAH, bukan unit.** Mengirim `quantity` hanya
  benar kalau harga satuan seragam — dan invoice campuran justru kasus yang paling
  umum. Bug ini sempat masuk dan diperbaiki sebelum dipakai; jangan diulang.

### 3.8 Verifikasi GL

`scripts/bukti-constraint-gl.ts` (constraint database) dan
`scripts/bukti-gl-penuh.ts` (siklus bisnis) dijalankan ulang tiap kali skema GL
berubah. Keduanya perlu PostgreSQL sungguhan:

```bash
docker run -d --name gl-test -e POSTGRES_PASSWORD=postgres -p 54329:5432 postgres:17-alpine
$env:DATABASE_URL="postgres://postgres:postgres@localhost:54329/taradinmu_test?sslmode=disable"
npx prisma migrate deploy
npx tsx scripts/bukti-constraint-gl.ts
npx tsx scripts/bukti-gl-penuh.ts
```

Untuk yang butuh SESI (Server Action yang memanggil `assertTenantMember`), skrip
dari luar selalu ditolak — "berhasil" di sana tidak berarti apa-apa. Boleh
membuat route sementara, tapi harus **dihapus setelah bukti**.
---

## 4. ATURAN GATING FREEMIUM

**"Kunci kemampuan, jangan kunci kebenaran."**

- Angka hasil hitungan dari data tenant sendiri → **tampil semua paket**
- Kemampuan tambahan (batch, multi-gudang, cicilan, laporan lengkap, white-label, program, HPP detail, AI, branding) → **PRO**

### 4.1 Satu kosakata gating
Berkas Officesessive **`**/actions/**`** dan **`app/api/**` DILARANG membandingkan string paket sendiri (`plan === "PRO"`). Wajib lewat `checkLimit()` / `ambilBatasFitur()` / `planEfektif()`.

Ada tes yang menegakkan ini.

### 4.2 Harga dari satu konstanta
`HARGA_PRO_BULAN` di `src/lib/plan-limits.ts`. **Tidak boleh** ada salinan literal di komponen lain. Mengubah harga = satu baris.

### 4.3 Janji harus jujur
Modal upgrade hanya boleh menawarkan fitur yang **ADA**. Lihat tabel status di `TARADINMU-PRD.md` §4.D.2a. Menjual janji yang belum ada lebih mahal daripada satu fitur kurang.

### 4.4 Telemetri tidak boleh menjadi alat municipais
`UpgradeInterest` hanya menerima kunci dari daftar tertutup. Tidak ada teks bebas.

---

## 5. ATURAN PRIVASI & KEAMANAN

### 5.1 Isolasi tenant
Setiap query wajib menyaring `tenantId` **di klausa query**, bukan di aplikasi.

### 5.2 Jangan log nilai rahasia
`src/lib/log.ts` menyamarkan token/sandi. Kalau menambah log baru, ikut aturan penyamaran. Jangan log: password, token, API key, isi `.env`.

### 5.3 Rate limit
Endpoint sensitif (`/login`, `/api/chat`, aksi upgrade) wajib punya limiter.

### 5.4 Jangan throw error mentah ke UI
Server Action return `ActionResponse` — `{ success, message, data?, error?, code? }`.

---

## 6. ATURAN TEST

- **Test dulu atau test bersama**, bukan nanti. Fitur tanpa test dianggap belum selesai.
- Test logika murni di `src/lib/*.test.ts`, pakai Node test runner via `tsx`.
- Test struktural (memindai disk) sudah menjadi pola di repo ini (`server-action-guards.test.ts`, `nav-hrefs.test.ts`, `freemium-honesty.test.ts`).
- **Buktikan test bisa merah.** Ubah/mutasi kodenya, lihat test gagal, kembalikan. Test yang tidak pernah merah tidak membuktikan apa pun.

```bash
npm run test                                  # semua
npx tsx --test src/lib/hpp.test.ts            # satu berkas
```

---

## 7. ATURAN VERIFIKASI

Klaim butuh bukti. "Sudah diperbaiki" tanpa output perintah = belum.

**Pola yang dipakai repo ini dan harus dilanjutkan:**
- `tsc --noEmit` + `lint` + `test` + `build` → simpan output
- Perubahan database → `migrate status` + `migrate diff`
- Perubahan UI → **diuji di browser**, bukan hanya dibaca di kode
- Test struktural → **dibuktikan bisa gagal** lewat mutasi

Yang **tidak** boleh diklaim tanpa bukti nyata: "tested in production", "verified end-to-end", "works offline".

---

## 8. ATURAN KERJA BERSAMA

### 8.1 Satu penulis per file
Dua agen/sesi tidak boleh menulis ke repo yang sama tanpa pembagian kepemilikan file tertulis. Ini pernah menyebabkan file tertimpa diam-diam.

### 8.2 Jangan menyentuh perubahan yang bukan milikmu
Periksa `git status` **sebelum** mulai. Kalau ada perubahan belum ter-commit yang bukan milikmu:
- **tidak boleh di-revert**
- **tidak boleh di-stash**
- **tidak boleh di-commit tanpa izin**
- kalau阻塞(files yang kamu butuh), tanyakan

### 8.3 Jangan commit tanpa diminta
Commit hanya kalau diminta eksplisit.

---

## 9. DEPLOY

Produksi **live dengan tenant nyata** di EC2 (`ssh taradinmu-ec2`).

Sebelum deploy, **wajib baca `DEPLOY.md`**. Urutan: backup → pull → build → migrasi → start → verifikasi. Ada prosedur pemulihan dan larangan mutlak di sana.

Jangan pernah deploy tanpa backup `pg_dump` lebih dulu.

---

## 10. RINGKASAN

```
Baca PRD + ARSITEKTUR dulu
  ↓
Fase sesuai ARSITEKTUR.md §7 — jangan lompat
  ↓
Migrasi, bukan db push
  ↓
Zod validasi, tanpa any, isolasi modul
  ↓
Gerbang akses di setiap Server Action
  ↓
Uang: Decimal, HPP dari StockMovement, 3 angka terpisah
  ↓
Gating: satu kosakata, harga satu konstanta, janji jujur
  ↓
Test bisa merah
  ↓
tsc + lint + test + build hijau
  ↓
Bukti, bukan klaim
```

Detail produk: `PRD.md` · Detail teknis: `ARSITEKTUR.md` · Deploy: `DEPLOY.md`
