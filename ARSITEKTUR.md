# ARSITEKTUR — Sistem Akuntansi, POS & Social Finance

Status: aktif · 9 Oktober 2026
PRD terkait: `PRD.md`

---

## 1. PRINSIP YANG MENGIKAT

1. **Ledger adalah sumber kebenaran.** Setelah Fase 1, tidak ada angka yang dihitung dari agregat tabel operasional. Semua lewat journal.
2. **Posting immutable.** `Posting` tidak pernah di-UPDATE atau di-DELETE. Koreksi = reverse entry.
3. **Tidak ada dua sumber kebenaran untuk fakta yang sama.** Kolom yang menduplikasi (mis. HPP di `InvoiceItem` DAN di `StockMovement`) dilarang.
4. **Money = Decimal, bukan float.** Dan precision harus cukup untuk semua mata uang.
5. **Periode tertutup = readonly.** Koreksi masuk lewat reverse, bukan edit.
6. **Satu kosakata gating.** Tidak ada dua tempat yang memutuskan "apakah ini PRO".

---

## 2. KONSTRAIN YANG SUDAH ADA DI REPO (wajib diketahui)

| Fakta | Konsekuensi |
|---|---|
| `model Account` di `schema.prisma` = **tabel OAuth NextAuth** | Chart of Accounts **harus** bernama `LedgerAccount` |
| `ProductVariant.price Decimal(12,2)` dan 13 kolom uang lain | Semua harus `Decimal(18,4)` |
| `plan-limits.ts` punya `ZONA_PAKET_MS = UTC+7` hardcode | Harus pindah ke `Tenant.timezone` |
| `dashboard-summary.ts` menjumlahkan `Expense` tanpa filter | Akan jadi sumber kebenaran ganda setelah Fase 1 |
| Modul existing: `core`, `inventory`, `billing`, `program` | `accounting` dan `pos` adalah modul baru |
| 267 tes / 72 suite | Regression gate |
| 5 tenant PROD di EC2 | Migrasi harus backward-compatible |

---

## 3. MODEL DATA — FASE 1 (GL)

```
                    ┌──────────────────────┐
                    │   LedgerAccount      │
                    │  (Chart of Accounts) │
                    └──────────┬───────────┘
                               │ 1:N
                    ┌──────────▼───────────┐
   sumber dokumen ──►  │   JournalEntry      │  ← append-only
   (Invoice,          │  id, businessDate,  │
    Payment,          │  postedAt, period,  │
    StockMovement,    │  source, refType,   │
    Expense,          │  refId, reversedBy  │
    Manual)           └──────────┬───────────┘
                               │ 1:N
                    ┌──────────▼───────────┐
                    │      Posting         │  ← append-only
                    │  debit, credit,      │    TIDAK BOLEH UPDATE/DELETE
                    │  accountId, currency │    CHECK: debit >= 0 AND credit >= 0
                    └──────────────────────┘
```

### Skema Prisma (target)

```prisma
/// Tipe akun untuk laporan. Enum, bukan string bebas — laporan mengelompokkan
/// dengan stabil hanya kalau tipenya tertutup.
enum AccountType {
  ASSET          // Kas, bank, piutang, persediaan, aset tetap
  LIABILITY      // Hutang usaha, hutang pajak,modal
  EQUITY         // Modal disetor, laba ditahan
  REVENUE        // Penjualan, jasa, pendapatan lain
  EXPENSE        // Beban operasional, HPP
}

enum JournalSource {
  INVOICE        // Faktur penjualan
  PAYMENT        // Pembayaran masuk
  STOCK          // Movement stok IN/OUT
  EXPENSE        // Pengeluaran
  MANUAL         // Jurnal umum
  OPENING        // Saldo awal
  REVERSAL       // Pembalik
  CLOSING        // Penutupan periode
}

enum PeriodStatus { OPEN CLOSED }

model LedgerAccount {
  id         String      @id @default(cuid())
  tenantId   String
  code       String      // "1-1001"
  name       String
  type       AccountType
  currency   String      @default("IDR") @db.Char(3)
  parentId   String?     // hierarki untuk laporan berkelompok
  isActive   Boolean     @default(true)
  isSystem   Boolean     @default(false) // akun yang tidak boleh dihapus
  createdAt  DateTime    @default(now())

  postings   Posting[]
  @@unique([tenantId, code])
  @@index([tenantId, type])
}

model JournalEntry {
  id           String        @id @default(cuid())
  tenantId     String
  businessDate DateTime      // tanggal akuntansi (bukan tanggal dibuat)
  postedAt     DateTime?
  period       String        // "2026-10"
  source       JournalSource
  reference    String?       // nomor invoice / referensi
  refType      String?
  refId        String?
  description  String?
  currency     String        @default("IDR") @db.Char(3)
  /// Jurnal pembalik dari jurnal ini. null = belum dibalik.
  reversedById String?      @unique
  reversedFromId String?
  createdById  String?
  createdAt    DateTime      @default(now())

  postings     Posting[]
  @@index([tenantId, businessDate])
  @@index([tenantId, period])
  @@index([refType, refId])
}

model Posting {
  id            String   @id @default(cuid())
  journalId     String
  journal       JournalEntry @relation(fields: [journalId], references: [id], onDelete: Restrict)
  accountId     String
  account       LedgerAccount @relation(fields: [accountId], references: [id], onDelete: Restrict)
  debit         Decimal  @default(0) @db.Decimal(18, 4)
  credit        Decimal  @default(0) @db.Decimal(18, 4)
  currency      String   @default("IDR") @db.Char(3)
  createdAt     DateTime @default(now())

  @@index([journalId])
  @@index([accountId])
  /// Satu akun muncul satu kali per jurnal — mencegah posting dobel tak sengaja.
  @@unique([journalId, accountId])
}

model AccountingPeriod {
  id        String   @id @default(cuid())
  tenantId  String
  period    String   // "2026-10"
  status    PeriodStatus @default(OPEN)
  closedAt  DateTime?
  closedById String?
  createdAt DateTime @default(now())

  @@unique([tenantId, period])
}
```

### Constraint yang WAJIB ada di level database

Diterapkan lewat SQL trigger atau CHECK, **bukan** hanya validasi aplikasi — karena aplikasi bisa punya bug.

```sql
-- 1. Posting tidak boleh negatif, dan tidak boleh debit DAN kredit sekaligus
ALTER TABLE "Posting" ADD CONSTRAINT "posting_satu_sisi"
  CHECK (NOT (debit > 0 AND credit > 0));

-- 2. Jurnal harus balanced per mata uang, dicek saat COMMIT
CREATE CONSTRAINT TRIGGER "jurnal_seimbang"
AFTER INSERT ON "Posting"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION cekJurnalSeimbang();

-- 3. Posting immutable
REVOKE UPDATE, DELETE ON "Posting" FROM app_user;
```

### Contoh jurnal dari modul yang sudah ada

```
── Invoice PAID Rp 1.100.000 (PPN 12%)
   Dr  Piutang Usaha         1.100.000
   Dr  Piutang Pajak (PPN)    100.000
       Cr  Penjualan                      1.000.000
       Cr  Utang Pajak (PPN)                100.000

── Pembayaran diterima
   Dr  Kas                   1.100.000
       Cr  Piutang Usaha               1.100.000

── Penjualan barang, HPP Rp 600.000 (dari StockMovement OUT)
   Dr  HPP Penjualan           600.000
       Cr  Persediaan                     600.000
```

⚠️ Perhatikan: satu invoice menghasilkan **dua** jurnal (recognisi pendapatan + penerimaan kas). Ini yang membedakannya dari "catatan keuangan".

---

## 4. FASE 0 — PERUBAHAN YANG HARUS TERJADI DULU

### F0.1 — Marker HPP belum tercatat

**Masalah yang diperbaiki** (terbukti lewat data, bukan dugaan): tenant yang stoknya tidak pernah melewati Stok Masuk punya 0 baris `StockMovement` → HPP = 0 → **kartu Laba Bersih terlihat bersih padahal modalnya belum pernah dicatat**. Pada tenant demo: 3 invoice lunas, 0 movement, `costPrice = NULL`.

**Perubahan:**
1. Fungsi murni `src/lib/hpp.ts` → `ringkasanKelengkapanModal()` yang mengembalikan:
   ```ts
   type KelengkapanModal = {
     totalMovement: number;      // berapa movement OUT
     movementTanpaModal: number;  // movement yang unitCost-nya null
     batchTanpaModal: number;     // batch di rak yang costPrice-nya null
     lengkap: boolean;           // movementTanpaModal === 0 && batchTanpaModal === 0
   }
   ```
2. `dashboard-summary.ts` mengembalikan `kelengkapanModal` ke dashboard.
3. `owner-dashboard.tsx`: bila `!lengkap`, kartu Laba Bersih menampilkan **peringatan eksplisit** — bukan diam-diam menampilkan angka yang terlihat utuh.
4. Teks wajib menyebut jalan keluarnya: isi modal lewat Stok Masuk, atau impor CSV (Fase 4).

**Acceptance**: tenant demo yang kondisinya di atas menampilkan peringatan; tenant yang semua batch-nya ada modalnya tidak menampilkan apa-apa.

### F0.2 — Decimal(18,4) + currency

**Kenapa**: `Decimal(12,2)` menyimpan max 10 digit bulat. IDR tidak butuh desimal, USD/Euro butuh 2, kontensi Saudi bisa butuh 3. Posts can accumulate lebih dari max.

**Perubahan:**
1. Migrasi manual: 16 kolom `Decimal(12,2)`/`(14,2)` → `Decimal(18,4)`.
2. `Tenant.currency String @default("IDR") @db.Char(3)` + `Tenant.timezone String @default("Asia/Jakarta")`.
3. `src/lib/money.ts` (baru, murni): `formatUang(nilai, currency)` memakai `Intl.NumberFormat`.
4. Backfill: semua tenant yang ada → `currency = "IDR"`, `timezone = "Asia/Jakarta"`.

**Acceptance**: `prisma migrate status` bersih; `prisma migrate diff` = "empty migration"; angka lama tidak berubah (bukti: cocokkan 3 invoice tenant demo sebelum/sesudah).

### F0.3 — Locale/timezone abstraction

**Perubahan:**
1. `Tenant.timezone` (dari F0.2).
2. `src/lib/zona-waktu.ts` (baru, murni): `hariPenyewa(timezone)`, `akhirHari(timezone, tanggal)`.
3. `plan-limits.ts`: `ZONA_PAKET_MS` dihapus sebagai konstanta; fungsi menerima parameter `timezone` dari pemanggil.
4. Semua `new Date()` untuk perhitungan bisnis diganti fungsi zona.

**Acceptance**: tes zona waktu untuk `Asia/Jakarta`, `Asia/Riyadh` (UTC+3), dan `Europe/London` (DST) hijau.

### F0.4 — Landing page netral

`src/landing/index.html` = 168 KB HTML statis mandiri. Menghapus:
- `<title>`, `<meta description>`, `og:title` — "ekosistem perniagaan islami"
- Kalimat "untuk anggota Serikat Usaha Muhammadiyah (SUMU)"
- Paragraf asal nama "Mu berarti Muhammadiyah"
- Rujukan LAZISMU/BAZNAS sebagai otoritas tunggal
- CTA "Minta demo untuk usaha saya" yang menyebut anggota SUMU

**Yang TETAP ada**: zakat sebagai fitur (itu produk), disclaimer estimasi, disclaimer rujukan otoritas zakat setempat.

---

## 5. STRUKTUR MODUL

```
src/modules/
├── core/           # Tenant, User, Auth, Settings, Super Admin  (existing)
├── inventory/      # Product, Variant, Batch, StockMovement      (existing)
├── billing/        # Customer, Supplier, Invoice, Payment        (existing + Payment)
├── program/        # Program, ProgramParticipant                 (existing)
├── accounting/     # BARU — FASE 1
│   ├── models/     # CoA, Journal, Posting, Period
│   ├── actions/    # Server Actions
│   ├── engine/     # murni: buatJurnal(), postingFromInvoice(), dll
│   ├── reports/    # Neraca, Laba Rugi, Arus Kas, GL, Trial Balance
│   └── components/
├── pos/            # BARU — FASE 5
│   ├── offline/    # IndexedDB, sync queue
│   ├── hardware/   # ESC/POS, barcode scanner, cash drawer
│   └── components/
└── social-finance/ # BARU — FASE 6
    ├── zakat/      # sudah ada di core, dipindah ke sini
    ├── infak/
    └── wakaf/
```

### Aturan import (dari PRD §6, tetap berlaku)

Modul **dilarang** mengimpor UI modul lain. Boleh: Prisma langsung atau `src/lib/`. Semua Server Action wajib lewat gerbang akses tenant yang terpusat.

---

## 6. STRATEGI FISCAL PER NEGARA

```ts
interface FiscalAdapter {
  negara: string                    // "ID" | "SA" | "MY" | "PK"
  mataUang: string
  zonaWaktu: string
  tarifPajak: TaxRate[]
  terbitEInvoice(doc: Invoice): Promise<EInvoiceResult>
  formatLaporan(period: string): ReportBundle
  verifikasiEInvoice(doc: string): VerificationResult
}
```

**Indonesia**: PPN 12% dengan DPP nilai lain (11/12 untuk barang non-mewah). NPWP 16 digit **harus VARCHAR**, bukan integer (memakai nol di depan). NSFP 17 digit diberikan server — jangan di-generate di draft.

**Saudi (ZATCA Phase 2)**: UBL 2.1 XML + cryptographic stamp + UUID + hash chain + QR Base64 + PDF/A-3 + real-time clearance ke FATOORA. Gelombang wajib berdasarkan omzet.

⚠️ beide "zakat" ini berbeda. Yang Saudi adalah e-invoicing/VAT compliance, bukan kalkulasi zakat Islami.

---

## 7. URUTAN PENGERJAAN

```
FASE 0  Fondasi          2-3 minggu   ← SEKARANG
  F0.1 marker HPP
  F0.2 Decimal 18,4 + currency
  F0.3 locale/timezone
  F0.4 landing netral

FASE 1  GL               6-8 minggu   ← BREAKING CHANGE
  LedgerAccount, JournalEntry, Posting, AccountingPeriod
  Constraint DB, template CoA, jurnal otomatis, reverse entry
  Dual-write + migrasi 5 tenant PROD

FASE 2  Reporting        3-4 minggu
  Neraca, Laba Rugi, Arus Kas, GL, Trial Balance
  BUANG agregat dashboard-summary sebagai sumber angka

FASE 3  Bank             2-3 minggu
FASE 4  Fiscal           4-6 minggu
FASE 5  POS              8-12 minggu
FASE 6  Social Finance   2-3 minggu
FASE 7  Global           6-12 bulan
```

Total: 12–18 bulan. Fase 1 yang paling tidak bisa di-shortcut.

---

## 8. KEPUTUSAN YANG WAJIB DITANYAKAN

Sebelum Fase 1 dimulai:
1. Nama produk global? (PRD §9.1)
2. Migrasi 5 tenant PROD — backfill atau manual? (PRD §9.2)
3. Apakah ada funding/tim? 12–18 bulan solo realistis?

Sebelum Fase 4:
4. Payment gateway — Midtrans/Xendit untuk subscription? Kapan?

Sebelum Fase 7:
5. Arabic RTL — Saudi Serious?

---

## 9. REFERENSI TEKNIS

- Double-entry immutable: Stripe Ledger (`stripe.dev/blog/ledger-stripe-system`)
- Append-only + hash chain: TigerBeetle architecture docs
- Pattern fiscal per negara: Odoo l10n_* modules
- ZATCA Phase 2: `zatca.gov.sa/en/E-Invoicing`
- Referensi lokal: `TARADINMU-PRD.md` (v1), `docs/ROADMAP.md`, `docs/DEPLOYMENT.md`
