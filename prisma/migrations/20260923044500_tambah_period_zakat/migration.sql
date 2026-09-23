-- Tambah periode laporan zakat (PRD Bagian 4.D.3).
--
-- Alasan: laporan zakat harus diserahkan ke LAZISMU/BAZNAS per bulan, tetapi
-- "ZakatCalculation" sebelumnya hanya menyimpan "calculationDate" — yaitu waktu
-- input. Akibatnya riwayat tidak bisa dikelompokkan per periode laporan, dan
-- zakat satu bulan bisa tercampur dengan bulan lain.
--
-- "calculationDate" sengaja tetap dipertahankan sebagai jejak waktu input;
-- periode disimpan terpisah agar tetap benar bila perhitungan dilakukan menyusul.

-- 1. Kolom periode. Nullable supaya baris lama tetap sah selama migrasi.
ALTER TABLE "ZakatCalculation" ADD COLUMN "periodMonth" INTEGER;
ALTER TABLE "ZakatCalculation" ADD COLUMN "periodYear"  INTEGER;

-- 2. Isi periode baris lama dari tanggal perhitungannya (UTC).
UPDATE "ZakatCalculation"
   SET "periodYear"  = EXTRACT(YEAR  FROM "calculationDate")::integer,
       "periodMonth" = EXTRACT(MONTH FROM "calculationDate")::integer
 WHERE "periodYear" IS NULL;

-- 3. Index untuk mengelompokkan dan mengurutkan riwayat per periode.
CREATE INDEX "ZakatCalculation_tenantId_periodYear_periodMonth_idx"
  ON "ZakatCalculation"("tenantId", "periodYear", "periodMonth");
