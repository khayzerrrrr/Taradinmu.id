-- HPP & pemasok (PRD 4.G): harga modal per batch, salinan modal pada setiap
-- pergerakan keluar, dan master data tempat barang dibeli.
--
-- Alasan kolom ini ada: sebelum tahap ini, satu rupiah pembelian stok mengurangi
-- "laba" dan dasar zakat penghasilan, padahal barangnya masih menumpuk jadi aset.
-- Toko yang belanja besar pada bulan ini tampak merugi — dan zakatnya ikut salah.
-- Perbaikan pemisahan angka itu sendiri tidak butuh skema (logika di
-- src/lib/laba.ts); yang dibutuhkan skema adalah HPP: supaya laba bisa dikurangi
-- harga pokok barang yang TERBUKTI terjual, sistem harus tahu harga modal tiap
-- batch dan memotret saat ia dipakai.
--
-- SELURUH migrasi ini TAMBAH SAJA: tabel baru masih kosong dan semua kolom baru
-- nullable, jadi tidak ada satu pun baris lama yang berubah makna. Produksi sudah
-- berisi tenant sungguhan.

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- AlterTable
-- "costPrice" di batch, BUKAN di varian: harga beli berubah dari waktu ke waktu,
-- dan satu harga di level varian akan membuat HPP bulan lalu ikut berubah setelah
-- pembelian berikutnya — laporan yang tidak bisa direkonsiliasi.
ALTER TABLE "InventoryBatch" ADD COLUMN "costPrice" DECIMAL(12,2);

-- Nullable: stok awal atau pembelian tanpa pemasok tetap sah.
ALTER TABLE "InventoryBatch" ADD COLUMN "supplierId" TEXT;

-- Salinan costPrice pada SAAT potongan terjadi. Kalau harga batch dikoreksi
-- belakangan, HPP yang sudah tercatat tidak boleh ikut berubah (PRD 4.G.3).
ALTER TABLE "StockMovement" ADD COLUMN "unitCost" DECIMAL(12,2);

-- CreateIndex
-- Daftar pemasok per tenant adalah tampilan utamanya. Nama sengaja tidak dibuat
-- UNIQUE: dua cabang boleh punya pemasok bernama sama, dan menolaknya hanya
-- menghasilkan kebingungan tanpa memperbaiki angka apa pun.
CREATE INDEX "Supplier_tenantId_idx" ON "Supplier"("tenantId");
CREATE INDEX "InventoryBatch_supplierId_idx" ON "InventoryBatch"("supplierId");

-- HPP per dokumen (PRD 4.G.3) dan pengembalian stok sama-sama menyaring pada
-- (type, reference); tanpa index keduanya menjadi pemindaian penuh.
CREATE INDEX "StockMovement_type_reference_idx" ON "StockMovement"("type", "reference");

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ON DELETE SET NULL: menghapus pemasok tidak boleh menghapus batch yang pernah
-- masuk darinya — barang itu masih ada di rak (aturan yang sama dengan programId
-- pada Invoice/Expense, PRD 4.F.9).
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
