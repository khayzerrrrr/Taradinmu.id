-- Lengkapi modul tenant yang sudah ada: INVENTORY dan ACCOUNTING.
--
-- Alasan (dua kebuntuan nyata):
--
-- 1. INVENTORY — preset TRAVEL_UMROH, JASA_ORDER, dan EDUCATION hanya memberi
--    modul BILLING. Padahal pembuatan produk & varian digerbangi modul
--    INVENTORY, sehingga tenant usaha jasa tidak bisa membuat satu pun item yang
--    bisa ditagih: form invoice menyuruh membuka modul yang tidak mereka punya.
--    (Bukti tambahan: prisma/seed-demo.ts harus menyalakan INVENTORY secara
--    manual untuk tenant travel, menimpa preset-nya sendiri.)
--
-- 2. ACCOUNTING — tidak ada satu pun preset yang menyalakannya, sehingga tenant
--    baru tidak dapat mencatat pengeluaran dan kartu Arus Kas Bulan Ini serta
--    estimasi zakat selalu bernilai 0.
--
-- Modul hanya DITAMBAHKAN, tidak pernah dikurangi. COALESCE dan cabang IS NULL
-- disertakan supaya tenant dengan enabledModules kosong/NULL tetap ikut terisi,
-- bukan terlewat atau berubah menjadi NULL.

UPDATE "Tenant"
   SET "enabledModules" = (
     SELECT array_agg(DISTINCT modul)
       FROM unnest(
         COALESCE("enabledModules", ARRAY[]::text[]) || ARRAY['INVENTORY', 'ACCOUNTING']
       ) AS modul
   )
 WHERE "enabledModules" IS NULL
    OR NOT ("enabledModules" @> ARRAY['INVENTORY', 'ACCOUNTING']);
