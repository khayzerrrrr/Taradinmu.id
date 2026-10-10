// Bukti Fase 1.5-1.6: CoA ditanam saat registrasi, jurnal benar-benar tersimpan.
//
// Melewati `prisma dev` karena plantar CoA dan trigger sama-sama perlu
// PostgreSQL sungguhan.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { COA_MINIMAL, KODE_AKUN } from "../src/modules/accounting/coa";
import { tanamCoa } from "../src/modules/accounting/tanam-coa";
import {
  jurnalDariInvoice,
  jurnalDariPembayaran,
  jurnalHppTerjual,
  type JurnalRancangan,
} from "../src/modules/accounting/engine-jurnal";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

/** Menyimpan rancangan jurnal ke database, mengembalikan id-nya. */
async function simpanJurnal(
  tenantId: string,
  rancangan: JurnalRancangan,
  currency: string,
): Promise<string> {
  const kodeKeId = new Map<string, string>();
  for (const a of await prisma.ledgerAccount.findMany({
    where: { tenantId },
    select: { id: true, code: true },
  })) {
    kodeKeId.set(a.code, a.id);
  }

  return prisma.$transaction(async (tx) => {
    const j = await tx.journalEntry.create({
      data: {
        tenantId,
        businessDate: rancangan.businessDate,
        period: rancangan.businessDate.toISOString().slice(0, 7),
        source: rancangan.source,
        reference: rancangan.reference ?? null,
        refType: rancangan.refType ?? null,
        refId: rancangan.refId ?? null,
        description: rancangan.description ?? null,
        currency,
        reversedFromId: rancangan.reversedFromId ?? null,
      },
      select: { id: true },
    });

    await tx.posting.createMany({
      data: rancangan.postings.map((p) => {
        const accountId = kodeKeId.get(p.kode);
        if (!accountId) {
          throw new Error(`Akun ${p.kode} tidak ada pada tenant ini`);
        }
        return {
          journalId: j.id,
          accountId,
          amount: p.nominal,
          side: p.sisi,
          currency,
        };
      }),
    });
    if (rancangan.reversedFromId) {
      await tx.journalEntry.update({
        where: { id: rancangan.reversedFromId },
        data: { diBalik: true },
      });
    }
    return j.id;
  });
}

async function main() {
  const tenant = await prisma.tenant.create({
    data: { name: "Bukti GL penuh", slug: `bukti-gl-penuh-${Date.now()}` },
  });
  const t = tenant.id;
  const mataUang = tenant.currency;

  // --- 1. Tanam CoA ---
  const pertama = await tanamCoa(t, mataUang);
  console.log(`CoA ditanam : ${pertama.ditanam} akun, ${pertama.dilewati} dilewati`);
  const total = await prisma.ledgerAccount.count({ where: { tenantId: t } });
  console.log(`CoA di DB   : ${total} akun (template: ${COA_MINIMAL.length})`);

  // --- 2. Tanam ulang harus idempoten ---
  const kedua = await tanamCoa(t, mataUang);
  console.log(
    `tanam ulang: ${kedua.ditanam} ditanam, ${kedua.dilewati} dilewati (idempoten: ${kedua.ditanam === 0})`,
  );
  const totalSetelah = await prisma.ledgerAccount.count({ where: { tenantId: t } });
  console.log(`CoA di DB   : ${totalSetelah} akun (tidak bertambah)`);

  // --- 3. Satu siklus bisnis penuh: jual, terima, catat HPP ---
  const tanggal = new Date("2026-10-15T00:00:00Z");

  const pendapatan = jurnalDariInvoice({
    businessDate: tanggal,
    invoiceNumber: "INV-GL-0001",
    invoiceId: "inv-gl-1",
    totalAmount: 1_100_000,
  });
  if (!pendapatan.ok) throw new Error(pendapatan.alasan);
  const j1 = await simpanJurnal(t, pendapatan.jurnal, mataUang);
  console.log(`\njurnal pendapatan : ${j1}`);

  const hpp = jurnalHppTerjual({
    businessDate: tanggal,
    reference: "INV-GL-0001",
    hpp: 600_000,
  });
  if (!hpp?.ok) throw new Error("HPP tidak diracik");
  const j2 = await simpanJurnal(t, hpp.jurnal, mataUang);
  console.log(`jurnal HPP        : ${j2}`);

  const bayar = jurnalDariPembayaran({
    businessDate: tanggal,
    invoiceNumber: "INV-GL-0001",
    invoiceId: "inv-gl-1",
    totalAmount: 1_100_000,
  });
  if (!bayar.ok) throw new Error(bayar.alasan);
  const j3 = await simpanJurnal(t, bayar.jurnal, mataUang);
  console.log(`jurnal pembayaran  : ${j3}`);

  // --- 4. Tutup buku ---
  const akun = new Map(
    (
      await prisma.ledgerAccount.findMany({
        where: { tenantId: t },
        select: { id: true, code: true, name: true, type: true },
      })
    ).map((a) => [a.id, a]),
  );

  type Baris = { kode: string; nama: string; tipe: string; debit: number; kredit: number };
  const baris: Baris[] = [];
  const semua = await prisma.posting.findMany({
    where: { journal: { tenantId: t } },
    select: { accountId: true, amount: true, side: true },
  });
  for (const p of semua) {
    const a = akun.get(p.accountId)!;
    const b = baris.find((x) => x.kode === a.code);
    if (b) {
      if (p.side === "DEBIT") b.debit += Number(p.amount);
      else b.kredit += Number(p.amount);
    } else {
      baris.push({
        kode: a.code,
        nama: a.name,
        tipe: a.type,
        debit: p.side === "DEBIT" ? Number(p.amount) : 0,
        kredit: p.side === "CREDIT" ? Number(p.amount) : 0,
      });
    }
  }
  baris.sort((a, b) => a.kode.localeCompare(b.kode));

  console.log("\nBUKU BESAR (dari journal)");
  console.log("kode    akun                    tipe        debit      kredit");
  for (const b of baris) {
    console.log(
      `${b.kode.padEnd(7)} ${b.nama.padEnd(23)} ${b.tipe.padEnd(11)} ${b.debit
        .toLocaleString("id-ID")
        .padStart(10)} ${b.kredit.toLocaleString("id-ID").padStart(12)}`,
    );
  }

  const totalDebit = baris.reduce((s, b) => s + b.debit, 0);
  const totalKredit = baris.reduce((s, b) => s + b.kredit, 0);
  console.log(
    `\ntotal debit ${totalDebit.toLocaleString("id-ID")} = total kredit ${totalKredit.toLocaleString(
      "id-ID",
    )} -> ${totalDebit === totalKredit ? "SEIMBANG" : "TIDAK SEIMBANG"}`,
  );

  const laba = baris
    .filter((b) => b.kode === KODE_AKUN.pendapatanPenjualan)
    .reduce((s, b) => s + b.kredit, 0);
  const hppTotal = baris
    .filter((b) => b.kode === KODE_AKUN.hpp)
    .reduce((s, b) => s + b.debit, 0);
  console.log(
    `\nlaba kotor = ${(laba - hppTotal).toLocaleString("id-ID")} (pendapatan ${laba.toLocaleString(
      "id-ID",
    )} - HPP ${hppTotal.toLocaleString("id-ID")})`,
  );
  const piutangBaris = baris.find((b) => b.kode === KODE_AKUN.piutangUsaha);
  // Saldo, bukan kolom debit: piutang yang sudah dibayar muncul sebagai debit
  // DAN kredit. Yang pertanyaan invalidate adalah selisihnya.
  const sisaPiutang = (piutangBaris?.debit ?? 0) - (piutangBaris?.kredit ?? 0);
  console.log(
    `saldo piutang setelah dibayar = ${sisaPiutang.toLocaleString(
      "id-ID",
    )} -> ${sisaPiutang === 0 ? "NOL (lunas)" : "BELUM LUNAS"}`,
  );

  // --- 5. Bersihkan ---
  await prisma.posting.deleteMany({
    where: { journal: { tenantId: t } },
  });
  await prisma.journalEntry.deleteMany({ where: { tenantId: t } });
  await prisma.ledgerAccount.deleteMany({ where: { tenantId: t } });
  await prisma.tenant.deleteMany({ where: { id: t } });
  console.log("\ntenant uji sudah dibersihkan");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
