-- Masa berlaku paket + riwayat perubahannya (PRD 4.D.4).
--
-- Alasan migrasi ini ada: PRO dijual per bulan tetapi tidak ada kolom pun yang
-- mencatat kapan masa berlakunya habis, dan tidak ada tempat untuk melihat
-- perubahan paket yang sudah terjadi. Akibatnya tagih perpanjangan berjalan dari
-- ingatan, dan tenant yang berhenti membayar tetap PRO selamanya.
--
-- SELURUH migrasi ini TAMBAH SAJA. `planExpiresAt` boleh kosong dan kolom baru
-- itu TIDAK memberi makna baru pada baris lama: tenant PRO yang ada hari ini
-- tetap PRO (tanpa tanggal berakhir) sampai Super Admin mencatat masanya. Tidak
-- ada data usaha yang disentuh, dan tidak ada indeks lama yang diubah.

-- AlterTable
-- null = tanpa tanggal berakhir. FREE memang tidak berakhir, jadi kolom ini
-- hanya berarti bila `plan` = PRO.
ALTER TABLE "Tenant" ADD COLUMN     "planExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PlanChange" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "dari" "PlanType" NOT NULL,
    "ke" "PlanType" NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "olehUserId" TEXT,
    "catatan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Dibaca per tenant (riwayat di dialog "Kelola Tenant"), selalu diurutkan
-- berdasarkan waktu — persis bentuk indeks ini.
CREATE INDEX "PlanChange_tenantId_createdAt_idx" ON "PlanChange"("tenantId", "createdAt");

-- AddForeignKey
-- CASCADE: riwayat tanpa tenant induk tidak berarti apa pun, dan menghapus
-- tenant memang berarti menghapus seluruh miliknya.
ALTER TABLE "PlanChange" ADD CONSTRAINT "PlanChange_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- SET NULL, bukan CASCADE: baris riwayat jangan sampai hilang hanya karena akun
-- Super Admin yang mengubahnya dihapus nanti. Nilainya historis, bukan milik akun.
ALTER TABLE "PlanChange" ADD CONSTRAINT "PlanChange_olehUserId_fkey" FOREIGN KEY ("olehUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
