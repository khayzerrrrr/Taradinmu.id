-- Tambah tabel penghitung rate limit (pengerasan produksi).
--
-- Alasan: /login dan /api/chat sebelumnya bisa dipanggil berulang tanpa batas.
-- Redis/Upstash tidak dipakai karena proyek ini sengaja tanpa infrastruktur
-- tambahan, sedangkan penjaga di memori proses tidak dapat diandalkan:
-- produksi berjalan di beberapa instance tanpa state bersama.
--
-- Bentuknya "fixed window": setiap jendela waktu punya satu baris per kunci,
-- dan "count" dinaikkan secara atomik lewat upsert.

CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- Satu baris per kunci per jendela: inilah yang membuat upsert-nya atomik.
CREATE UNIQUE INDEX "RateLimit_key_windowStart_key" ON "RateLimit"("key", "windowStart");

-- Dipakai saat membersihkan baris kedaluwarsa.
CREATE INDEX "RateLimit_windowStart_idx" ON "RateLimit"("windowStart");
