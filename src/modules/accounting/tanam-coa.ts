// Penanaman Chart of Accounts (Fase 1, PRD 4 butir F1.5).
//
// Satu-satunya tempat CoA dibuat untuk sebuah tenant. Dipanggil saat registrasi
// dan saat Super Admin Provisions tenant manual.
//
// Kenapa file sendiri, bukan satu baris di dalam Server Action: tenant bisa
// dibuat di tiga jalur (registrasi, Super Admin, seeder), dan CoA yang hanya
// ditanam di salah satu jalur menghasilkan tenant tanpa akun -- yang baru terasa
// jauh kemudian, saat jurnal pertamanya gagal menulis ke akun yang tidak ada.
//
// CATATAN HIERARKI: kolom `LedgerAccount.parentId` sengaja TIDAK diisi di sini.
// Laporan mengelompokkan lewat enum `AccountType`, jadi hierarki tidak diperlukan
// untuk laporan apa pun yang ada sekarang. Mengisinya berarti CoA punya akun
// "tanpa induk" yang tidak menjelaskan apa pun di reports -- dan template
// ninetyCoA jadi lebih sulit dibaca tanpa menambah satu informasi pun. Hierarki
// baru diisi kalau ada kebutuhan nyata (mis. rincian beban per divisi), dan itu
// keputusan tersendiri.

import { COA_MINIMAL } from "@/modules/accounting/coa";
import { prisma } from "@/lib/prisma";

/**
 * Menanam CoA untuk satu tenant.
 *
 * Aman dipanggil berkali-kali: akun yang kodenya sudah ada dilewati, bukan
 * digagalkan. Itu penting karena jalur pemulihan (Super Admin, seeder, atau
 * perbaikan manual) memanggilnya lagi pada tenant yang sudah punya CoA.
 *
 * Satu transaksi, bukan per akun: tenant tidak boleh pernah terlihat dengan
 * CoA separuh -- kondisi yang membuat jurnal pertama gagal dengan pesan yang
 * tidak menjelaskan apa pun.
 */
export async function tanamCoa(
  tenantId: string,
  currency = "IDR",
): Promise<{ ditanam: number; dilewati: number }> {
  const ada = await prisma.ledgerAccount.findMany({
    where: { tenantId },
    select: { code: true },
  });
  const sudahAda = new Set(ada.map((a) => a.code));
  const baru = COA_MINIMAL.filter((a) => !sudahAda.has(a.code));

  if (baru.length === 0) {
    return { ditanam: 0, dilewati: sudahAda.size };
  }

  await prisma.$transaction(
    baru.map((a) =>
      prisma.ledgerAccount.create({
        data: {
          tenantId,
          code: a.code,
          name: a.name,
          type: a.type,
          currency,
          isSystem: a.system,
        },
      }),
    ),
  );

  return { ditanam: baru.length, dilewati: sudahAda.size };
}
