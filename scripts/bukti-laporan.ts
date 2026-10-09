// Bukti F1.11: laporan keuangan dari journal, diuji terhadap PostgreSQL nyata.
//
// Tes `laporan.test.ts` membuktikan aritmetikanya. Skrip ini membuktikan hal yang
// berbeda dan tidak bisa dibuktikan tanpa database: bahwa query-nya membaca
// journal yang BENAR-BENAR ada -- bukan nol yang kebetulan cocok.
//
// Golongannya: SETUJUH kalau assertion gagal, karena laporan yang Quietly salah
// lebih berbahaya daripada laporan yang belum jadi. Semua pemeriksaan di bawah
// memakai nilai yang SEHARUSNYA muncul di laporan.
//
//Jalankan: npx tsx scripts/bukti-laporan.ts   (butuh DATABASE_URL PostgreSQL)

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { KODE_AKUN } from "../src/modules/accounting/coa";
import { tanamCoa } from "../src/modules/accounting/tanam-coa";
import { buatLaporan } from "../src/modules/accounting/laporan";
import type { JurnalRancangan } from "../src/modules/accounting/engine-jurnal";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const PERIODE = "2026-10";

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
        return { journalId: entry.id, accountId, amount: p.nominal, side: p.sisi, currency: mataUang };
      }),
    });
    return entry.id;
  });
}

function cari(baris: { label: string; nilai: number }[], label: string): number | undefined {
  return baris.find((b) => b.label === label)?.nilai;
}

async function main() {
  const tenant = await prisma.tenant.create({
    data: { name: "Bukti Laporan", slug: `bukti-laporan-${Date.now()}` },
  });
  const t = tenant.id;
  const mataUang = tenant.currency;
  await tanamCoa(t, mataUang);

  // Skenario: modal 10.000.000 pada 1 Oktober, lalu pada 15 Oktober jual
  // 1.100.000 dengan HPP 600.000 yang dibayar tunai.
  //
  // Modal  : Dr Kas 10.000.000 / Cr Modal Disetor 10.000.000
  //   Dr Piutang 1.100.000 / Cr Penjualan 1.100.000
  //   Dr Kas 1.100.000 / Cr Piutang 1.100.000
  //   Dr HPP 600.000 / Cr Kas 600.000
  //
  // Hazza : kas 10.500.000, pendapatan 1.100.000, HPP 600.000 -> laba 500.000.
  const d1 = new Date("2026-10-01T00:00:00Z");
  const d15 = new Date("2026-10-15T00:00:00Z");

  await simpan(
    t,
    {
      businessDate: d1,
      source: "OPENING",
      description: "Modal awal",
      postings: [
        { kode: KODE_AKUN.kas, sisi: "DEBIT", nominal: 10_000_000 },
        { kode: KODE_AKUN.modalDisetor, sisi: "CREDIT", nominal: 10_000_000 },
      ],
    },
    mataUang,
  );
  await simpan(
    t,
    {
      businessDate: d15,
      source: "INVOICE",
      reference: "INV-LAP-0001",
      refType: "INVOICE",
      refId: "inv-lap-1",
      description: "Penjualan",
      postings: [
        { kode: KODE_AKUN.piutangUsaha, sisi: "DEBIT", nominal: 1_100_000 },
        { kode: KODE_AKUN.pendapatanPenjualan, sisi: "CREDIT", nominal: 1_100_000 },
      ],
    },
    mataUang,
  );
  await simpan(
    t,
    {
      businessDate: d15,
      source: "PAYMENT",
      reference: "INV-LAP-0001",
      refType: "INVOICE",
      refId: "inv-lap-1",
      description: "Penerimaan",
      postings: [
        { kode: KODE_AKUN.kas, sisi: "DEBIT", nominal: 1_100_000 },
        { kode: KODE_AKUN.piutangUsaha, sisi: "CREDIT", nominal: 1_100_000 },
      ],
    },
    mataUang,
  );
  await simpan(
    t,
    {
      businessDate: d15,
      source: "INVOICE",
      reference: "INV-LAP-0001",
      refType: "INVOICE",
      refId: "inv-lap-1",
      description: "HPP terjual",
      postings: [
        { kode: KODE_AKUN.hpp, sisi: "DEBIT", nominal: 600_000 },
        { kode: KODE_AKUN.kas, sisi: "CREDIT", nominal: 600_000 },
      ],
    },
    mataUang,
  );

  // --- LABA RUGI ---
  console.log("\nLABA RUGI (Oktober 2026)");
  const lr = await buatLaporan(t, "LABA_RUGI", PERIODE);
  cek("Pendapatan", cari(lr.baris, "Penjualan Barang"), 1_100_000);
  cek("Harga Pokok Penjualan", cari(lr.baris, "Harga Pokok Penjualan"), -600_000);
  cek("Laba Kotor", cari(lr.baris, "Laba Kotor"), 500_000);
  cek("Laba Bersih", cari(lr.baris, "LABA BERSIH"), 500_000);

  // --- NERACA ---
  console.log("\nNERACA (per 31 Oktober 2026)");
  const nr = await buatLaporan(t, "NERACA", PERIODE);
  cek("Kas", cari(nr.baris, "Kas"), 10_500_000);
  cek("Piutang Usaha (lunas -> 0)", cari(nr.baris, "Piutang Usaha"), 0);
  cek("Jumlah Aset", cari(nr.baris, "Jumlah Aset"), 10_500_000);
  cek("Modal Disetor", cari(nr.baris, "Modal Disetor"), 10_000_000);
  cek("Laba Berjalan", cari(nr.baris, "Laba Berjalan"), 500_000);
  cek("Jumlah Modal", cari(nr.baris, "Jumlah Modal"), 10_500_000);
  cek(
    "Aset = Liabilitas + Modal",
    cari(nr.baris, "JUMLAH LIABILITAS + MODAL"),
    cari(nr.baris, "Jumlah Aset"),
  );
  cek("Periode terisi", nr.periode, { dari: "2026-10", sampai: "2026-11" });

  // --- ARUS KAS ---
  console.log("\nARUS KAS (Oktober 2026)");
  const ak = await buatLaporan(t, "ARUS_KAS", PERIODE);
  cek("Kas masuk", cari(ak.baris, "Kas masuk"), 11_100_000);
  cek("Kas keluar", cari(ak.baris, "Kas keluar"), -600_000);
  cek("Kenaikan kas bersih", cari(ak.baris, "KENAIKAN KAS BERSIH"), 10_500_000);
  cek("Saldo kas awal", cari(ak.baris, "Saldo kas awal periode"), 0);
  cek("Saldo kas akhir", cari(ak.baris, "Saldo kas akhir periode"), 10_500_000);

  // --- PERCOBAAN BALANCE ---
  console.log("\nPERCOBAAN BALANCE (Oktober 2026)");
  const pb = await buatLaporan(t, "PERCOBAAN_BALANCE", PERIODE);
  // Total debit = 10.000.000 (modal) + 1.100.000 (piutang) + 1.100.000 (kas)
  // + 600.000 (HPP) = 12.800.000. Total kredit harus sama persis.
  cek("Total Debit", cari(pb.baris, "TOTAL DEBIT"), 12_800_000);
  cek("Total Kredit", cari(pb.baris, "TOTAL KREDIT"), 12_800_000);
  cek("Selisih", pb.total?.nilai, 0);

  // --- BUKU BESAR ---
  console.log("\nBUKU BESAR (akun Kas)");
  const bb = await buatLaporan(t, "BUKU_BESAR", PERIODE);
  cek("Saldo akhir Kas", cari(bb.baris, "Saldo akhir"), 10_500_000);
  cek(
    "Buku besar bukan placeholder",
    bb.baris.length > 4,
    true,
  );

  // --- Periode lain harus kosong, bukan bocor data ---
  console.log("\nISOLASI PERIODE");
  const lrNov = await buatLaporan(t, "LABA_RUGI", "2026-11");
  cek("Laba Rugi November = 0", cari(lrNov.baris, "LABA BERSIH"), 0);
  const nrSep = await buatLaporan(t, "NERACA", "2026-09");
  cek("Neraca September = 0 (belum ada modal)", cari(nrSep.baris, "Jumlah Aset"), 0);

  // --- Bersihkan ---
  await prisma.posting.deleteMany({ where: { journal: { tenantId: t } } });
  await prisma.journalEntry.deleteMany({ where: { tenantId: t } });
  await prisma.ledgerAccount.deleteMany({ where: { tenantId: t } });
  await prisma.tenant.deleteMany({ where: { id: t } });
  console.log("\ntenant uji sudah dibersihkan");

  console.log(gagal === 0 ? "\nSEMUA BUKTI Laporan LULUS" : `\n${gagal} BUKTI GAGAL`);
  if (gagal > 0) process.exit(1);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
