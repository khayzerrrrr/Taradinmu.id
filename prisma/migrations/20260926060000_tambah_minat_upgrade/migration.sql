-- Pencatatan minat upgrade (PRD 4.D.5): gembok mana yang diklik tenant FREE,
-- dan ajakan mana yang benar-benar sampai ke tombol WhatsApp.
--
-- Alasan tabel ini ada: urutan pengerjaan fitur PRO dipilih tanpa data. Klik pada
-- gembok batch vs gembok zakat adalah bukti langsung fitur mana yang dirindukan
-- tenant sungguhan, tetapi selama ini tidak tercatat di tempat yang bisa dibaca
-- ulang — hanya lewat log server yang dibuang.
--
-- SELURUH migrasi ini TAMBAH SAJA: tabel baru masih kosong, tidak ada kolom baru
-- di tabel lama, dan tidak ada satu pun baris tenant yang berubah makna. Produksi
-- sudah berisi tenant sungguhan.
--
-- Sengaja tidak ada kolom yang menerima teks bebas dari pengguna: `kunci`,
-- `sumber`, dan `tahap` semuanya diisi dari daftar statis di kode
-- (src/lib/upgrade-interest.ts), supaya tabel ini tidak bisa dipakai menampung
-- data usaha maupun nilai rahasia.

-- CreateTable
CREATE TABLE "UpgradeInterest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kunci" TEXT NOT NULL,
    "sumber" TEXT NOT NULL,
    "tahap" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UpgradeInterest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Tampilan utamanya adalah "tenant ini beberapa kali mengklik gembok, dan apa
-- saja kuncinya" — difilter per tenant lalu per waktu (lihat window 30 hari di
-- getAllTenants), sehingga indeksnya sepasang dengan urutan penyaringan itu.
CREATE INDEX "UpgradeInterest_tenantId_createdAt_idx" ON "UpgradeInterest"("tenantId", "createdAt");

-- Pertanyaan berikutnya adalah lintas tenant: kunci mana yang paling sering
-- diklik minggu ini. Tanpa indeks ini jawabannya pemindaian penuh.
CREATE INDEX "UpgradeInterest_kunci_createdAt_idx" ON "UpgradeInterest"("kunci", "createdAt");

-- AddForeignKey
-- ON DELETE CASCADE: catatan minat hanya berguna sebagai milik suatu tenant.
-- Ini satu-satunya cascade di skema ini, dan aman karena barisnya bukan data
-- usaha — menghapus tenant tetap tidak boleh menyisakan jejak klik yatim.
ALTER TABLE "UpgradeInterest" ADD CONSTRAINT "UpgradeInterest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
