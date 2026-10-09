# PRD — Produk Akuntansi, Inventori, POS & Social Finance

**Status**:aktif · disusun 9 Oktober 2026
**Menggantikan arah**: `TARADINMU-PRD.md` (tetap berlaku sebagai PRD v1 untuk kode yang sudah ada; dokumen ini PRD v2 untuk waitress)
**Pengganti nama**: Go — nama produk global belum diputuskan (lihat §9)

---

## 1. VISI

Aplikasi bisnis untuk UMKM dan UKM yang butuh **tiga hal dalam satu sistem**:

1. **Pembukuan yang benar** — double-entry, bisa diaudit, tutup buku per periode.
2. **Operasional harian** — stok, batch, invoice, piutang, POS.
3. **Social finance** — zakat, infak, wakaf, dan laporan dampak sosial.

### Kenapa produk ini ada

Ada tiga kelompok produk di pasar, dan tidak ada satu pun yang menutupi ketiganya:

| Kelompok | Contoh | Double-entry | POS | Social finance |
|---|---|---|---|---|
| Akuntansi Indonesia | Accurate, Jurnal, Zahir | ✅ | ✅ | ❌ |
| Akuntansi global | Xero, QuickBooks, Zoho Books | ✅ | sebagian | ❌ |
| Kasir/POS | Square, Toast | ❌ | ✅ | ❌ |
| **Produk ini** | — | ✅ | ✅ | ✅ |

⚠️ **Perhatian kebingungan yang harus dijaga di semua materi**: "Zakat" dalam ZATCA (Arab Saudi) adalah **nama lembaga pajak**, bukan modul kalkulasi zakat. Keduanya berbeda dan tidak boleh dicampur dalam satu kalimat promosi.

### Prinsip produk

**"Kunci kemampuan, jangan kunci kebenaran."** Angka yang dihitung dari data milik pengguna sendiri selalu tampil di semua paket. Yang dikunci adalah kemampuan tambahan. Alasan: pengguna gratis yang angkanya salah akan pindah aplikasi, bukanimiter upgrade.

---

## 2. TARGET PENGGUNA

Tiga segmen. **Hanya satu yang jadi v1** —，见 `ARSITEKTUR.md` §7.

### Segmen A — UMKM Indonesia *(v1, start di sini)*
- Retail F&B, minimarket, travel, klinik kecil, sekolah, laundry, aqiqah
- 1–50 orang, 1–3 outlet
- Kebutuhan: PPN, e-Faktur, piutang, stok, zakat
- Status: sudah ada produk berjalan. Migrasi.

### Segmen B — Profesional & Korporat Indonesia *(v1.5)*
- 50–500 orang, multi-cabang, butuh audit eksternal
- Kebutuhan: GL lengkap, 200 laporan, budget, approval flow, aset tetap, konsolidasi
- Status: ini yang pakai Accurate. Price sensitivity rendah, churn rendah.

### Segmen C — Global / Gulf / Diaspora *(v3)*
- UMKM di Saudi, Malaysia, Indonesia, Pakistan
- Kebutuhan: ZATCA (KSA), SST (MY), FBR (PK), zakat
- Status: belum masuk. Butuh locale, i18n, kalender Hijriah, multi-currency.

---

## 3. MODUL PRODUK

### Core — selalu ada, semua paket

| # | Modul | Rincian |
|---|---|---|
| C1 | **Tenant & User** | Multi-tenant, 5 role, white-label |
| C2 | **Accounting Core** | Chart of Accounts, Journal (double-entry), Accounting Period |
| C3 | **Inventory** | Product, Variant, Batch, Expired, FEFO, multi-gudang (v2), satuan bertingkat |
| C4 | **Billing** | Customer, Supplier, Invoice, Payment, Piutang |
| C5 | **Reporting** | Neraca, Laba Rugi, Arus Kas, General Ledger, Trial Balance |
| C6 | **Point of Sale** | Offline-first, barcode, ESC/POS, shift/Z-report, multi-outlet, QRIS |
| C7 | **Social Finance** | Zakat, Infak, Wakaf, Laporan Dampak |
| C8 | **Audit & Compliance** | Audit log append-only, closing periode, ekspor |

### Regulatory — plugin per negara

| Negara | Requirement | Fase |
|---|---|---|
| **Indonesia** | PPN 12% (DPP nilai lain 11/12), PPh 21/23/25/26, e-Faktur/Coretax, NPWP 16 digit | v1 |
| **Saudi Arabia** | ZATCA Phase 2: UBL 2.1 XML, cryptographic stamp, UUID + hash chain, QR Base64, PDF/A-3, FATOORA real-time | v3 |
| **Malaysia** | SST, MyInvois (LHDN) | v3 |
| **Pakistan** | FBR, NTN | v4 |
| **Global** | Tanpa tax engine, currency bebas | v1 |

### Tidak dibangun di v1 (sengaja)

Manufaktur penuh (BOM/routing), multi-gudang, e-commerce sync (Shopee/Tokopedia/TikTok), HRIS/payroll penuh, integrasi DJP langsung, 200+ laporan.

---

## 4. FITUR WAJIB PER FASE

### FASE 0 — Fondasi *(sekarang)*

| ID | Fitur | Selesai bila |
|---|---|---|
| F0.1 | Marker HPP belum tercatat | Dashboard menampilkan peringatan bila ada batch tanpa `costPrice` yang dipakai invoice lunas; angka laba ditulis "belum lengkap" |
| F0.2 | `Decimal(18,4)` + currency | Semua kolom uang widened; `Tenant.currency` ada; format angka mengikuti mata uang |
| F0.3 | Locale/timezone abstraction | Tidak ada offset hardcode; `Tenant.timezone` dipakai |
| F0.4 | Landing page netral | Tidak ada Muhammadiyah/SUMU/Lazismu/akronim organisasi |

### FASE 1 — GL *(fondasi, bukan fitur)*

| ID | Fitur |
|---|---|
| F1.1 | `LedgerAccount` (CoA) — kode, nama, tipe, parent, currency, aktif/tidak |
| F1.2 | `JournalEntry` + `Posting` — append-only, tidak ada UPDATE/DELETE |
| F1.3 | Constraint `SUM(debit) = SUM(credit)` per jurnal per currency |
| F1.4 | `AccountingPeriod` — OPEN/CLOSED, larang posting ke periode tertutup |
| F1.5 | Template CoA per negara (9 akun minimal → 40–60 produksi) |
| F1.6 | Jurnal otomatis dari: Invoice, Payment, StockMovement, Expense, Manual |
| F1.7 | Reverse entry (bukan void/delete) |
| F1.8 | Audit log append-only dengan actor + alasan |

⚠️ **Fase 1 adalah breaking change.** Angka dashboard wajib pindah dari agregat `Expense` ke `Journal`. Butuh migrasi data.

### FASE 2 — Reporting

Neraca, Laba Rugi, Arus Kas, General Ledger per akun, Trial Balance, Retained Earnings auto-closing. Semuanya query dari journal.

### FASE 3 — Bank Reconciliation

`BankAccount`, `BankStatement`, `StatementLine`, impor CSV/XLSX, auto-match.

### FASE 4 — Fiscal per negara

`TaxRate` + `TaxRule`, e-invoice adapter interface, Indonesia Coretax, Saudi ZATCA Phase 2.

### FASE 5 — POS

Offline-first + sync, barcode/QR, ESC/POS printer, shift + Z-report, multi-outlet, QRIS + Midtrans/Xendit, Moyasar/PayTabs (Gulf).

### FASE 6 — Social Finance extension

Infak, Wakaf, laporan dampak sosial.

### FASE 7 — Global

Locale, i18n (EN/AR), kalender Hijriah, currency, Saudi/Malaysia launch.

---

## 5. ATURAN BISNIS INTI

### 5.1 Zakat

**Dua mode, dua basis:**

| Mode | Basis | Metode | Kapan |
|---|---|---|---|
| **Perniagaan** (haul) | Aset lancar − hutang lancar | Manual/semi-otomatis | Tombol hitung, biasanya 1×/tahun |
| **Penghasilan** | Laba usaha bulanan | **Otomatis** dari journal | Dashboard, tiap akhir bulan |

**Nisab** = 85 gram emas × harga emas saat itu. Di bawah nisab → status "Belum Wajib".

**Disclaimer wajib**: hasil adalah estimasi. Rujukan: LAZISMU/BAZNAS/mufti setempat. Untuk pasar global, rujukanSetterpret各自的 otoritas. Dilarang mengklaim "resmi" tanpa landatan.

⚠️ **Zakat bergantung pada pembukuan yang benar.** Bila HPP nol, zakat salah. Maka zakat tidak boleh lebih dulu dari GL.

### 5.2 HPP

**Tiga angka yang harus terpisah:**

- **Arus kas** = pendapatan diterima − seluruh pengeluaran (termasuk pembelian stok)
- **Laba usaha** = pendapatan − beban operasional − HPP barang terjual
- **Dasar zakat penghasilan** = laba usaha (bukan arus kas)

**Harga modal melekat pada batch**, bukan produk — karena harga beli berubah. `StockMovement.unitCost` adalah potret saat potongan terjadi, bukan view turunan.

### 5.3 Periode tutup

Bulan yang ditutup tidak boleh menerima posting baru. Koreksi lewat **reverse entry** tanggal berapa pun, tapi hanya di periode terbuka.

### 5.4 Freemium

**Kunci kemampuan, jangan kunci kebenaran.** Angka dari data sendiri selalu tampil. Kuota yang dikunci: pengguna, jumlah invoice, jumlah produk. Kemampuan yang dikunci: batch/expired, multi-gudang, cicilan, laporan lengkap, white-label, program, csrf, HPP detail, AI.

---

## 6. FITUR YANG SUDAH ADA (v1, jangan direstrukturisasi)

Inventory batch + FEFO + expired · Supplier · HPP · Program (Kloter/Proyek/Tahun Ajaran/Pesanan) · Zakat ganda · Industry presets 8 jenis · White-label subdomain · User management 5 role · Super Admin + impersonate · Freemium gating + telemetri · Rate limiting · Reset password · Error logging · 267 tes.

**Aturan**: refactor boleh, rewrite tidak. Kalau sebuah fitur tidak cocok dengan ARSITEKTUR.md, tambahkan di roadmap — jangan dihapus diam-diam.

---

## 7. YANG TIDAK BOLEH DICARI

PRD ini **bukan** daftar fitur yang bisa langsung dikerjakan. Yang tidak bisa di-reverse nanti:

| Keputusan | Kenapa irreversible |
|---|---|
| `Expense{category, amount}` → akun | Butuh migrasi seluruh histori |
| `Invoice.taxAmount` scalar → `TaxRule` | Faktur lama tidak bisa dipecah PPN |
| Single-currency → multi-currency | Backfill rate bisa salah |
| Tanggal UTC tengah malam | Salah zona = salah hari = salah tutup buku |
| Nama `Account` untuk CoA | **Sudah dipakai NextAuth** — bentrok. Nama CoA: `LedgerAccount` |

---

## 8. RISIKO

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Migrasi GL = breaking change | Data tenant existing tidak konsisten | Dual-write 1 versi, migrasi manual 5 tenant PROD |
| Zakat liability | Salah hitung = kerugian spiritual | Disclaimer tegas, rujukan mufti, mode "estimasi" |
| POS = produk kedua | Overbudget 3× | Jangan mulai sebelum GL stabil |
| Global = drain | Multi-currency + i18n + tax = 3× kompleksitas | Indonesia dulu sampai paid retention terlihat |
| Beban solo dev | 12–18 bulan realistis? | Fase 1 GL tidak bisa di-shortcut |
| Branding "TaradinMu" | Sangat niche Indonesia | Rebrand sebelum 1000 tenant |

---

## 9. PERTANYAAN TERBUKA (butuh keputusan pemilik produk)

1. **Nama produk** — tetap "TaradinMu" atau rebrand sebelum expand?
2. **Migrasi data** — 5 tenant PROD: backfill dari data existing atau input ulang?
3. **Payment gateway** — subscription masih manual via WhatsApp. Kapan Midtrans/Xendit?
4. **Arabic/RTL** — Saudi butuh RTL penuh. Kapan Readiness?
5. **Tim/funding** — 12–18 bulan solo.

---

## 10. GERBANG KELENGKAPAN

Fitur dianggap selesai bila:
- [ ] Terdaftar di PRD ini dengan fase yang benar
- [ ] Migrasi database ada (bukan `db push`)
- [ ] `npx tsc --noEmit` hijau
- [ ] `npm run lint` hijau
- [ ] `npm run test` hijau (test baru untuk logika baru)
- [ ] `npm run build` hijau
- [ ] Bukti: output perintah atau screenshot, bukan klaim
