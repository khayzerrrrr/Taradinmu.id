# TARADINMU - PRODUCT REQUIREMENTS DOCUMENT (PRD)

**Project Name**: TaradinMu (taradinmu.id)  
**Author**: Pak Reza (Solo Developer + AI Assistant)  
**Architecture**: Modular Monolith (Next.js, TypeScript, Prisma, PostgreSQL)  
**Document Version**: 1.0.0

---

## 1. VISI & OVERVIEW PRODUK

- **Filosofi**: "Taradin" (تراضٍ) berarti niaga atas dasar saling ridha (QS. An-Nisa: 29). "Mu" merepresentasikan Muhammadiyah.
- **Target Pasar**: 100+ anggota Serikat Usaha Muhammadiyah (SUMU) di Medan (UMKM, F&B, Klinik, Sekolah, Trading).
- **Pain Points**: Pencatatan laba/rugi manual, stok berantakan (butuh varian & expired date), invoice/piutang terlupakan, kesulitan pemisahan pajak.
- **Solusi Inti**: SaaS Modular Multi-tenant dengan fitur Core, Inventory (Batch & Expired), Billing (Invoice & Piutang), dan Dashboard Owner.
- **Model Bisnis**: Freemium + White-label. Fitur dasar gratis (pakai path URL), fitur premium berbayar (Subdomain kustom, Ganti Logo, Ganti Warna Dashboard).

---

## 2. ARSITEKTUR & TECH STACK (WAJIB DIPATUHI)

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui.
- **Backend**: Next.js Server Actions.
- **Database**: PostgreSQL.
- **ORM**: Prisma ORM.
- **Auth**: NextAuth.js (Auth.js) v5.
- **Validation**: Zod.
- **Routing Subdomain**: Next.js Middleware (`src/middleware.ts`).

### Struktur Folder (Modular Monolith)
src/
── app/ # Next.js App Router (Routing, Pages, Layouts)
├── components/ # Shared UI components (shadcn/ui global)
├── modules/ # BATAS MODULAR YANG KETAT
│ ├── core/ # Tenant, User, Auth, Settings, Super Admin
│ ├── inventory/ # Product, Variant, Batch, Stock Movement
│ ├── billing/ # Invoice, Customer, Accounts Receivable
│ └── accounting/ # (Fase 2) Chart of Accounts, Journal, P&L
── lib/ # Utilities, Prisma client instance, helpers global
└── shared/ # Shared types, constants, enums


---

## 3. DATABASE SCHEMA (PRISMA)

Skema ini mendukung multi-tenancy, inventory batch, white-label, dan Super Admin.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  SUPER_ADMIN // Khusus Pak Reza (Platform Owner)
  OWNER       // Pemilik Tenant/Toko
  ADMIN
  STAFF
  ACCOUNTANT
}

enum PlanType {
  FREE  // Default: Pakai path /nama-toko, logo default, modul dasar
  PRO   // Berbayar: Subdomain toko.taradinmu.id, custom logo/warna, semua modul
}

enum StockMovementType {
  IN
  OUT
  ADJUSTMENT
}

enum InvoiceStatus {
  DRAFT
  SENT
  PAID
  OVERDUE
}

model Tenant {
  id              String   @id @default(cuid())
  name            String   // Nama Usaha (e.g., "Klinik Sehat Muhammadiyah")
  slug            String   @unique // Untuk path URL (e.g., "klinik-sehat")
  subdomain       String?  @unique // Untuk subdomain (e.g., "klinik-sehat" -> klinik-sehat.taradinmu.id)
  
  plan            PlanType @default(FREE)
  enabledModules  String[] // Array modul aktif: ["INVENTORY", "BILLING"]
  
  // Custom Branding (White-label)
  customLogoUrl   String?  // URL logo custom tenant
  primaryColor    String?  @default("#059669") // Warna utama custom
  dashboardLayout String?  // JSON config untuk layout dashboard
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  users           User[]
  products        Product[]
  customers       Customer[]
  invoices        Invoice[]
}

model User {
  id          String   @id @default(cuid())
  tenantId    String?  // Null jika SUPER_ADMIN
  tenant      Tenant?  @relation(fields: [tenantId], references: [id])
  name        String
  email       String   @unique
  password    String
  role        Role     @default(STAFF)
  createdAt   DateTime @default(now())
}

// --- MODUL INVENTORY ---
enum ItemKind {
  GOODS   // Barang: punya stok/batch; invoice memotong stok (FEFO)
  SERVICE // Jasa: tanpa stok; invoice tidak menyentuh stok
}

model Product {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  name        String   // e.g., "Paracetamol", "Baju Koko", atau "Paket Umrah 9 hari"
  description String?
  kind        ItemKind @default(GOODS) // barang atau jasa
  variants    ProductVariant[]
  createdAt   DateTime @default(now())
}

model ProductVariant {
  id          String   @id @default(cuid())
  productId   String
  product     Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  sku         String   @unique
  name        String   // e.g., "Paracetamol 500mg" atau "Baju Koko - L - Putih"
  price       Decimal  @db.Decimal(12, 2)
  batches     InventoryBatch[]
  invoiceItems InvoiceItem[]
}

model InventoryBatch {
  id             String   @id @default(cuid())
  variantId      String
  variant        ProductVariant @relation(fields: [variantId], references: [id])
  batchNumber    String   // e.g., "BATCH-2024-001"
  quantity       Int      // Stok saat ini di batch ini
  expiredDate    DateTime? // Wajib untuk F&B dan Farmasi
  createdAt      DateTime @default(now())
  movements      StockMovement[]
}

model StockMovement {
  id          String   @id @default(cuid())
  batchId     String
  batch       InventoryBatch @relation(fields: [batchId], references: [id])
  type        StockMovementType
  quantity    Int
  reference   String?  // e.g., "INV-001" atau "PO-002"
  notes       String?
  createdAt   DateTime @default(now())
}

// --- MODUL BILLING ---
model Customer {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  name        String
  phone       String?
  email       String?
  address     String?
  invoices    Invoice[]
  createdAt   DateTime @default(now())
}

model Invoice {
  id            String   @id @default(cuid())
  tenantId      String
  tenant        Tenant   @relation(fields: [tenantId], references: [id])
  customerId    String
  customer      Customer @relation(fields: [customerId], references: [id])
  invoiceNumber String   @unique
  totalAmount   Decimal  @db.Decimal(12, 2)
  taxAmount     Decimal  @db.Decimal(12, 2) @default(0)
  status        InvoiceStatus @default(DRAFT)
  dueDate       DateTime
  paidAt        DateTime? // diisi saat status menjadi PAID (dasar pendapatan)
  notes         String?
  items         InvoiceItem[]
  createdAt     DateTime @default(now())
}

// Baris item invoice: menautkan invoice ke varian (dasar pemotongan stok).
model InvoiceItem {
  id        String   @id @default(cuid())
  invoiceId String
  invoice   Invoice  @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  variantId String
  variant   ProductVariant @relation(fields: [variantId], references: [id])
  quantity  Int
  price     Decimal  @db.Decimal(12, 2)
  subtotal  Decimal  @db.Decimal(12, 2)
}
```
enum BusinessType {
  RETAIL_FNB
  TRAVEL_UMROH
  JASA_ORDER
  PROJECT_BASED
  TRADING
  EDUCATION
  HEALTH_CLINIC
  OTHER
}

model Tenant {
  // ... field yang sudah ada ...
  businessType    BusinessType @default(OTHER)
  // ...
}

// Update Enum dan Tambahkan Model Zakat

enum ZakatType {
  PERNIAGAAN  // Berdasarkan Aset/Kekayaan
  PENGHASILAN // Berdasarkan Pendapatan/Laba Bulanan
}

enum ZakatStatus {
  BELUM_WAJIB 
  WAJIB       
  DIBAYARKAN  
}

model ZakatCalculation {
  id              String      @id @default(cuid())
  tenantId        String
  tenant          Tenant      @relation(fields: [tenantId], references: [id])
  
  zakatType       ZakatType   // PERNIAGAAN atau PENGHASILAN
  
  // Data Perhitungan
  totalBase       Decimal     @db.Decimal(15, 2) // Total Aset (jika Perniagaan) atau Total Pendapatan (jika Penghasilan)
  totalDeduction  Decimal     @db.Decimal(15, 2) @default(0) // Total Hutang (Perniagaan) atau Pengeluaran (Penghasilan)
  netWealth       Decimal     @db.Decimal(15, 2) // Kekayaan Bersih / Laba Bersih
  
  goldPrice       Decimal     @db.Decimal(15, 2) // Harga Emas saat itu (per gram)
  nisabThreshold  Decimal     @db.Decimal(15, 2) // Batas Nisab (85 * goldPrice)
  
  // Hasil
  zakatAmount     Decimal     @db.Decimal(15, 2) // 2.5% dari netWealth (jika wajib)
  status          ZakatStatus @default(BELUM_WAJIB)
  
  periodMonth     Int?        // Khusus Penghasilan: Bulan (1-12)
  periodYear      Int         // Tahun perhitungan
  
  calculatedAt    DateTime    @default(now())
  paidAt          DateTime?   // Tanggal saat zakat benar-benar dibayarkan
}

// Tambahkan Model Pengeluaran Sederhana (Untuk menghitung Laba Bersih)
model Expense {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  category    String   // e.g., "Gaji Karyawan", "Sewa Tempat", "Listrik"
  amount      Decimal  @db.Decimal(12, 2)
  description String?
  date        DateTime @default(now())
  createdAt   DateTime @default(now())
}

4. FITUR UNGGULAN & ATURAN BISNIS
Aturan tujuan setelah masuk (berlaku untuk login dan daftar):
SUPER_ADMIN -> /admin; pengguna tenant -> /<slug>/dashboard; akun tanpa tenant -> /.
  Halaman "/" adalah halaman pemasaran, jadi tidak pernah menjadi tujuan otomatis setelah masuk.
  Bila permintaan masuk membawa ?callbackUrl (mis. pengguna sebelumnya ditahan guard di halaman tertentu), callbackUrl itu yang dipakai — aturan rumah hanya jadi cadangan.
A. Subdomain & White-label (Fitur Premium / PRO)
Routing: Gunakan Next.js Middleware (src/middleware.ts) untuk mendeteksi subdomain.
Jika user akses toko.taradinmu.id -> Load tenant dengan subdomain "toko".
Jika user akses taradinmu.id/toko -> Load tenant dengan slug "toko" (Untuk paket FREE).
Gating Fitur: Komponen kustomisasi (Ganti Logo, Ganti Warna) HANYA muncul jika tenant.plan === 'PRO'.
Fallback: Jika tenant PRO belum upload logo, gunakan logo default TaradinMu.
B. Super Admin Dashboard (God Mode untuk Pak Reza)
Akun dengan role SUPER_ADMIN memiliki akses eksklusif ke /admin/dashboard.
Kemampuan Super Admin:
Melihat daftar SEMUA tenant di sistem.
Membuat tenant baru secara manual (Provisioning) & membuatkan akun Owner.
Mengubah plan tenant (dari FREE ke PRO).
Mengaktifkan/menonaktifkan modul (enabledModules) untuk tenant tertentu.
Login sebagai tenant (Impersonate) untuk debugging.
Memulihkan akun yang terkunci: mereset kata sandi akun mana pun, TERMASUK OWNER dan SUPER_ADMIN, dari halaman /admin.
  Alasan fitur ini ada: paket FREE hanya boleh punya 1 pengguna, yaitu OWNER, dan tautan /lupa-sandi bergantung pada penyuplai email yang terkonfigurasi. Tanpa jalur kedua ini, pemilik toko yang lupa kata sandi hanya bisa dipulihkan dengan SQL manual ke database produksi.
  Aturannya:
  - Dijaga assertSuperAdmin(); tidak dipanggil dari halaman mana pun di dalam tenant. Proteksi akun OWNER di halaman Pengguna tenant tetap utuh — jalur khusus ini hanya terbuka dari konteks Super Admin.
  - Target ditentukan lewat email akun, bukan id, karena itulah yang dimiliki orang saat menghubungi admin.
  - Kata sandi lama tidak diminta (justru itu gunanya), tetapi konfirmasi ketik ulang wajib.
  - Semua token reset milik target yang masih hidup dibatalkan, supaya tautan lama tidak bisa menimpa sandi baru.
  - Kejadian dicatat ke log server: siapa mereset akun siapa. Log dianggap data rahasia.
  - Batasan yang diterima: sesi JWT yang sedang aktif tidak berakhir hanya karena kata sandi diganti. Bila yang dicurigai adalah pembajakan akun, pengguna tetap harus keluar sendiri atau menunggu sesi kedaluwarsa.
5. UI/UX & BRAND GUIDELINES
Logo Resmi: "Ta Node" (Huruf Ta Arab abstrak dengan 2 node emas).
Color Palette:
Primary: #059669 (Emerald-600)
Secondary: #0F172A (Slate-900)
Accent: #D97706 (Amber-600)
Background: #F8FAFC (Slate-50)
Typography: Inter atau Geologica.
Prinsip Desain: Progressive Disclosure (Tampilan Owner disederhanakan, Tampilan Akuntan lebih detail).
6. ATURAN CODING & MODULAR (SANGAT PENTING UNTUK AI)
Isolasi Modul: Modul billing TIDAK BOLEH import komponen UI dari inventory. Gunakan Prisma langsung atau shared utils di src/lib/.
Feature Flags: Selalu cek if (!tenant.enabledModules.includes('INVENTORY')) sebelum merender UI modul.
Struktur Modul: Setiap modul wajib punya: actions/, components/, schemas/ (Zod), types.ts, utils.ts.
TypeScript Strict: DILARANG pakai any. Gunakan interface/type yang jelas.
Validasi: Semua input form/API WAJIB divalidasi Zod sebelum ke Prisma.
Error Handling: Server Action harus return { success: boolean, message: string, data?: any, error?: string }. Jangan throw error mentah ke UI.
Bahasa: Gunakan Bahasa Indonesia untuk komentar kode dan penjelasan.
Konteks adalah Raja: Selalu baca file PRD.md ini sebelum menghasilkan kode. Jangan mengarang library atau pola arsitektur di luar dokumen ini.
7. ROADMAP PENGEMBANGAN (FOKUS SAAT INI: FASE 1)
Fase 1: MVP (Fokus Saat Ini - JANGAN buat fitur di luar ini)
Setup Next.js, Prisma, PostgreSQL, Auth, shadcn/ui.
Modul Core: Multi-tenant, User Management, Role-based access, Super Admin Dashboard.
Modul Inventory Dasar: Product, Variant, Batch (dengan expired date), Stock In/Out.
Modul Billing Dasar: Customer, Invoice, Status Pembayaran.
Dashboard Owner: Ringkasan Kas, Piutang, dan Stok menipis.
Setup Middleware untuk deteksi Subdomain vs Path.
Fase 2: Scaling & Akuntansi (Akan datang, JANGAN dibuat sekarang)
Chart of Accounts (CoA) yang bisa di-custom.
Jurnal otomatis dari Invoice dan Stock Out.
Laporan Laba/Rugi dan Neraca.
Integrasi pajak (PPN, PPh Final).
Fase 3: Ekosistem & Advanced (Masa Depan)
B2B Marketplace antar tenant.
Modul khusus Klinik (Rekam medis, batch obat ketat).
Modul khusus Sekolah (Integrasi dengan SKULV).
Dokumen ini adalah sumber kebenaran tunggal untuk pengembangan TaradinMu. Setiap perubahan harus direfleksikan di sini terlebih dahulu sebelum implementasi.

## 4.C. FITUR "INDUSTRY PRESETS" (Penyesuaian Otomatis per Jenis Usaha)
Untuk melayani berbagai jenis usaha di SUMU (Minimarket, Travel, Kontraktor, Aqiqah, Laundry, dll) tanpa membuat kode yang terpisah, sistem menggunakan "Industry Presets".

1. **Tenant Registration:** Saat mendaftar, User wajib memilih `businessType`.
2. **Auto-Configuration:** Berdasarkan `businessType`, sistem otomatis:
   - Mengisi `enabledModules`. **INVENTORY diberikan ke semua jenis usaha** karena
     modul itu memuat katalog item (barang maupun jasa) — tanpa katalog, tenant
     tidak dapat membuat satu pun item yang bisa ditagih. `ACCOUNTING` juga aktif
     untuk semua jenis usaha (pengeluaran & zakat).
   - Menentukan **jenis item awal**: usaha jasa (travel, laundry, pendidikan,
     proyek) berawalan `SERVICE`, usaha barang berawalan `GOODS`. Hanya nilai
     awal form; pengguna tetap bisa memilih jenis lain.
   - Membuat "Kategori Produk/Jasa" default.
   - (Fase 2) Membuat "Chart of Accounts" (CoA) dasar yang sesuai industri.
3. **Aturan Barang vs Jasa (berlaku untuk semua jenis usaha):**
   - `Product.kind = SERVICE` → invoice **tidak memotong stok** dan jasa tidak
     muncul di halaman Stok. Ini yang memungkinkan travel, laundry, pendidikan,
     dan jasa profesional menagih tanpa membuat batch stok palsu.
   - `Product.kind = GOODS` → invoice memotong stok (FEFO) seperti biasa.
   - Jenis item **tidak boleh disimpulkan** dari ada/tidaknya batch: barang yang
     stoknya sedang kosong akan keliru dianggap jasa, lalu stoknya berhenti
     dipotong tanpa ada yang menyadari.
4. **Daftar Preset Bisnis (Fase 1):**
   - `RETAIL_FNB` (Minimarket, Catering, F&B): Aktifkan Inventory (Batch/Expired), POS.
   - `TRAVEL_UMROH` (Travel Umrah/Haji): Aktifkan Billing (Cicilan), CRM (Data Jamaah).
   - `JASA_ORDER` (Laundry, Aqiqah, Konveksi): Aktifkan Order Tracking (Status Workflow).
   - `PROJECT_BASED` (Kontraktor, Event Organizer): Aktifkan Billing per Proyek, Inventory Material.
   - `TRADING` (Ekspor-Impor, Distributor): Aktifkan Inventory (Gudang), Billing (Invoice B2B).

   **Catatan penting:** daftar di atas adalah *target*, bukan keadaan sekarang.
   Yang sudah berlaku hari ini barulah: katalog **barang & jasa**, Inventory
   (batch/kedaluwarsa untuk PRO), Billing, serta Akuntansi dasar + zakat.
   **POS, cicilan, CRM jamaah, order tracking, billing per proyek, dan
   multi-gudang belum dibangun** — lihat P2/P3 pada `docs/ROADMAP.md`. Preset
   `EDUCATION`, `HEALTH_CLINIC`, dan `OTHER` belum dirinci di daftar ini.

### D. Fitur Zakat Ganda: Perniagaan & Penghasilan (Killer Feature)
TaradinMu menyediakan dua mode perhitungan zakat untuk mengakomodasi kebutuhan syariah anggota SUMU.

1. **Zakat Perniagaan (Berdasarkan Aset/Kekayaan):**
   - **Metode:** Semi-Otomatis/Manual.
   - **Logika:** `(Total Aset Lancar [Kas + Stok + Piutang] - Total Hutang Lancar) x 2,5%`.
   - **Trigger:** Dihitung saat user menekan tombol "Hitung Zakat Perniagaan" (biasanya 1 tahun/haul).

2. **Zakat Penghasilan & Laba Usaha (Berdasarkan Income Bulanan):**
   - **Metode:** **Otomatis** (Real-time dari data transaksi).
   - **Logika:** `(Total Pendapatan [Invoice PAID] - Total Pengeluaran Operasional) x 2,5%`.
   - **Trigger:** Sistem otomatis menghitung dan menampilkan estimasi zakat penghasilan di Dashboard setiap akhir bulan.
   - **Syarat Nisab:** Sistem otomatis mengecek apakah total pendapatan bulanan/tahunan sudah mencapai nisab (setara 85gr emas). Jika belum, status "Belum Wajib".

3. **Integrasi & Laporan:**
   - Kedua perhitungan disimpan di riwayat zakat, masing-masing dengan **periode
     laporan** (bulan & tahun) sehingga riwayat dapat dikelompokkan per bulan.
     Periode diisi server dari bulan berjalan, bukan dari waktu input apa adanya.
   - Tombol "Cetak Laporan Zakat" untuk diserahkan ke LAZISMU/BAZNAS atau pencatatan pribadi.
     Laporan dicetak untuk periode yang sedang tampil dan memuat kolom tanda tangan
     pengelola serta penerima.

### 4.D. STRATEGI FREEMIUM & FEATURE GATING (FREE vs PRO)

Untuk mendorong konversi, kita terapkan batasan penggunaan pada paket FREE.

**Harga PRO: Rp 149.000 per bulan.** Angka ini ditulis di SATU tempat di kode
(`HARGA_PRO_BULAN` pada `src/lib/plan-limits.ts`, berkas murni data) dan dibaca oleh
setiap ajakan upgrade — tidak boleh ada salinan literal "Rp 149.000" di komponen
lain, karena harga yang berbeda di dua modal adalah cara tercepat kehilangan
kepercayaan. Aktivasinya masih manual lewat WhatsApp admin (belum ada payment
gateway); perubahan harga = satu baris di berkas itu + entri ini.

**Aturan penentu seluruh gating: kunci kemampuan, jangan kunci kebenaran.**
Angka yang sudah dihitung dari data milik tenant sendiri tampil pada semua paket
(laba bersih, arus kas, HPP yang mengurangi laba, estimasi zakat). Yang menjadi
milik PRO adalah kemampuan tambahan: menarik & mencatat otomatis, rincian margin
per dokumen, multi-pengguna, batch/kedaluwarsa, dan kustomisasi merek. Alasan
mengunci angka yang benar tidak ada: tenant FREE yang angkanya salah tidak akan
pernah upgrade — ia akan pindah aplikasi.

#### 1. Batasan Paket FREE (Starter)
- **Pengguna (Users):** Maksimal 1 User (Owner saja).
- **Invoice/Billing:** Maksimal 50 Invoice per bulan.
- **Inventory/Produk:** Maksimal 100 Item Produk (Tanpa fitur Batch/Expired Date).
- **Zakat:** Kalkulator manual bebas (tab "Zakat Perniagaan", termasuk mencatat
  pembayaran). **Zakat Penghasilan: angkanya terlihat** (estimasi + dasar
  perhitungannya di dashboard dan halaman zakat); yang terkunci adalah menarik
  datanya otomatis ke riwayat dan menandai lunas — lihat 4.D.3.
- **URL:** Hanya Path standar (`taradinmu.id/nama-toko`).
- **Branding:** Wajib menggunakan Logo & Tema Default TaradinMu.
- **Laporan:** Hanya Laporan Dasar (Laba Rugi Sederhana). Pemisahan pembelian stok
  dari laba tetap berlaku (4.G.5); yang tidak ada hanya rincian HPP & margin.


#### 2. Fitur Eksklusif PRO (TaradinMu Pro)
- **Pengguna:** Unlimited (Bisa tambah Admin, Staff, Akuntan).
- **Invoice/Billing:** Unlimited + Fitur Cicilan & Pembayaran Bertahap (untuk Travel/Kontraktor).
- **Inventory:** Unlimited + Fitur Batch, Expired Date, FEFO, dan Multi-Gudang.
- **Zakat:** **Otomatis** (Tarik data real-time dari Invoice & Pengeluaran) + riwayat pencatatan per periode.
- **URL:** Subdomain kustom (`nama-toko.taradinmu.id`).
- **Branding:** White-label (Ganti Logo, Warna Tema, Favicon).
- **Laporan:** Laporan Lengkap (Neraca, Arus Kas, Pajak) + kartu Margin Kotor dan
  baris HPP per invoice (4.G.5).

##### 2a. Yang BELUM dibangun — jangan dijual dulu
Daftar di atas adalah **rencana** paket PRO, bukan daftar yang bisa dibaca
calon pelanggan hari ini. Menyebut yang belum ada di modal upgrade, halaman
registrasi, atau materi promosi menagih janji yang belum bisa ditebus — dan untuk
produk yang sudah dipakai tenant sungguhan, satu janji kosong lebih mahal daripada
satu fitur kurang. Status per 2026-09-26:

| Janji PRO | Status |
|---|---|
| Pengguna unlimited | **ADA** (batas jumlah ditegakkan di `checkLimit("USERS")`) |
| Invoice & produk unlimited | **ADA** |
| Batch + tanggal kedaluwarsa | **ADA** |
| Zakat otomatis + riwayat | **ADA** |
| Modul Program (4.F) | **ADA** |
| Laporan HPP / margin per invoice (4.G) | **ADA** |
| Warna & logo kustom | **ADA** |
| Cicilan / pembayaran bertahap | **BELUM** (Tahap 3) |
| Multi-gudang | **BELUM** (fase J) |
| Neraca & Arus Kas penuh per periode | **BELUM** (Tahap 4; dashboard baru menampilkan kartu) |
| Subdomain kustom | **BELUM** (semua tenant memakai path `/nama-toko`) |
| Favicon kustom | **BELUM** (fase J) |
| AI Assistant | **SEBAGIAN** — chat ada & terkunci PRO, tetapi `src/app/api/chat/route.ts` secara eksplisit memberitahu model bahwa data tenant belum terhubung. Menjualnya sebagai "asisten yang terintegrasi dengan database Anda" belum jujur (ROADMAP fase M). |

Yang boleh ditawarkan modal upgrade hanyalah baris **ADA** di tabel ini.

#### 3. UI/UX "Upgrade Prompt" (Anti-Frustrasi)
- Jika user FREE mencoba mengakses fitur PRO, JANGAN langsung tolak dengan error merah.
- Tampilkan **Modal/Overlay Elegan** dengan efek *blur* di latar belakang.
- **Isi Modal:** Icon Kunci (Lucide), Judul "Fitur Premium", Deskripsi singkat manfaat fitur tersebut, dan Tombol CTA besar "Aktifkan TaradinMu Pro" (Warna Amber/Emas) + Tombol kecil "Nanti Saja".
- Pada tombol/menu di Sidebar yang terkunci, berikan **Icon Gembok (Lock)** kecil dengan warna abu-abu.
- **Wajib menyebut harga.** Modal tanpa harga memaksa orang membuka WhatsApp
  hanya untuk bertanya, dan kebanyakan tidak akan repot-repot. Tulis
  `Rp 149.000/bulan` dari `HARGA_PRO_BULAN`, bukan angka yang diketik ulang.
- **Manfaat yang didaftarkan mengikuti fitur yang baru saja diklik**, bukan daftar
  generik yang sama untuk semua gembok. Orang yang mengklik gembok "tanggal
  kedaluwarsa" ingin mendengar soal obat kadaluarsa, bukan soal modul Program —
  ajakan yang tidak nyambung dengan rasa sakitnya terbaca sebagai iklan dan
  ditutup. Bentuknya: 2–4 baris manfaat untuk kunci fitur (`BATCH`, `ZAKAT`,
  `PROGRAM`, `HPP`) dan untuk batas jumlah (`USERS`, `INVOICE`, `PRODUCT`);
  pemanggil tanpa kunci spesifik tetap mendapat daftar umum.
- **Pesan batas (server) menjual, bukan melarang.** `checkLimit()` dipakai dua
  tempat (tolak tulis + pratinjau UI), jadi pesannya harus menyebut angka
  `used`/`limit` **dan** apa yang terbuka setelah upgrade — misalnya kuota
  pengguna: bukan "maksimal 1 pengguna" saja, tapi "tambah kasir/admin supaya
  toko tetap jalan tanpa Anda".
- **Kuota terlihat sebelum menabrak tembok.** Batas yang datang tiba-tiba terasa
  seperti jebakan; batas yang terlihat sejak awal terasa seperti undangan naik.
  Selain meter di halaman Billing, dashboard menampilkan kemajuan kuota
  (invoice/produk/pengguna) **mulai 80% terpakai**, lengkap dengan CTA upgrade.
  Di bawah ambang itu tidak ada apa-apa — dashboard warung jangan berubah menjadi
  spanduk penjualan.


#### 4. Yang sengaja TIDAK diubah
- **Batas jumlah FREE tetap 50 invoice/bulan dan 100 produk.** Mengencangkannya
  akan mempercepat konversi di atas kertas tapi membunuh adopsi: toko yang belum
  selesai memindahkan katalognya tidak akan pernah sampai ke momen "saya butuh
  PRO". Retensi produk ini justru ada di dalamnya — semakin dalam histori stok,
  invoice, dan pemasok seseorang, semakin mahal pindah ke aplikasi lain.
  Pendorong upgrade yang dikehendaki adalah **kursi staf, batch/kedaluwarsa, dan
  zakat otomatis** (ketiganya muncul tepat saat toko mulai tumbuh), bukan kuota.
- **Impor CSV (Tahap 4) untuk SEMUA paket.** Memindahkan data dari buku/Excel ke
  sini adalah biaya masuk, bukan kemampuan bayar. Menggemboknya membuat orang
  tidak pernah masuk, jadi tidak pernah punya alasan upgrade. Yang tetap PRO:
  **ekspor** dan laporan per periode penuh.
- **Modul Pemasok tidak dibatasi paket** (4.G.4): master data tempat barang
  dibeli berguna bahkan untuk toko 20 item, dan membatainya hanya membuat
  pencatatan stok awal lebih berantakan.

### 4.E. FITUR AI AGENT (EKSKLUSIF TARADINMU PRO)
Fitur "TaradinMu AI Assistant" adalah chatbot cerdas yang terintegrasi langsung dengan database tenant untuk membantu operasional bisnis.

1. **Akses:** Hanya tersedia untuk tenant dengan `plan === 'PRO'`. (User FREE akan melihat chat bubble dengan icon gembok).
2. **UI/UX:** Floating Action Button (FAB) berbentuk icon robot/chat di pojok kanan bawah layar. Saat diklik, membuka panel chat (Drawer/Modal).
3. **Kemampuan AI (Powered by LLM API):**
   - **Conversational Data Entry:** Memparse teks/voice menjadi data Expense, Invoice, atau Stock Movement.
   - **Business Insights:** Menjawab pertanyaan tentang performa bisnis berdasarkan data real-time (RAG sederhana).
   - **Drafting Messages:** Membuat draf pesan WhatsApp untuk penagihan atau marketing.
   - **Syariah Advisor:** Memberikan panduan singkat terkait hitungan zakat dan etika bisnis Islami.
4. **Teknis:** Menggunakan Vercel AI SDK atau streaming API sederhana. AI hanya diberikan akses *read-only* ke data via Server Actions yang aman, atau *write access* terbatas (hanya untuk create Expense/Invoice) dengan konfirmasi user.

### 4.F. MODUL PROGRAM (satu mesin untuk kloter, proyek, dan tahun ajaran)

**Keputusan desain yang harus dipahami sebelum menambah modul industri apa pun:**
kebutuhan "CRM Data Jamaah" (travel), "Billing per Proyek" (kontraktor/EO), dan
penagihan SPP per tahun ajaran (pendidikan) pada 4.C **bukan tiga modul berbeda** —
ketiganya adalah objek yang sama dengan label industri: sekumpulan orang, satu
rentang waktu, target uang yang harus masuk, dan anggaran yang akan keluar.
Membangun satu entitas `Program` dan memberi label per `businessType` jauh lebih
kecil permukaannya daripada tiga modul vertikal yang masing-masing punya tabel,
halaman, dan gerbang sendiri. Modul lain menyusul memakai mesin yang sama.

#### 1. Definisi
Sebuah **Program** adalah pusat biaya dan pusat tagih, bukan catatan pembukuan baru.
Isinya: nama, keterangan, tanggal mulai, tanggal selesai (boleh kosong selama
program masih berjalan), status, target dana (opsional),
anggaran (opsional), dan peserta.

#### 2. Aturan uang — bagian paling penting
Program **tidak pernah** menyimpan uang sendiri. Tidak ada tabel pembayaran, tidak
ada ledger kedua.
- **Terkumpul** = jumlah `Invoice` ber-status `PAID` yang `programId`-nya menunjuk program ini.
- **Terpakai** = jumlah `Expense` yang `programId`-nya menunjuk program ini.
- Karena itu kolom `programId` pada `Invoice` dan `Expense` bersifat **nullable**:
  invoice dan pengeluaran biasa tetap ada seperti sebelumnya, program hanya
  *melabeli* uang yang sudah tercatat.
- Alasan larangan ledger kedua: dua sumber kebenaran angka adalah cara paling
  pasti menghasilkan laporan yang berbeda sendiri saat salah satunya diperbaiki.

#### 3. Peserta memakai Customer yang sudah ada
Peserta program ditautkan lewat tabel `ProgramParticipant (programId, customerId)`.
**Dilarang** membuat model `Jamaah`/`Siswa`/`Klien` sendiri: untuk tagihan, jamaah
umrah dan siswa pesantren sama-sama pihak yang ditagih, dan `Customer` sudah
menyimpan nama, telepon, email, dan alamat. Duplikasi identitas membuat satu orang
bisa punya dua catatan yang tidak pernah bertemu.

#### 4. Label per industri
Label diambil dari `businessType` tenant saat render, **bukan** disimpan di baris
program — supaya satu tenant yang jenis usahanya diubah tidak punya data yang
menyimpang. Pemetaan: `TRAVEL_UMROH` -> "Keberangkatan / Kloter",
`PROJECT_BASED` -> "Proyek", `EDUCATION` -> "Tahun Ajaran / Kelas",
`JASA_ORDER` -> "Pesanan", `RETAIL_FNB` -> "Acara", lainnya -> "Program".

#### 5. Status
`PLANNING` (direncanakan) -> `ACTIVE` (berjalan) -> `COMPLETED` (selesai);
`CANCELLED` (dibatalkan) dapat dicapai dari status mana pun. Status tidak mengubah
angka apa pun — ia hanya menyaring daftar.

#### 6. Gating: EKSKLUSIF PRO
Mengikuti 4.D: fitur baru yang menambah kemampuan bayar adalah alasan upgrade,
maka Program hanya untuk `plan === 'PRO'`.
- Ditegakkan **di server** lewat `ambilBatasFitur(plan, "PROGRAM")`, bukan hanya
  disembunyikan di UI. Menutup menu tanpa menutup Server Action-nya hanya
  menyembunyikan pintunya.
- Tenant FREE melihat baris menu dengan ikon gembok dan modal upgrade sesuai 4.D.3,
  bukan pesan error merah.

#### 7. Hak akses
- Baca: semua role anggota tenant (OWNER, ADMIN, STAFF) dan SUPER_ADMIN.
- Tulis (buat/ubah/hapus, tambah/keluar peserta, menautkan invoice & pengeluaran):
  OWNER, ADMIN, SUPER_ADMIN. STAFF hanya membaca.
- Semua aksi wajib melewati `aksesTenant()` modul PROGRAM; tidak ada pengecualian
  publik, dan `server-action-guards.test.ts` ikut memindai berkas modul ini.

#### 8. Preset yang mengaktifkannya
`TRAVEL_UMROH`, `PROJECT_BASED`, `EDUCATION`, dan `JASA_ORDER` mendapat `PROGRAM`
saat registrasi. `RETAIL_FNB`, `TRADING`, `HEALTH_CLINIC`, `OTHER` tidak — bagi
mereka program biasanya hanya jadi folder kosong; Super Admin tetap bisa
menyalakannya lewat `/admin`.

#### 9. Batasan yang diterima dan dicatat jujur
- **Tenant PRO yang sudah ada** tidak punya `PROGRAM` di `enabledModules`-nya
  (kolom itu diisi sekali saat registrasi). Migrasi harus menambahkannya ke tenant
  PRO yang sudah terdaftar, kalau tidak, satu-satunya pelanggan berbayar justru
  tidak melihat fitur barunya.
- **Menghapus program tidak boleh menghapus uangnya.** Program yang sudah ditauti
  invoice/pengeluaran tidak bisa dihapus begitu saja: tautannya dilepas
  (`programId` kembali `null`) dan jumlahnya dilaporkan ke pengguna lebih dulu.
- **Peserta yang masih punya tagihan berjalan** boleh keluar dari program; ia tidak
  ikut terhapus.
- Program tidak memaksa tanggal selesai setelah tanggal mulai pada data lama;
  validasi itu hanya berlaku untuk input baru.

### 4.G. HPP & PEMASOK (harga pokok penjualan yang benar)

**Masalah yang diselesaikan.** Sebelum bagian ini ada, satu rupiah pembelian stok
mengurangi dua angka sekaligus: "laba bersih" di dashboard dan dasar zakat
penghasilan. Itu keliru secara pembukuan maupun fikih: belanja sembako yang masih
menumpuk di rak bukan rugi, ia hanya berpindah bentuk dari kas menjadi aset.
Tenant yang membeli stok dalam jumlah besar bulan ini akan melihat labanya jatuh —
dan zakat penghasilannya ikut turun — padahal belum ada satu pun barang terjual.

#### 1. Tiga angka yang harus tetap terpisah
- **Arus kas** = pendapatan diterima − **seluruh** pengeluaran, termasuk pembelian
  stok. Ini jawaban atas "uangku ke mana saja".
- **Laba usaha** = pendapatan − beban operasional − **HPP barang yang benar-benar
  terjual**. Pembelian stok tidak masuk di sini.
- **Dasar zakat penghasilan** memakai **laba usaha**, bukan arus kas — zakat
  dihitung dari hasil usaha yang benar-benar terjadi.
Karena keduanya berbeda makna, dashboard menampilkannya sebagai dua kartu terpisah
dengan label yang jelas; tidak boleh ada satu variabel yang dipakai bergantian.
**Ketiga suku pada kartu laba wajib memakai basis pengakuan yang sama** (lihat
4.G.3): pendapatan dihitung dari invoice yang sudah dibayar, maka HPP-nya juga.
Perbaikan pemisahan ini berlaku untuk **semua paket** (FREE maupun PRO): tenant
gratis tidak boleh disuruh menghitung ulang dengan tangan supaya angkanya benar.

#### 2. Harga modal melekat pada batch, bukan pada produk
`InventoryBatch.costPrice Decimal(12,2)?` diisi saat Stok Masuk. Alasannya:
- Harga beli barang **berubah dari waktu ke waktu** (gula naik tiap musim). Satu
  harga di level `ProductVariant` akan membuat HPP bulan lalu ikut berubah setelah
  pembelian berikutnya — laporan yang tidak bisa direkonsiliasi.
- Kolom ini **nullable, dan sengaja dibiarkan begitu.** Batch lama tidak punya
  catatan harga modal; mengisi paksa 0 akan menghasilkan laba yang membengkak palsu,
  jauh lebih menyesatkan daripada "belum diketahui". Di mana HPP tidak bisa dihitung,
  UI menulis keterangan itu alih-alih menampilkan angka.
- `Decimal(12,2)` sama seperti harga jual, memakai satuan mata uang yang sama.

#### 3. HPP dicatat pada pergerakan stok, tidak diduplikasi di item invoice
Saat FEFO memotong stok, setiap `StockMovement` type `OUT` ikut menyimpan
`unitCost Decimal(12,2)?` — salinan `costPrice` batch asal pada saat itu.
- **HPP sebuah invoice = jumlah `unitCost × quantity` dari movement `OUT`
  miliknya sendiri** (dibedakan lewat `reference` = nomor invoice).
- **Dilarang** menambah kolom harga modal di `InvoiceItem`. Itu kolom kedua untuk
  fakta yang sama, dan dua sumber kebenaran angka adalah cara paling pasti
  menghasilkan laporan yang berbeda sendiri — aturan yang sama dengan 4.F.2.
- Movement yang sudah dibatalkan ditandai `#BATAL` pada `reference` (mekanisme
  pengembalian stok yang sudah ada), jadi **pembatalan invoice DRAFT otomatis
  membalikkan HPP** tanpa logika tambahan. Perhitungan HPP wajib mengecualikan
  `reference` berakhiran `#BATAL` dan hanya menghitung movement `OUT`.
- `unitCost` adalah **potret pada saat potongan terjadi**, bukan view turunan:
  bila `costPrice` batch dikoreksi belakangan, HPP yang sudah tercatat tidak boleh
  ikut berubah.
- **Untuk angka periode (dashboard & zakat): HPP diakui saat invoice-nya dibayar,
  bukan saat barang meninggalkan rak.** Stok sudah dipotong sejak invoice masih
  DRAFT, sedangkan pendapatan bulan ini dihitung dari invoice PAID. Kalau HPP
  mengikuti tanggal movement, satu invoice draft langsung tampil sebagai rugi
  sebesar seluruh modalnya padahal pendapatannya masih nol — persis kesalahan yang
  baru saja diperbaiki 4.G.1, hanya pindah sisi. Karena itu `hppInvoiceLunas()`
  hanya menghitung movement `OUT` yang `reference`-nya cocok dengan invoice
  berstatus PAID dengan `paidAt >= sejak`.
- **Stok keluar manual tanpa dokumen invoice tidak masuk HPP.** Bukan dianggap
  gratis: barang hilang/rusak/konsumsi sendiri memang belum punya jalur pembukuan
  sendiri. Memaksukannya menjadi harga pokok mencatat kerugian sebagai biaya
  penjualan; penyediaannya masuk laporan Laba/Rugi penuh (Tahap 4).
- Aturan periode ini **tidak** berlaku pada HPP per dokumen di dialog invoice:
  di sana pertanyaannya "berapa modal barang pada invoice ini", jadi seluruh
  movement dengan nomor itu dihitung, draft maupun lunas.

#### 4. Pemasok adalah entitas sungguhan
Model `Supplier (tenantId, name, phone?, email?, address?, notes?)` dan
`InventoryBatch.supplierId String?`.
- Bukan sekadar kolom teks "nama toko" di form stok: pertanyaan "modal siapa yang
  masih numpuk di pemasok ini" dan "harga dari pemasok mana yang paling mahal"
  tidak bisa dijawab oleh teks bebas yang berbeda ejaan setiap kali diisi.
- Kolom ini nullable: pembelian tanpa pemasok (mis. stok awal) tetap sah.
- Menghapus pemasok **tidak menghapus batch**: `onDelete: SetNull`, sama seperti
  aturan 4.F.9 — menghapus master data tidak boleh menghapus uang atau barang.
- CRUD-nya mengikuti pola modul Pelanggan (daftar + form + hapus, `aksesTenant()`
  dengan gerbang modul INVENTORY, tulis khusus OWNER/ADMIN/SUPER_ADMIN).

#### 5. Gating
- **Pemisahan arus kas vs laba: semua paket.** Ini koreksi angka yang salah,
  bukan fitur baru.
- **Angka HPP yang mengurangi laba tetap terlihat pada semua paket.** Kartu
  "Laba Bersih" menulis rumusnya lengkap (`pendapatan − beban usaha − HPP`),
  karena laba yang tidak bisa dijelaskan asal angkanya hanya memindahkan
  kesalahan. Yang disembunyikan tanpa HPP adalah kesimpulan, bukan ketelitiannya.
- **Laporan HPP / margin per invoice: PRO** (`checkLimit(tenantId, "HPP")`
  ditegakkan di server, bukan hanya disembunyikan): kartu "Margin Kotor" di
  dashboard dan baris HPP + laba kotor di dialog detail invoice. Pada paket FREE
  `getInvoiceDetail` bahkan tidak mengirim angkanya. FREE melihat kartu dengan
  ikon gembok dan modal upgrade sesuai 4.D.3. Alasannya sama dengan 4.F.6:
  margin per dokumen adalah kemampuan bayar berikutnya, dan sudah disebut di
  4.D.2 sebagai "Laporan Lengkap".

#### 6. Batasan yang diterima dan dicatat jujur
- **Batch lama tetap tanpa harga modal.** Tidak ada cara jujur untuk menebaknya;
  pengisian massal lewat impor stok berikutnya akan memperbaikinya sendiri.
- **HPP hanya seakurat stoknya.** Penjualan tanpa potongan stok (item `SERVICE`,
  atau invoice manual yang tidak menautkan varian) tidak punya movement `OUT`,
  jadi HPP-nya nol — dan itu benar: jasa memang tidak punya harga pokok barang.
- **Retur sebagian** memakai jalur `#BATAL` yang sama; bila suatu saat perlu retur
  parsial, mekanisme pembalikannya harus HPP-aware sejak awal, bukan ditambal.
- **Stok valuasi zakat perniagaan** masih angka yang dimasukkan manual oleh user
  (4.D.1). `costPrice` membuka jalan menghitungnya otomatis nanti; itu belum
  bagian dari tahap ini.


