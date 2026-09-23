-- Bedakan barang dan jasa pada katalog item (PRD Bagian 4.C).
--
-- Alasan: invoice SELALU memotong stok (alokasiFefoKeluar) dan setiap baris
-- wajib merujuk varian produk, sehingga usaha jasa — travel umrah, laundry,
-- pendidikan, jasa profesional — tidak bisa menagih apa pun kecuali membuat
-- batch stok palsu.
--
-- Sifat barang/jasa sengaja disimpan EKSPLISIT di kolom ini, bukan disimpulkan
-- dari "variannya punya batch atau tidak". Kalau disimpulkan, barang yang
-- stoknya sedang kosong akan keliru dianggap jasa sehingga invoice berhenti
-- memotong stok tanpa ada yang menyadarinya.
--
-- Produk yang sudah ada otomatis menjadi GOODS lewat DEFAULT, jadi tidak perlu
-- backfill terpisah.

CREATE TYPE "ItemKind" AS ENUM ('GOODS', 'SERVICE');

ALTER TABLE "Product" ADD COLUMN "kind" "ItemKind" NOT NULL DEFAULT 'GOODS';

-- Dipakai untuk memutuskan apakah menu Stok perlu ditampilkan pada tenant ini.
CREATE INDEX "Product_tenantId_kind_idx" ON "Product"("tenantId", "kind");
