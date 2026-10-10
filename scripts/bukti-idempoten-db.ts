// Bukti "satu jurnal aktif per dokumen" DIJAGA DATABASE, bukan hanya aplikasi.
//
// Sebelumnya idempotensi dijaga di lapisan aplikasi (cari jurnal aktif dulu,
// baru memposting). Sekarang database ikut menjaga lewat indeks parsial unik
// `JournalEntry_satu_aktif_per_dokumen`:
//
//   UNIQUE (tenantId, source, refType, refId)
//   WHERE refType IS NOT NULL AND refId IS NOT NULL
//     AND source <> 'REVERSAL'
//     AND diBalik = false
//
// Skrip ini membuktikan:
//   1. Dua posting untuk dokumen yang sama → posting kedua DITOLAK database.
//   2. Pembatalan (jurnal REVERSAL) menandai jurnal asli `diBalik = true`.
//   3. Setelah dibatalkan, dokumen yang sama BOLEH diposting ulang.
//   4. Jurnal pembalik tidak ikut berlomba (source REVERSAL dikecualikan):
//      banyak dokumen boleh dibatalkan tanpa saling menabrak.
//   5. Dua permintaan posting bersamaan untuk dokumen yang sama → TEPAT SATU
//      yang berhasil (indeks unik menangani race, aplikasi tidak perlu lock).
//
// Sekali pakai untuk verifikasi, bukan bagian dari aplikasi.

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { jurnalAktifId } from "../src/modules/accounting/jurnal-aktif";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

type Hasil = { nama: string; lulus: boolean; detail: string };
const hasil: Hasil[] = [];

function catat(nama: string, lulus: boolean, detail: string) {
  hasil.push({ nama, lulus, detail });
  console.log(`${lulus ? "LULUS" : "GAGAL"}  ${nama}  — ${detail}`);
}

async function main() {
  const tenant = await prisma.tenant.create({
    data: { name: "Bukti idempoten DB", slug: `bukti-idempoten-db-${Date.now()}` },
  });
  const t = tenant.id;

  const kas = await prisma.ledgerAccount.create({
    data: { tenantId: t, code: "1-1001", name: "Kas", type: "ASSET" },
  });
  const beban = await prisma.ledgerAccount.create({
    data: { tenantId: t, code: "5-1000", name: "Beban", type: "EXPENSE" },
  });

  /** Posting dokumen pengeluaran: debit Beban, kredit Kas (seimbang). */
  async function postDokumen(
    refId: string,
    nominal = 100_000,
  ): Promise<{ ok: boolean; pesan?: string }> {
    try {
      const j = await prisma.$transaction(async (tx) => {
        const entry = await tx.journalEntry.create({
          data: {
            tenantId: t,
            businessDate: new Date("2026-10-05T00:00:00Z"),
            period: "2026-10",
            source: "EXPENSE",
            refType: "EXPENSE",
            refId,
            description: `Pengeluaran ${refId}`,
          },
        });
        await tx.posting.createMany({
          data: [
            { journalId: entry.id, accountId: beban.id, amount: nominal, side: "DEBIT" },
            { journalId: entry.id, accountId: kas.id, amount: nominal, side: "CREDIT" },
          ],
        });
        return entry;
      });
      return { ok: true, pesan: j.id };
    } catch (err) {
      // Pesan dibuat UTUH (bukan baris pertama): Prisma menaruh nama constraint
      // di baris akhir, baris pertama kosong. Dipotong 800 agar nama constraint
      // (yang letaknya di akhir pesan ~400 karakter) ikut terlihat.
      const pesan = err instanceof Error ? err.message : String(err);
      return { ok: false, pesan: pesan.slice(0, 800) };
    }
  }

  /** Pembalik sebuah jurnal: sisi DEBIT/KREDIT ditukar, source REVERSAL. */
  async function balikJurnal(jurnalId: string) {
    const asli = await prisma.journalEntry.findUniqueOrThrow({
      where: { id: jurnalId },
      include: { postings: { include: { account: { select: { code: true } } } } },
    });
    await prisma.$transaction(async (tx) => {
      const j = await tx.journalEntry.create({
        data: {
          tenantId: t,
          businessDate: new Date("2026-10-06T00:00:00Z"),
          period: "2026-10",
          source: "REVERSAL",
          reversedFromId: asli.id,
        },
      });
      await tx.posting.createMany({
        data: asli.postings.map((p) => ({
          journalId: j.id,
          accountId: p.accountId,
          amount: p.amount,
          side: p.side === "DEBIT" ? "CREDIT" : "DEBIT",
        })),
      });
      await tx.journalEntry.update({
        where: { id: asli.id },
        data: { diBalik: true },
      });
    });
  }

  // --- 1. Dokumen pertama boleh diposting ---
  const d1 = await postDokumen("EXP-001");
  catat("dokumen pertama boleh diposting", d1.ok, d1.ok ? d1.pesan! : d1.pesan!);
  const j1 = d1.pesan!;

  // --- 2. Duplikat dokumen yang SAMA ditolak database ---
  const d1Lagi = await postDokumen("EXP-001");
  catat(
    "duplikat dokumen yang sama DITOLAK database",
    !d1Lagi.ok && /satu_aktif_per_dokumen|Unique constraint failed/i.test(d1Lagi.pesan!),
    d1Lagi.ok ? `LOLOS: ${d1Lagi.pesan}` : d1Lagi.pesan!,
  );

  // --- 3. jurnalAktifId tetap melihat satu pemilik ---
  const aktifSebelum = await jurnalAktifId(t, { refType: "EXPENSE", refId: "EXP-001", source: "EXPENSE" });
  catat("jurnalAktifId = jurnal pertama (duplikat tidak terlihat)", aktifSebelum === j1, aktifSebelum ?? "null");

  // --- 4. Pembatalan menandai asli diBalik=true dan membuka slotnya ---
  await balikJurnal(j1);
  const asliSekarang = await prisma.journalEntry.findUniqueOrThrow({ where: { id: j1 } });
  catat("pembatalan menandai jurnal asli diBalik=true", asliSekarang.diBalik === true, `diBalik=${asliSekarang.diBalik}`);
  const aktifSesudahBatal = await jurnalAktifId(t, { refType: "EXPENSE", refId: "EXP-001", source: "EXPENSE" });
  catat("dokumen yang dibatalkan tidak lagi punya jurnal aktif", aktifSesudahBatal === null, aktifSesudahBatal ?? "null");

  // --- 5. Dibatalkan lalu diposting ulang → jurnal BARU, dan bisa dibatalkan lagi ---
  const d1Ulang = await postDokumen("EXP-001");
  catat("dokumen yang dibatalkan boleh diposting ulang", d1Ulang.ok, d1Ulang.pesan!);
  const j1Ulang = d1Ulang.pesan!;
  catat("repost mendapat id jurnal BARU (bukan jurnal lama)", j1Ulang !== j1, `${j1Ulang} vs ${j1}`);
  const aktifUlang = await jurnalAktifId(t, { refType: "EXPENSE", refId: "EXP-001", source: "EXPENSE" });
  catat("jurnalAktifId = jurnal repost", aktifUlang === j1Ulang, aktifUlang ?? "null");

  // --- 6. Pembalik dikecualikan dari indeks: beberapa pembalik boleh berdampingan ---
  const d2 = await postDokumen("EXP-002");
  const j2 = d2.pesan!;
  await balikJurnal(j2);          // membalik j2
  await balikJurnal(j1Ulang);     // membalik j1Ulang (dokumen yang sama, putaran kedua)
  const live = await prisma.journalEntry.count({
    where: { tenantId: t, source: "REVERSAL" },
  });
  catat(
    "tiga pembalik hidup berdampingan (source REVERSAL dikecualikan dari indeks)",
    live === 3,
    `reversal=${live}`,
  );

  // --- 7. Race: dua permintaan bersamaan untuk dokumen yang sama → TEPAT SATU menang ---
  const [a, b] = await Promise.allSettled([postDokumen("EXP-003"), postDokumen("EXP-003")]);
  const hasilkans = [a, b].map((r) =>
    r.status === "rejected"
      ? { ok: false, pesan: String(r.reason) }
      : r.value,
  );
  const sukses = hasilkans.filter((h) => h.ok).length;
  const ditolak = hasilkans.filter(
    (h) => !h.ok && /satu_aktif_per_dokumen|Unique constraint failed/i.test(h.pesan!),
  ).length;
  catat(
    "dua posting bersamaan: tepat satu menang, satu ditolak indeks unik",
    sukses === 1 && ditolak === 1,
    `menang=${sukses}, ditolak=${ditolak}`,
  );

  // --- Ringkasan ---
  const semua = hasil.every((h) => h.lulus);
  console.log(`\n${semua ? "SEMUA BUKTI LULUS" : "ADA YANG GAGAL"} (${hasil.filter((h) => h.lulus).length}/${hasil.length})`);

  // --- Bersihkan (ON DELETE RESTRICT: akun dulu, baru jurnal) ---
  const akunSemua = await prisma.ledgerAccount.findMany({
    where: { tenantId: t },
    select: { id: true },
  });
  await prisma.posting.deleteMany({ where: { accountId: { in: akunSemua.map((a) => a.id) } } });
  await prisma.journalEntry.deleteMany({ where: { tenantId: t } });
  await prisma.ledgerAccount.deleteMany({ where: { tenantId: t } });
  await prisma.tenant.deleteMany({ where: { id: t } });
  console.log("tenant uji sudah dibersihkan");

  if (!semua) process.exitCode = 1;
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });