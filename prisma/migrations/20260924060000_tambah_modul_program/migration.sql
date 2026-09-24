-- Modul Program (PRD 4.F): satu pusat biaya & pusat tagih untuk kebutuhan yang
-- dulu tertulis sebagai tiga modul industri berbeda — "CRM Data Jamaah" (travel
-- umrah), "Billing per Proyek" (kontraktor/EO), dan penagihan per tahun ajaran
-- (pendidikan). Ketiganya objek yang sama, jadi dibangun sekali.
--
-- SELURUH migrasi ini bersifat TAMBAH SAJA: tabel baru masih kosong dan kolom
-- baru nullable, sehingga tidak ada satu pun baris lama yang berubah makna.
-- Produksi sudah berisi tenant sungguhan, jadi tidak ada ALTER yang merusak.

-- CreateEnum
CREATE TYPE "ProgramStatus" AS ENUM ('PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" "ProgramStatus" NOT NULL DEFAULT 'PLANNING',
    "targetAmount" DECIMAL(14,2),
    "budgetAmount" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramParticipant" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "ProgramParticipant_pkey" PRIMARY KEY ("id")
);

-- AlterTable
-- Kolom "programId" pada Invoice dan Expense sengaja NULL-able: program hanya
-- MELABELI uang yang sudah tercatat, bukan menjadi pembukuan kedua (PRD 4.F.2).
ALTER TABLE "Invoice" ADD COLUMN "programId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "programId" TEXT;

-- CreateIndex
CREATE INDEX "Program_tenantId_status_idx" ON "Program"("tenantId", "status");
CREATE INDEX "ProgramParticipant_customerId_idx" ON "ProgramParticipant"("customerId");
CREATE UNIQUE INDEX "ProgramParticipant_programId_customerId_key" ON "ProgramParticipant"("programId", "customerId");
CREATE INDEX "Invoice_programId_idx" ON "Invoice"("programId");
CREATE INDEX "Expense_programId_idx" ON "Expense"("programId");

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramParticipant" ADD CONSTRAINT "ProgramParticipant_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProgramParticipant" ADD CONSTRAINT "ProgramParticipant_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ON DELETE SET NULL: menghapus program tidak boleh menghapus invoice atau
-- pengeluaran yang sempat menautinya (PRD 4.F.9).
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill modul untuk tenant PRO yang sudah terdaftar lebih dulu (PRD 4.F.9).
-- "enabledModules" hanya diisi sekali saat registrasi, jadi tanpa langkah ini
-- pelanggan berbayar yang justru berhak memakai fitur baru ini malah tidak
-- melihatnya sama sekali.
UPDATE "Tenant"
SET "enabledModules" = array_append("enabledModules", 'PROGRAM')
WHERE "plan" = 'PRO'
  AND NOT ('PROGRAM' = ANY("enabledModules"));
