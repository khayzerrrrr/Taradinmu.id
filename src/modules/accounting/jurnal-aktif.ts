// Pencarian jurnal AKTIF untuk sebuah dokumen (Fase 1, PRD 4 butir F1.8).
//
// "Aktif" = belum dibatalkan jurnal pembalik.
//
// Kenapa ini berkas terpisah dan bukan fungsi privat di `jurnal-otomatis.ts`:
// berkas ini HANYA MEMBACA, jadi ia bisa dipanggil dari skrip pembuktian tanpa
// menyalakan Next.js dan tanpa sesi. Justru logika di sini yang paling perlu
// dibuktikan — ia yang menentukan apakah dokumen yang dibuat ulang benar-benar
// menghasilkan jurnal baru, atau diam-diam dianggap "sudah ada" lalu dilewati.

import { prisma } from "@/lib/prisma";

/** Sumber jurnal yang bisa dibatalkan (diikuti enum `JournalSource`). */
export type SumberJurnalAktif =
  | "INVOICE"
  | "PAYMENT"
  | "STOCK"
  | "EXPENSE"
  | "MANUAL";

export type KunciJurnalAktif = {
  refType: string;
  refId: string;
  source: SumberJurnalAktif;
};

/**
 * Id jurnal aktif untuk (tenant, refType, refId, source), atau `null`.
 *
 * Kunci dokumen di database TIDAK unik: setelah sebuah jurnal dibalik, jurnal
 * lama tetap menyandang kunci yang sama. Karena itu:
 *   1. query hanya mengambil jurnal yang belum dibalik (`diBalik = false` —
 *      ditandai indeks parsial unik satu-aktif-per-dokumen di database),
 *   2. jurnal yang sudah punya pembalik tetap dikeluarkan sebagai jaring
 *      pengaman (melindungi data lama dari sebelum migrasi `diBalik`),
 *   3. kandidat pertama yang tersisa itulah yang aktif.
 *
 * `reversedFromId` unik, jadi satu jurnal dibatalkan paling banyak sekali.
 */
export async function jurnalAktifId(
  tenantId: string,
  kunci: KunciJurnalAktif,
): Promise<string | null> {
  const kandidat = await prisma.journalEntry.findMany({
    where: { tenantId, ...kunci, diBalik: false },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  if (kandidat.length === 0) return null;

  const dibatalkan = await prisma.journalEntry.findMany({
    where: { reversedFromId: { in: kandidat.map((k) => k.id) } },
    select: { reversedFromId: true },
  });
  const mati = new Set(dibatalkan.map((d) => d.reversedFromId));
  return kandidat.find((k) => !mati.has(k.id))?.id ?? null;
}
