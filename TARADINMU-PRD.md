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

#### 1. Batasan Paket FREE (Starter)
- **Pengguna (Users):** Maksimal 1 User (Owner saja).
- **Invoice/Billing:** Maksimal 50 Invoice per bulan.
- **Inventory/Produk:** Maksimal 100 Item Produk (Tanpa fitur Batch/Expired Date).
- **Zakat:** Hanya Kalkulator Manual (Input angka sendiri) — tab "Zakat Perniagaan"; Zakat Penghasilan otomatis terkunci.
- **URL:** Hanya Path standar (`taradinmu.id/nama-toko`).
- **Branding:** Wajib menggunakan Logo & Tema Default TaradinMu.
- **Laporan:** Hanya Laporan Dasar (Laba Rugi Sederhana).

#### 2. Fitur Eksklusif PRO (TaradinMu Pro)
- **Pengguna:** Unlimited (Bisa tambah Admin, Staff, Akuntan).
- **Invoice/Billing:** Unlimited + Fitur Cicilan & Pembayaran Bertahap (untuk Travel/Kontraktor).
- **Inventory:** Unlimited + Fitur Batch, Expired Date, FEFO, dan Multi-Gudang.
- **Zakat:** **Otomatis** (Tarik data real-time dari Invoice & Pengeluaran).
- **URL:** Subdomain kustom (`nama-toko.taradinmu.id`).
- **Branding:** White-label (Ganti Logo, Warna Tema, Favicon).
- **Laporan:** Laporan Lengkap (Neraca, Arus Kas, Pajak).

#### 3. UI/UX "Upgrade Prompt" (Anti-Frustrasi)
- Jika user FREE mencoba mengakses fitur PRO, JANGAN langsung tolak dengan error merah.
- Tampilkan **Modal/Overlay Elegan** dengan efek *blur* di latar belakang.
- **Isi Modal:** Icon Kunci (Lucide), Judul "Fitur Premium", Deskripsi singkat manfaat fitur tersebut, dan Tombol CTA besar "Aktifkan TaradinMu Pro" (Warna Amber/Emas) + Tombol kecil "Nanti Saja".
- Pada tombol/menu di Sidebar yang terkunci, berikan **Icon Gembok (Lock)** kecil dengan warna abu-abu.

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

