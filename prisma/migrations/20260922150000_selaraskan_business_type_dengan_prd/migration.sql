-- Selaraskan BusinessType dengan PRD Bagian 4.C.
--
-- Alasan: enum lama tidak memiliki nilai untuk Travel Umrah, Jasa Order, Project,
-- Trading, Pendidikan, dan Klinik — padahal itu justru target pasar PRD. Dua nilai
-- lama (PHARMACY, MANUFACTURING) tidak ada di PRD.
--
-- Karena nilai enum di PostgreSQL tidak bisa diubah di tempat, tipe dibuat ulang,
-- data dipetakan secara eksplisit, lalu tipe lama dibuang.

-- 1. Tipe baru dengan delapan nilai PRD.
CREATE TYPE "BusinessType_new" AS ENUM (
  'RETAIL_FNB',
  'TRAVEL_UMROH',
  'JASA_ORDER',
  'PROJECT_BASED',
  'TRADING',
  'EDUCATION',
  'HEALTH_CLINIC',
  'OTHER'
);

-- 2. Pindahkan kolom ke tipe baru. Default dilepas dulu supaya tidak memaksa cast.
ALTER TABLE "Tenant" ALTER COLUMN "businessType" DROP DEFAULT;

ALTER TABLE "Tenant" ALTER COLUMN "businessType" TYPE "BusinessType_new"
  USING (
    CASE "businessType"::text
      WHEN 'RETAIL'        THEN 'RETAIL_FNB'
      WHEN 'FNB'           THEN 'RETAIL_FNB'
      WHEN 'PHARMACY'      THEN 'HEALTH_CLINIC'
      WHEN 'SERVICE'       THEN 'JASA_ORDER'
      WHEN 'MANUFACTURING' THEN 'PROJECT_BASED'
      ELSE 'OTHER'
    END
  )::"BusinessType_new";

-- 3. Buang tipe lama, lalu pakai kembali nama "BusinessType".
DROP TYPE "BusinessType";

ALTER TYPE "BusinessType_new" RENAME TO "BusinessType";

ALTER TABLE "Tenant" ALTER COLUMN "businessType" SET DEFAULT 'OTHER';

-- 4. Koreksi satu kali untuk tenant yang sudah ada.
--    "Berkah Haramain Travel" sebelumnya tercatat SERVICE karena enum lama tidak
--    punya nilai travel. Kategori yang tersimpan memang kategori travel
--    (Paket Umrah, Paket Haji, Tiket & Visa), jadi kini dipetakan dengan benar.
UPDATE "Tenant"
   SET "businessType" = 'TRAVEL_UMROH'
 WHERE "slug" = 'berkah-haramain';
