-- Satu jurnal AKTIF per (tenantId, refType, refId, source) untuk dokumen yang
-- bukan pembalik. Idempotensi yang sebelumnya dijaga aplikasi (cari jurnal aktif
-- sebelum memposting) sekarang dijaga DATABASE: indeks parsial unik ini membuat
-- duplikasi aktif tidak mungkin terjadi, bahkan lewat dua permintaan bersamaan.
--
-- "Jurnal mati" = jurnal yang sudah dibatalkan (punya pembalik). Karena pembalik
-- menyimpan `reversedFromId`, penyebut berikut dijamin bebas konflik:
--   * konflik busur = referensi valid tersimpan di BANYAK jurnal
--   * jurnal aktif = diBalik = false
--   * source REVERSAL dikeluarkan: pembalik boleh membalik banyak dokumen
-- Migrasi ini memberi kolom `diBalik` + nilai baliknya untuk data yang sudah ada.

-- 1) Kolom baru (nullable dulu, dibackfill, lalu dibuat NOT NULL).
ALTER TABLE "JournalEntry"
  ADD COLUMN "diBalik" BOOLEAN;

-- 2) Backfill: setiap jurnal yang menjadi target pembalik dianggap "diBalik".
UPDATE "JournalEntry" AS asli
SET "diBalik" = true
FROM "JournalEntry" AS pembalik
WHERE pembalik."reversedFromId" IS NOT NULL
  AND pembalik."reversedFromId" = asli."id";

-- 3) Sisanya pasti belum dibalik.
UPDATE "JournalEntry" SET "diBalik" = false WHERE "diBalik" IS NULL;

-- 4) Kunci NOT NULL sekarang aman.
ALTER TABLE "JournalEntry"
  ALTER COLUMN "diBalik" SET NOT NULL,
  ALTER COLUMN "diBalik" SET DEFAULT false;

-- 5) Indeks parsial unik: SATU jurnal aktif per dokumen sumber non-pembalik.
--    `diBalik = true` menghapus jurnal asli dari kompetisi, sehingga dokumen yang
--    dibatalkan boleh diposting lagi (jurnal baru diBalik=false tidak bentrok).
CREATE UNIQUE INDEX "JournalEntry_satu_aktif_per_dokumen"
  ON "JournalEntry" ("tenantId", "source", "refType", "refId")
  WHERE "refType" IS NOT NULL
    AND "refId" IS NOT NULL
    AND "source" <> 'REVERSAL'
    AND "diBalik" = false;