-- Fase 1 -- tabel GL: LedgerAccount, JournalEntry, Posting, AccountingPeriod.
--
-- Tiga keputusan yang tidak bisa dibongkar tanpa menurunkan pembukuan:
--
-- 1. Tabelnya `LedgerAccount`, bukan `Account`. `Account` di skema ini sudah
--    dipakai NextAuth untuk OAuth; nama yang sama untuk dua hal berbeda
--    menghasilkan salah baca yang bertahan lama.
--
-- 2. `Posting` memakai SATU kolom amount + kolom `side`, bukan debit dan credit
--    terpisah. Dua kolom memaksa setiap pembaca menambahkan kalimat "yang mana
--    yang nonzero", dan menyisakan keadaan "terisi keduanya" yang tidak pernah
--    terlihat sampai laporan salah.
--
-- 3. Constraint di bawah TIDAK bisa dibuat Prisma, jadi ditulis tangan. Inilah
--    bagian yang menjaga pembukuan tetap benar meski aplikasi punya bug:
--      - nominal harus positif; baris nol memenuhi "debit = kredit" tanpa
--        menjelaskan transaksi apa pun
--      - satu akun satu kali per jurnal
--      - jurnal wajib seimbang per mata uang, dicek saat COMMIT (deferred), bukan
--        setelah tiap INSERT -- karena jurnal memang ditulis baris demi baris
--      - periode CLOSED tidak boleh menerima jurnal baru
--    Menaruh aturan ini hanya di aplikasi berarti cukup satu bug lolos untuk
--    menghasilkan buku besar yang tidak seimbang tanpa ada yang menyadarinya.
--
-- Append-only dijaga lewat hak akses role database (ARSITEKTUR.md 3), bukan
-- lewat trigger: trigger yang menolak UPDATE akan ikut menolak pembalikan periode
-- yang sah, dan tidak ada proses yang perlu mengubah baris ini.
--
-- CATATAN VERIFIKASI: trigger di bawah adalah PL/pgSQL dan hanya bisa diuji di
-- PostgreSQL sungguhan. `prisma dev` adalah emulator berbasis SQLite yang
-- menerjemahkan SQL -- ia melaporkan "berhasil" tanpa pernah menjalankan
-- trigger. Karena itu semua constraint di bawah dibuktikan memakai Docker
-- postgres:17 (lihat scripts/bukti-constraint-gl.ts).
-- CreateEnum

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "JournalSource" AS ENUM ('INVOICE', 'PAYMENT', 'STOCK', 'EXPENSE', 'MANUAL', 'OPENING', 'REVERSAL', 'CLOSING');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "PostingSide" AS ENUM ('DEBIT', 'CREDIT');

-- CreateTable
CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'IDR',
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessDate" TIMESTAMP(3) NOT NULL,
    "period" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3),
    "source" "JournalSource" NOT NULL,
    "reference" TEXT,
    "refType" TEXT,
    "refId" TEXT,
    "description" TEXT,
    "currency" CHAR(3) NOT NULL DEFAULT 'IDR',
    "reversedFromId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Posting" (
    "id" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "side" "PostingSide" NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'IDR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Posting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingPeriod" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LedgerAccount_tenantId_type_idx" ON "LedgerAccount"("tenantId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_tenantId_code_key" ON "LedgerAccount"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_reversedFromId_key" ON "JournalEntry"("reversedFromId");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_businessDate_idx" ON "JournalEntry"("tenantId", "businessDate");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_period_idx" ON "JournalEntry"("tenantId", "period");

-- CreateIndex
CREATE INDEX "JournalEntry_refType_refId_idx" ON "JournalEntry"("refType", "refId");

-- CreateIndex
CREATE INDEX "Posting_journalId_idx" ON "Posting"("journalId");

-- CreateIndex
CREATE INDEX "Posting_accountId_idx" ON "Posting"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Posting_journalId_accountId_key" ON "Posting"("journalId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPeriod_tenantId_period_key" ON "AccountingPeriod"("tenantId", "period");

-- AddForeignKey
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "LedgerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Posting" ADD CONSTRAINT "Posting_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Posting" ADD CONSTRAINT "Posting_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- CONSTRAINT TULISAN TANGAN (tidak bisa dibuat Prisma)
-- ============================================================================

-- Nominal harus positif. Baris nol adalah pembukuan yang tidak berarti: ia
-- memenuhi "debit = kredit" tanpa menjelaskan transaksi apa pun.
ALTER TABLE "Posting"
  ADD CONSTRAINT "posting_nominal_positif" CHECK ("amount" > 0);

-- Jurnal tidak boleh satu akun muncul dua kali. Tanpa ini satu akun bisa
-- terbaca sebagai satu baris di buku besar padahal sebenarnya dua, dan saldo
-- yang tampil berbohong.
ALTER TABLE "Posting"
  ADD CONSTRAINT "posting_satu_akun_sekali" UNIQUE ("journalId", "accountId");

-- Periode tertutup tidak boleh menerima jurnal baru.
--
-- Dijalankan sebagai trigger BEFORE INSERT, bukan CHECK: yang perlu dicek ada di
-- tabel LAIN, dan CHECK tidak boleh melihat baris tabel lain.
CREATE OR REPLACE FUNCTION "tolak_posting_ke_periode_tutup"()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "AccountingPeriod" p
     WHERE p."tenantId" = NEW."tenantId"
       AND p."period" = NEW."period"
       AND p."status" = 'CLOSED'
  ) THEN
    RAISE EXCEPTION
      'Periode % sudah ditutup untuk tenant %; koreksi lewat jurnal pembalik, bukan menambah baris baru.',
      NEW."period", NEW."tenantId"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "jurnal_tidak_ke_periode_tutup"
  BEFORE INSERT ON "JournalEntry"
  FOR EACH ROW EXECUTE FUNCTION "tolak_posting_ke_periode_tutup"();

-- Jurnal wajib seimbang per mata uang.
--
-- DEFERRABLE INITIALLY DEFERRED karena jurnal memang ditulis BARIS DEMI BARIS:
-- pada INSERT posting pertama belum ada kredit untuk diseimbangkan. Yang dicek
-- adalah keadaan pada COMMIT -- titik di mana jurnal dianggap selesai, dan satu-
---satunya tempat di mana ketidakseimbangan sudah berarti apa pun.
CREATE OR REPLACE FUNCTION "cek_jurnal_seimbang"()
RETURNS TRIGGER AS $$
DECLARE
  v_journal TEXT;
  v_debit   NUMERIC;
  v_kredit  NUMERIC;
BEGIN
  v_journal := COALESCE(NEW."journalId", OLD."journalId");

  SELECT
    COALESCE(SUM("amount") FILTER (WHERE "side" = 'DEBIT'), 0),
    COALESCE(SUM("amount") FILTER (WHERE "side" = 'CREDIT'), 0)
  INTO v_debit, v_kredit
  FROM "Posting"
  WHERE "journalId" = v_journal;

  IF v_debit <> v_kredit THEN
    RAISE EXCEPTION
      'Jurnal % tidak seimbang: debit % <> kredit %.', v_journal, v_debit, v_kredit
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "jurnal_seimbang_pada_commit"
  AFTER INSERT OR UPDATE OR DELETE ON "Posting"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "cek_jurnal_seimbang"();

-- Jurnal tidak boleh kosong: jurnal tanpa posting tidak ada artinya, dan
-- membiarkannya membuat hitungan "berapa jurnal bulan ini" lebih besar dari
-- jumlah jurnal yang benar-benar tercatat.
CREATE OR REPLACE FUNCTION "tolak_jurnal_kosong_pada_commit"()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Posting" WHERE "journalId" = NEW."id") THEN
    RAISE EXCEPTION 'Jurnal % tidak punya satu pun posting.', NEW."id"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "jurnal_tidak_kosong_pada_commit"
  AFTER INSERT ON "JournalEntry"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "tolak_jurnal_kosong_pada_commit"();

-- Satu jurnal tidak boleh dibatalkan dua kali.
--
-- Kolomnya sudah UNIQUE, jadi aturan ini sebenarnya sudah ditegakkan; trigger
-- hanya mengulanginya dengan pesan yang bisa dibaca aplikasi.
--
-- Yang membuat revise perlu: aturan "dibalik oleh jurnal lain" pernah ditulis
-- sebagai self-relation dua arah, lalu terbukti tidak ada di database sama
-- sekali -- Prisma hanya membuat SATU kolom FK untuk self-relation satu-arah,
-- sehingga trigger ini gagal dengan "record new has no field reversedFromId".
-- Karena itu hanya satu sisi yang disimpan, dan sisi lainnya dijawab lewat
-- `reversedFromId`.
CREATE OR REPLACE FUNCTION "tolak_pembatalan_ganda"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."reversedFromId" IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM "JournalEntry" j
        WHERE j."reversedFromId" = NEW."reversedFromId"
          AND j."id" <> NEW."id"
     ) THEN
    RAISE EXCEPTION 'Jurnal ini sudah pernah dibatalkan oleh jurnal lain.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "pembatalan_hanya_sekali"
  AFTER INSERT ON "JournalEntry"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "tolak_pembatalan_ganda"();
-- Akun yang dipakai harus milik tenant yang sama dengan jurnalnya.
--
-- GAP NYATA yang ditemukan uji ini: schema hanya menyatakan
-- Posting.journalId -> JournalEntry dan Posting.accountId -> LedgerAccount
-- secara terpisah. Database tidak punya aturan yang mengaitkan keduanya, jadi
-- secara teknis mungkin menulis Akun milik tenant A ke jurnal milik tenant B.
-- Aplikasi yang salah satu Server Action-nya bisa membocorkan angka usaha satu
-- tenant ke pembukuan tenant lain -- dan karena tabelnya append-only, baris itu
-- tidak bisa dihapus tanpa membuat jurnal pembalik.
--
-- Prisma tidak bisa menyatakan CHECK lintas tabel, jadi dijaga trigger.
CREATE OR REPLACE FUNCTION "tolak_posting_lintas_tenant"()
RETURNS TRIGGER AS $$
DECLARE
  v_tenantJurnal TEXT;
  v_tenantAkun   TEXT;
BEGIN
  SELECT j."tenantId" INTO v_tenantJurnal
    FROM "JournalEntry" j WHERE j."id" = NEW."journalId";

  SELECT a."tenantId" INTO v_tenantAkun
    FROM "LedgerAccount" a WHERE a."id" = NEW."accountId";

  IF v_tenantJurnal IS DISTINCT FROM v_tenantAkun THEN
    RAISE EXCEPTION
      'Akun % milik tenant % tidak boleh dipakai di jurnal tenant %.',
      NEW."accountId", v_tenantAkun, v_tenantJurnal
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "posting_tenant_cocok"
  BEFORE INSERT ON "Posting"
  FOR EACH ROW EXECUTE FUNCTION "tolak_posting_lintas_tenant"();

-- Mata uang posting harus sama dengan mata uang akun. Jurnal dicatat dalam satu
-- mata uang; membiarkan posting foreign-currency lolos membuat "jurnal
-- seimbang" menghitung jumlah dari dua satuan yang berbeda -- yang secara
-- teknis seimbang dan secara ekonomi salah.
CREATE OR REPLACE FUNCTION "tolak_mata_uang_posting"()
RETURNS TRIGGER AS $$
DECLARE
  v_mataJurnal TEXT;
  v_mataAkun   TEXT;
BEGIN
  SELECT j."currency" INTO v_mataJurnal
    FROM "JournalEntry" j WHERE j."id" = NEW."journalId";

  SELECT a."currency" INTO v_mataAkun
    FROM "LedgerAccount" a WHERE a."id" = NEW."accountId";

  IF v_mataJurnal IS DISTINCT FROM v_mataAkun THEN
    RAISE EXCEPTION
      'Mata uang posting (%) harus sama dengan mata uang jurnal (%).',
      v_mataAkun, v_mataJurnal
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "posting_mata_uang_cocok"
  BEFORE INSERT ON "Posting"
  FOR EACH ROW EXECUTE FUNCTION "tolak_mata_uang_posting"();