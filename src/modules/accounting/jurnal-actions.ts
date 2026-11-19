import { pesanErrorUmum } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import { assertTenantMember } from "@/lib/tenant-access";
import { jurnalPembalik, type JurnalRancangan } from "@/modules/accounting/engine-jurnal";

/**
 * Penyimpanan jurnal (Fase 1, PRD 4 butir F1.6).
 *
 * Satu-satunya jalan dari "rancangan jurnal" ke database. Semua pemanggil lain
 * lewat sini, sehingga aturan tenant, currency, dan transaksi tidak
 * bisa berbeda antar pemanggil.
 *
 * Yang dijaga di sini dan TIDAK boleh dijaga di pemanggil:
 * - tenant isolation (trigger database sudah menjaga posting lintas tenant, tapi
 *   di sini juga dicek agar pesannya jelas);
 * - CoA ada (akun yang hilang menghasilkan jurnal gagal saat commit, dan pesan
 *   database-nya tidak menyebut kode akun yang bermasalah);
 * - satu transaksi untuk journal + posting-nya.
 *
 * Yang SENGAJA TIDAK ada di sini: validasi saldo. `racikJurnal()` sudah
 *memastikan jurnal seimbang sebelum sampai ke fungsi ini, dan database
 *   memeriksanya lagi saat COMMIT. Memvalidasinya tiga kali hanya menambah tempat
 *   untuk salah.
 */

export type HasilPosting = {
  ok: boolean;
  journalId?: string;
  /** Baris yang gagal, dalam bahasa yang bisa ditampilkan ke pengguna. */
  alasan?: string;
  code?: string;
};

/** Jurnal tersimpan, atau alasan kegagalan yang terbaca. */
export async function simpanJurnal(
  tenantId: string,
  rancangan: JurnalRancangan,
  currency = "IDR",
): Promise<HasilPosting> {
  const akses = await assertTenantMember(tenantId);
  if (!akses.ok) {
    return { ok: false, alasan: akses.message, code: "FORBIDDEN" };
  }

  // CoA mungkin belum ditanam (tenant lama, atau planting gagal saat
  // registrasi). Pesan di sini menyebut perbaikannya, bukan hanya
  // "akun tidak ditemukan".
  const kodeAda = new Set(
    (
      await prisma.ledgerAccount.findMany({
        where: { tenantId },
        select: { code: true },
      })
    ).map((a) => a.code),
  );
  const hilang = rancangan.postings
    .map((p) => p.kode)
    .filter((kode) => !kodeAda.has(kode));
  if (hilang.length > 0) {
    return {
      ok: false,
      alasan: `Daftar akun belum lengkap untuk usaha ini. Akun yang belum ada: ${[...new Set(hilang)].join(", ")}. Hubungi admin untuk Memasang daftar akun.`,
      code: "COA_TIDAK_LENGKAP",
    };
  }

  const kodeKeId = new Map(
    (
      await prisma.ledgerAccount.findMany({
        where: { tenantId },
        select: { id: true, code: true },
      })
    ).map((a) => [a.code, a.id]),
  );

  try {
    const journalId = await prisma.$transaction(async (tx) => {
      const j = await tx.journalEntry.create({
        data: {
          tenantId,
          businessDate: rancangan.businessDate,
          period: labelPeriode(rancangan.businessDate),
          postedAt: new Date(),
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
        data: rancangan.postings.map((p) => ({
          journalId: j.id,
          accountId: kodeKeId.get(p.kode)!,
          amount: p.nominal,
          side: p.sisi,
          currency,
        })),
      });

      // Pembalik menandai jurnal aslinya mati DI TRANSAKSI YANG SAMA, supaya
      // indeks parsial unik satu-aktif-per-dokumen membuka slotnya tepat saat
      // pembaliknya lahir - tidak ada jendela di mana dokumen itu "tanpa
      // pemilik" maupun "punya dua pemilik".
      if (rancangan.reversedFromId) {
        await tx.journalEntry.update({
          where: { id: rancangan.reversedFromId },
          data: { diBalik: true },
        });
      }
      return j.id;
    });

    return { ok: true, journalId };
  } catch (error) {
    // Pesan dari trigger PostgreSQL sudah menjelaskan aturan yang dilanggar
    // ("tidak seimbang", "sudah ditutup", "sudah pernah dibatalkan"), jadi ia
    // diteruskan apa adanya. Yang disamarkan hanya yang bisa membocorkan
    // struktur internal ke pengguna.
    return {
      ok: false,
      alasan: pesanErrorUmum(error),
      code: "JURNAL_GAGAL",
    };
  }
}

/**
 * Membatalkan sebuah jurnal dengan jurnal pembalik.
 *
 * Bukan menghapus, bukan mengubah: pembukuan yang bisa "dibetulkan" dengan
 * mengubah barisnya berhenti menjadi bukti. Baris asli tetap ada, dan yang
 * berubah hanya jurnal barunya.
 */
export async function batalkanJurnal(
  tenantId: string,
  journalId: string,
  tanggalPembatalan: Date = new Date(),
): Promise<HasilPosting> {
  const akses = await assertTenantMember(tenantId);
  if (!akses.ok) {
    return { ok: false, alasan: akses.message, code: "FORBIDDEN" };
  }

  const asli = await prisma.journalEntry.findFirst({
    where: { id: journalId, tenantId },
    include: { postings: { include: { account: { select: { code: true } } } } },
  });
  if (!asli) {
    return { ok: false, alasan: "Jurnal tidak ditemukan.", code: "NOT_FOUND" };
  }

  // Satu jurnal tidak boleh dibatalkan dua kali. Dicek di sini supaya
  //engguna dapat pesan yang jelas; trigger database tetap menjaga kalau ada
  // jalur lain yang melewatinya.
  const sudah = await prisma.journalEntry.findFirst({
    where: { reversedFromId: asli.id },
    select: { id: true },
  });
  if (sudah) {
    return {
      ok: false,
      alasan: "Jurnal ini sudah pernah dibatalkan.",
      code: "SUDAH_DIBATALKAN",
    };
  }

  const hasil = jurnalPembalik(
    {
      id: asli.id,
      businessDate: asli.businessDate,
      currency: asli.currency,
      postings: asli.postings.map((p) => ({
        kode: p.account.code,
        nominal: Number(p.amount),
        sisi: p.side,
      })),
    },
    tanggalPembatalan,
  );

  if (!hasil.ok) return { ok: false, alasan: hasil.alasan, code: "JURNAL_GAGAL" };

  return simpanJurnal(tenantId, hasil.jurnal, asli.currency);
}

/** "YYYY-MM" dari tanggal bisnis — sama dengan kolom `period` pada jurnal. */
function labelPeriode(tanggal: Date): string {
  return tanggal.toISOString().slice(0, 7);
}
