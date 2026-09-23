-- Tambah index untuk kuota invoice bulanan (PRD Bagian 4.D).
--
-- Alasan: batas paket FREE adalah 50 invoice PER BULAN, sehingga setiap kali
-- invoice dibuat, `feature-guards.ts` menghitung:
--
--   SELECT COUNT(*) FROM "Invoice" WHERE "tenantId" = $1 AND "createdAt" >= $2
--
-- Sebelum ini "Invoice" hanya punya index unik pada "invoiceNumber", jadi
-- hitungan tersebut memindai seluruh baris tenant. Index gabungan di bawah
-- membuatnya menjadi pencarian rentang.

CREATE INDEX "Invoice_tenantId_createdAt_idx" ON "Invoice"("tenantId", "createdAt");
