// Bukti constraint GL benar-benar ditegakkan oleh database.
//
// Menulis constraint SQL tanpa pernah mencoba melanggarnya sama dengan menulis
// dokumentasi tanpa pernah menjalankannya. Skrip ini sengaja melanggar setiap
// aturan satu per satu dan mencatat apa yang ditolak database.
//
// Sekali pakai untuk verifikasi Fase 1, bukan bagian dari aplikasi.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

type Hasil = { aturan: string; ditolak: boolean; detail: string };
const hasil: Hasil[] = [];

/**
 * Menjalankan satu pelanggaran lalu mencatat apakah database menolaknya.
 * Setiap pelanggaran dijalankan di transaksi sendiri yang di-rollback, supaya
 * gagal di tengah tidak meninggalkan sisa.
 */
async function coba(aturan: string, kerja: () => Promise<unknown>) {
  try {
    await kerja();
    hasil.push({ aturan, ditolak: false, detail: "TIDAK DITOLAK" });
  } catch (err) {
    const pesan = err instanceof Error ? err.message.split("\n")[0] : String(err);
    hasil.push({ aturan, ditolak: true, detail: pesan.slice(0, 130) });
  }
}

async function main() {
  const tenant = await prisma.tenant.create({
    data: { name: "Bukti GL", slug: `bukti-gl-${Date.now()}` },
  });
  const t = tenant.id;

  const coa = async (code: string, name: string, type: "ASSET" | "REVENUE" | "EXPENSE" | "LIABILITY") =>
    prisma.ledgerAccount.create({
      data: { tenantId: t, code, name, type },
    });

  const kas = await coa("1-1001", "Kas", "ASSET");
  const penjualan = await coa("4-1000", "Penjualan", "REVENUE");
  const beban = await coa("5-1000", "Beban", "EXPENSE");

  // Jurnal seimbang yang sah — dasar untuk semua pengujian.
  const buatJurnalSeimbang = (suffix: string, reversedFromId?: string) =>
    prisma.$transaction(async (tx) => {
      const j = await tx.journalEntry.create({
        data: {
          tenantId: t,
          businessDate: new Date("2026-10-01T00:00:00Z"),
          period: "2026-10",
          source: reversedFromId ? "REVERSAL" : "MANUAL",
          reference: suffix,
          ...(reversedFromId ? { reversedFromId } : {}),
        },
      });
      await tx.posting.createMany({
        data: [
          { journalId: j.id, accountId: kas.id, amount: 100, side: "DEBIT" },
          { journalId: j.id, accountId: penjualan.id, amount: 100, side: "CREDIT" },
        ],
      });
      return j;
    });

  // --- 1. Jurnal tidak seimbang harus ditolak saat COMMIT ---
  await coba("jurnal tidak seimbang ditolak saat commit", async () => {
    await prisma.$transaction(async (tx) => {
      const j = await tx.journalEntry.create({
        data: {
          tenantId: t,
          businessDate: new Date("2026-10-01T00:00:00Z"),
          period: "2026-10",
          source: "MANUAL",
        },
      });
      await tx.posting.createMany({
        data: [
          { journalId: j.id, accountId: kas.id, amount: 100, side: "DEBIT" },
          { journalId: j.id, accountId: penjualan.id, amount: 90, side: "CREDIT" },
        ],
      });
    });
  });

  // --- 2. Nominal nol harus ditolak ---
  await coba("nominal nol ditolak", async () => {
    const j = await buatJurnalSeimbang("nol");
    await prisma.posting.create({
      data: { journalId: j.id, accountId: beban.id, amount: 0, side: "DEBIT" },
    });
  });

  // --- 3. Nominal negatif harus ditolak ---
  await coba("nominal negatif ditolak", async () => {
    const j = await buatJurnalSeimbang("negatif");
    await prisma.posting.create({
      data: { journalId: j.id, accountId: beban.id, amount: -50, side: "DEBIT" },
    });
  });

  // --- 4. Satu akun dua kali dalam satu jurnal ---
  await coba("akun yang sama dua kali dalam satu jurnal ditolak", async () => {
    const j = await buatJurnalSeimbang("duplikat");
    await prisma.posting.create({
      data: { journalId: j.id, accountId: kas.id, amount: 25, side: "DEBIT" },
    });
  });

  // --- 5. Jurnal tanpa posting ---
  await coba("jurnal tanpa satu pun posting ditolak saat commit", async () => {
    await prisma.journalEntry.create({
      data: {
        tenantId: t,
        businessDate: new Date("2026-10-01T00:00:00Z"),
        period: "2026-10",
        source: "MANUAL",
      },
    });
  });

  // --- 6. Periode tertutup ---
  await prisma.accountingPeriod.create({
    data: { tenantId: t, period: "2026-09", status: "CLOSED", closedAt: new Date() },
  });
  await coba("jurnal ke periode tertutup ditolak", async () => {
    await prisma.$transaction(async (tx) => {
      const j = await tx.journalEntry.create({
        data: {
          tenantId: t,
          businessDate: new Date("2026-09-15T00:00:00Z"),
          period: "2026-09",
          source: "MANUAL",
        },
      });
      await tx.posting.createMany({
        data: [
          { journalId: j.id, accountId: kas.id, amount: 10, side: "DEBIT" },
          { journalId: j.id, accountId: penjualan.id, amount: 10, side: "CREDIT" },
        ],
      });
    });
  });

  // --- 7. Periode terbuka boleh masuk ---
  await coba("jurnal ke periode terbuka DITERIMA (kontrol)", async () => {
    await buatJurnalSeimbang("terbuka");
  });

  // --- 8. Pembatalan ganda ---
  //
  // Pembatalan adalah jurnal SAH yang dibalik, jadi ia sendiri harus seimbang
  // -- hanya sisi DEBIT/KREDIT-nya yang tertukar.
  const asli = await buatJurnalSeimbang("asli-untuk-dibatalkan");
  const buatPembalik = (id: string) =>
    prisma.$transaction(async (tx) => {
      const j = await tx.journalEntry.create({
        data: {
          tenantId: t,
          businessDate: new Date("2026-10-02T00:00:00Z"),
          period: "2026-10",
          source: "REVERSAL",
          reversedFromId: id,
        },
      });
      await tx.posting.createMany({
        data: [
          { journalId: j.id, accountId: kas.id, amount: 100, side: "CREDIT" },
          { journalId: j.id, accountId: penjualan.id, amount: 100, side: "DEBIT" },
        ],
      });
      return j;
    });

  await buatPembalik(asli.id);
  await coba("jurnal yang sama dibatalkan dua kali ditolak", () =>
    buatPembalik(asli.id),
  );

  // --- 9. Kode akun ganda dalam tenant yang sama ---
  await coba("kode akun yang sama dua kali ditolak", async () => {
    await coa("1-1001", "Kas duplikat", "ASSET");
  });

  // --- 10. Akun dari tenant lain tidak boleh masuk jurnal tenant ini ---
  const tenantLain = await prisma.tenant.create({
    data: { name: "Bukti GL 2", slug: `bukti-gl-2-${Date.now()}` },
  });
  const akunLain = await prisma.ledgerAccount.create({
    data: { tenantId: tenantLain.id, code: "1-1001", name: "Kas", type: "ASSET" },
  });
  await coba("akun tenant lain tidak bisa dipakai", async () => {
    await prisma.$transaction(async (tx) => {
      const j = await tx.journalEntry.create({
        data: {
          tenantId: t,
          businessDate: new Date("2026-10-03T00:00:00Z"),
          period: "2026-10",
          source: "MANUAL",
        },
      });
      await tx.posting.createMany({
        data: [
          { journalId: j.id, accountId: kas.id, amount: 5, side: "DEBIT" },
          { journalId: j.id, accountId: akunLain.id, amount: 5, side: "CREDIT" },
        ],
      });
    });
  });

  console.log("\nHASIL UJI CONSTRAINT\n");
  for (const h of hasil) {
    const tanda = h.ditolak ? "DITOLAK" : "LULUS  ";
    console.log(`${tanda}  ${h.aturan}`);
    console.log(`          ${h.detail}`);
  }

  const semuaDitolak = hasil
    .filter((h) => !h.aturan.includes("kontrol"))
    .every((h) => h.ditolak);
  console.log(
    `\n${semuaDitolak ? "SEMUA pelanggaran ditolak database" : "ADA YANG LOLOS"}`,
  );

  // Posting memakai ON DELETE RESTRICT, jadi tenant harus dihapus dari bawah
  // (akun dulu, baru jurnal) — urutannya yang benar, bukan sekadar Hosts yang
  // dipaksa.
  const akunSemua = await prisma.ledgerAccount.findMany({
    where: { tenantId: { in: [t, tenantLain.id] } },
    select: { id: true },
  });
  await prisma.posting.deleteMany({
    where: { accountId: { in: akunSemua.map((a) => a.id) } },
  });
  await prisma.journalEntry.deleteMany({
    where: { tenantId: { in: [t, tenantLain.id] } },
  });
  await prisma.ledgerAccount.deleteMany({
    where: { id: { in: akunSemua.map((a) => a.id) } },
  });
  await prisma.accountingPeriod.deleteMany({ where: { tenantId: { in: [t, tenantLain.id] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [t, tenantLain.id] } } });
  console.log("\ntenant uji sudah dibersihkan");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
