-- Fase 0.2 — lebarkan presisi nominal & tambahkan identitas lokalitas tenant.
--
-- Dua perubahan yang tidak bisa ditunda kalau produk ini nanti berdiri di lebih
-- dari satu negara. Keduanya sekarang, sementara datanya masih kecil, jauh lebih
-- murah daripada dikerjakan setelah adaannesserial invoice yang menumpuk.
--
-- 1. Semua kolom uang: Decimal(12,2)/(14,2) -> Decimal(18,4)
--    Presisi 2 desimal inadequate untuk pasar selain Indonesia: tuple beberapa
--    negara Timur Tengah butuh 3 desimal, dan akumulasi nominal dalam satu tenant
--    bisa melampaui 10 digit bulat yang tersisa. Memperkecil presisi atau
--    membulatkan ke bawah akan mengubah angka yang sudah tercatat — itu
--    membohongi pembukuan yang sudah dipublikasikan ke pengguna.
--
-- 2. Tenant.currency & Tenant.timezone
--    currency menentukan format nominal; timezone menentukan "hari" untuk
--    seluruh perhitungan bisnis. Keduanya nullable-with-default sehingga
--    deploy ini tidak mengubah satu pun tenant yang sedang berjalan.

-- --- 1. Lebarkan kolom uang ---
ALTER TABLE "ProductVariant"   ALTER COLUMN "price"      TYPE DECIMAL(18,4);
ALTER TABLE "InventoryBatch"   ALTER COLUMN "costPrice"  TYPE DECIMAL(18,4);
ALTER TABLE "StockMovement"    ALTER COLUMN "unitCost"   TYPE DECIMAL(18,4);
ALTER TABLE "Invoice"          ALTER COLUMN "totalAmount" TYPE DECIMAL(18,4);
ALTER TABLE "Invoice"          ALTER COLUMN "taxAmount"  TYPE DECIMAL(18,4);
ALTER TABLE "InvoiceItem"      ALTER COLUMN "price"      TYPE DECIMAL(18,4);
ALTER TABLE "InvoiceItem"      ALTER COLUMN "subtotal"   TYPE DECIMAL(18,4);
ALTER TABLE "Expense"          ALTER COLUMN "amount"     TYPE DECIMAL(18,4);
ALTER TABLE "Program"          ALTER COLUMN "targetAmount" TYPE DECIMAL(18,4);
ALTER TABLE "Program"          ALTER COLUMN "budgetAmount" TYPE DECIMAL(18,4);
ALTER TABLE "ZakatCalculation" ALTER COLUMN "totalAssets"     TYPE DECIMAL(18,4);
ALTER TABLE "ZakatCalculation" ALTER COLUMN "totalLiabilities" TYPE DECIMAL(18,4);
ALTER TABLE "ZakatCalculation" ALTER COLUMN "netAssets"       TYPE DECIMAL(18,4);
ALTER TABLE "ZakatCalculation" ALTER COLUMN "nisab"           TYPE DECIMAL(18,4);
ALTER TABLE "ZakatCalculation" ALTER COLUMN "zakatDue"        TYPE DECIMAL(18,4);

-- --- 2. Identitas lokalitas tenant ---
--
-- DEFAULT sekaligus menutup kolom, jadi baris yang sudah ada ikut terisi tanpa
-- perlu UPDATE terpisah: perilaku deploy sama untuk tenant lama dan baru.
ALTER TABLE "Tenant" ADD COLUMN "currency" CHAR(3) NOT NULL DEFAULT 'IDR';
ALTER TABLE "Tenant" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta';

-- Catatan yang sengaja tidak dilakukan:
--
-- • Tidak ada UPDATE yang menulis ulang nilai lama. Nilai lama sudah presisi 2
--   desimal dan sudah dipublikasikan ke pengguna (kartu, laporan cetak, nota).
--   Mengubahnya sekarang berarti application's jawara berubah dari nilai yang
--   sama pada bulan yang sama.
--
-- • Kolom `ZakatCalculation.rate` (Decimal(5,4)) SENGAJA TIDAK disentuh: itu
--   persentase, bukan nominal. Menaikkan presisinya tidak menambah informasi.
