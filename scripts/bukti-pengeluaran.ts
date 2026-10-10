// Bukti F1.8 (pengeluaran): siklus hidup jurnal pengeluaran terhadap PostgreSQL nyata.
//
// Yang dibuktikan di sini adalah hal yang TIDAK bisa dibuktikan tanpa database,
// dan justru yang paling mudah salah:
//
//   1. jurnal pengeluaran benar-benar menyentuh akun beban (bukan akun lain);
//   2. pengeluaran lewat bank mengkredit BANK, bukan kas;
//   3. kategori PURCHASE DITOLAK sebagai beban (barang belum tentu terjual);
//   4. SEBUAH DOKUMEN YANG DIBALIK LALU DIBUAT ULANG benar-benar menghasilkan
//      jurnal baru -- `jurnalAktifId` tidak salah menganggap jurnal lama yang
//      sudah mati sebagai "sudah ada";
//   5. satu jurnal tidak bisa dibatalkan dua kali (dijaga UNIQUE di database).
//
// Golongannya: GAGAL = keluar kode 1. Pembukuan yang salah diam-diam lebih
// berbahaya daripada pembukuan yang belum jadi.
//
// Jalankan: npx tsx scripts/bukti-pengeluaran.ts   (butuh DATABASE_URL PostgreSQL)

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { KODE_AKUN, PETA_BEBAN } from "../src/modules/accounting/coa";
import { tanamCoa } from "../src/modules/accounting/tanam-coa";
import {
  jurnalDariPengeluaran,
  jurnalPembalik,
  type HasilRacik,
  type JurnalRancangan,
} from "../src/modules/accounting/engine-jurnal";
import { jurnalAktifId } from "../src/modules/accounting/jurnal-aktif";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

let gagal = 0;
function cek(nama: string, nyata: unknown, harus: unknown) {
  const ok = JSON.stringify(nyata) === JSON.stringify(harus);
  if (!ok) gagal++;
  const tampil = (v: unknown) =>
    typeof v === "number" ? v.toLocaleString("id-ID") : JSON.stringify(v);
  console.log(
    `  ${ok ? "OK  " : "GAGAL"} ${nama.padEnd(52)} nyata ${tampil(nyata)} | harus ${tampil(harus)}`,
  );
}

async function simpan(tenantId: string, j: JurnalRancangan, mataUang: string) {
  const kodeKeId = new Map<string, string>();
  for (const a of await prisma.ledgerAccount.findMany({
    where: { tenantId },
    select: { id: true, code: true },
  })) {
    kodeKeId.set(a.code, a.id);
  }
  return prisma.$transaction(async (tx) => {
    const entry = await tx.journalEntry.create({
      data: {
        tenantId,
        businessDate: j.businessDate,
        period: j.businessDate.toISOString().slice(0, 7),
        source: j.source,
        reference: j.reference ?? null,
        refType: j.refType ?? null,
        refId: j.refId ?? null,
        description: j.description ?? null,
        currency: mataUang,
        reversedFromId: j.reversedFromId ?? null,
      },
      select: { id: true },
    });
    await tx.posting.createMany({
      data: j.postings.map((p) => {
        const accountId = kodeKeId.get(p.kode);
        if (!accountId) throw new Error(`Akun ${p.kode} tidak ada pada tenant ini`);
        return {
          journalId: entry.id,
          accountId,
          amount: p.nominal,
          side: p.sisi,
          currency: mataUang,
        };
      }),
    });
    if (j.reversedFromId) {
      await tx.journalEntry.update({
        where: { id: j.reversedFromId },
        data: { diBalik: true },
      });
    }
    return entry.id;
  });
}

function racik(hasil: HasilRacik): JurnalRancangan {
  if (!hasil.ok) throw new Error(`Racikan jurnal gagal: ${hasil.alasan}`);
  return hasil.jurnal;
}

/** Saldo satu akun: debit - kredit. Positif = debit. */
async function saldoAkun(tenantId: string, kode: string): Promise<number> {
  const akun = await prisma.ledgerAccount.findFirst({
    where: { tenantId, code: kode },
    select: { id: true },
  });
  if (!akun) return 0;
  const postings = await prisma.posting.findMany({
    where: { journal: { tenantId }, accountId: akun.id },
    select: { amount: true, side: true },
  });
  let saldo = 0;
  for (const p of postings) {
    saldo += p.side === "DEBIT" ? Number(p.amount) : -Number(p.amount);
  }
  return saldo;
}

async function main() {
  const tenant = await prisma.tenant.create({
    data: { name: "Bukti Pengeluaran", slug: `bukti-pengeluaran-${Date.now()}` },
  });
  const t = tenant.id;
  const mataUang = tenant.currency;
  await tanamCoa(t, mataUang);

  const kodeBeban = KODE_AKUN[PETA_BEBAN.OPERATIONAL];
  const d = new Date("2026-10-05T00:00:00Z");
  const ID_EXPENSE = "exp-bukti-1";

  // --- 1. Pengeluaran operasional tunai 500.000 -------------------------
  console.log("\nPENGELUARAN BARU (operasional, tunai 500.000)");
  const j1 = racik(
    jurnalDariPengeluaran({
      businessDate: d,
      reference: "NOTA-1",
      refId: ID_EXPENSE,
      nominal: 500_000,
      kategori: "OPERATIONAL",
    }),
  );
  const id1 = await simpan(t, j1, mataUang);
  cek("Beban (debit)", await saldoAkun(t, kodeBeban), 500_000);
  cek("Kas (kredit -> -500.000)", await saldoAkun(t, KODE_AKUN.kas), -500_000);
  cek("Bank tidak tersentuh", await saldoAkun(t, KODE_AKUN.bank), 0);
  cek(
    "Jurnal aktif ditemukan",
    await jurnalAktifId(t, {
      refType: "expense",
      refId: ID_EXPENSE,
      source: "EXPENSE",
    }),
    id1,
  );

  // --- 2. Pengeluaran lewat bank mengkredit BANK ------------------------
  console.log("\nPENGELUARAN LEWAT BANK (utilitas, transfer 200.000)");
  const jBank = racik(
    jurnalDariPengeluaran({
      businessDate: d,
      reference: "NOTA-2",
      refId: "exp-bukti-2",
      nominal: 200_000,
      kategori: "UTILITIES",
      lewatBank: true,
    }),
  );
  await simpan(t, jBank, mataUang);
  cek("Beban utilitas (debit)", await saldoAkun(t, KODE_AKUN.bebanUtilitas), 200_000);
  cek("Bank (kredit -> -200.000)", await saldoAkun(t, KODE_AKUN.bank), -200_000);
  cek("Kas tidak tersentuh oleh transfer", await saldoAkun(t, KODE_AKUN.kas), -500_000);

  // --- 3. PURCHASE ditolak sebagai beban --------------------------------
  console.log("\nKATEGORI PURCHASE DITOLAK SEBAGAI BEBAN");
  const hasilPurchase = jurnalDariPengeluaran({
    businessDate: d,
    reference: "NOTA-3",
    refId: "exp-bukti-3",
    nominal: 1_000_000,
    kategori: "PURCHASE",
  });
  cek("Racikan PURCHASE tidak ok", hasilPurchase.ok, false);

  // --- 4. Dibalik lalu dibuat ulang -------------------------------------
  console.log("\nDIBALIK (500.000) LALU DIBUAT ULANG (300.000)");
  const pembalik = racik(
    jurnalPembalik(
      {
        id: id1,
        businessDate: j1.businessDate,
        postings: j1.postings,
      },
      new Date("2026-10-06T00:00:00Z"),
    ),
  );
  await simpan(t, pembalik, mataUang);
  cek(
    "Setelah pembatalan: tidak ada jurnal aktif",
    await jurnalAktifId(t, {
      refType: "expense",
      refId: ID_EXPENSE,
      source: "EXPENSE",
    }),
    null,
  );
  cek("Beban kembali ke 0", await saldoAkun(t, kodeBeban), 0);
  cek("Kas kembali ke 0", await saldoAkun(t, KODE_AKUN.kas), 0);

  const j1ulang = racik(
    jurnalDariPengeluaran({
      businessDate: new Date("2026-10-07T00:00:00Z"),
      reference: "NOTA-1-rev",
      refId: ID_EXPENSE,
      nominal: 300_000,
      kategori: "OPERATIONAL",
    }),
  );
  const id2 = await simpan(t, j1ulang, mataUang);
  const aktifSetelahUlang = await jurnalAktifId(t, {
    refType: "expense",
    refId: ID_EXPENSE,
    source: "EXPENSE",
  });
  cek("Jurnal baru benar-benar dibuat", aktifSetelahUlang !== null, true);
  cek("Yang aktif adalah jurnal BARU, bukan yang lama", aktifSetelahUlang === id2, true);
  cek("Yang aktif bukan jurnal lama yang sudah mati", aktifSetelahUlang === id1, false);
  cek("Beban berisi nilai baru saja (300.000)", await saldoAkun(t, kodeBeban), 300_000);
  cek("Kas mencerminkan nilai baru (-300.000)", await saldoAkun(t, KODE_AKUN.kas), -300_000);

  // --- 5. Satu jurnal tidak bisa dibatalkan dua kali --------------------
  console.log("\nPEMBATALAN GANDA DITOLAK DATABASE");
  let ditolak = false;
  try {
    await simpan(t, pembalik, mataUang);
  } catch {
    ditolak = true;
  }
  cek("Pembalikan kedua atas jurnal yang sama ditolak", ditolak, true);

  // --- Bersihkan --------------------------------------------------------
  await prisma.posting.deleteMany({ where: { journal: { tenantId: t } } });
  await prisma.journalEntry.deleteMany({ where: { tenantId: t } });
  await prisma.ledgerAccount.deleteMany({ where: { tenantId: t } });
  await prisma.tenant.deleteMany({ where: { id: t } });
  console.log("\ntenant uji sudah dibersihkan");

  console.log(gagal === 0 ? "\nSEMUA BUKTI Pengeluaran LULUS" : `\n${gagal} BUKTI GAGAL`);
  if (gagal > 0) process.exit(1);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
