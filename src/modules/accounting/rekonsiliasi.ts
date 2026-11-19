// Laporan rekonsiliasi agregat vs journal (Fase 1, PRD 4 butir F1.9).
//
// Dual-write berarti angka yang sama dihitung DUA kali: dari agregat
// Invoice/Expense (cara lama) dan dari journal (cara baru). Selama keduanya
// hidup, keduanya HARUS menghasilkan angka yang sama — kalau tidak, perpindahan
// ke journal diam-diam mengubah angka yang dilihat pengguna.
//
// Laporan ini adalah alat yang membuat ketidaksesuaian itu terlihat SEBELUM
// terjadi, bukan setelah pengguna mengeluh.
//
// Yang dibandingkan:
//   Pendapatan  : sum(invoice PAID)        vs sum(kredit akun 4-xxxx)
//   Kas masuk   : sum(invoice PAID)        vs sum(debit akun 1-1001 + 1-1002)
//   Pengeluaran : sum(expense)             vs sum(kredit akun 1-1001 + 1-1002)
//   HPP         : sum(unitCost movement)   vs sum(debit akun 5-1000)
//
// BUKAN Comparing: piutang (belum ada jurnal "diterima" untuk yang belum
// dibayar -- aggregate menghitung piutang dari SENT, journal belum), dan laba
// (yang benar-benar diuji lewat ketiganya di atas).

import { hppDariMovementOut } from "@/lib/hpp";
import { prisma } from "@/lib/prisma";
import { KODE_AKUN } from "@/modules/accounting/coa";

export type BarisRekonsiliasi = {
  nama: string;
  /** Angka dari agregat (cara lama, yang dipakai dashboard sekarang). */
  agregat: number;
  /** Angka dari journal (cara baru, yang akan dipakai F1.10). */
  journal: number;
  selisih: number;
  cocok: boolean;
};

export type LaporanRekonsiliasi = {
  tenantId: string;
  sejak: Date | null;
  baris: BarisRekonsiliasi[];
  /** Baris yang tidak cocok. Kalau kosong, tidak ada yang perlu diputuskan. */
  selisih: BarisRekonsiliasi[];
  /** Invoice/expense yang TIDAK punya jurnal sama sekali — penyebab tersering. */
  dokumenTanpaJurnal: {
    invoiceTanpaJurnal: number;
    expenseTanpaJurnal: number;
  };
};

/** Jumlah debit/kredit pada sekumpulan akun, dalam satu periode. */
async function saldoAkun(
  tenantId: string,
  kodeAkun: string[],
  sejak: Date | null,
): Promise<{ debit: number; kredit: number }> {
  const hasil = await prisma.posting.aggregate({
    where: {
      account: { tenantId, code: { in: kodeAkun } },
      ...(sejak ? { journal: { businessDate: { gte: sejak } } } : {}),
    },
    _sum: { amount: true },
  });
  void hasil;

  const baris = await prisma.posting.findMany({
    where: {
      account: { tenantId, code: { in: kodeAkun } },
      ...(sejak ? { journal: { businessDate: { gte: sejak } } } : {}),
    },
    select: { side: true, amount: true },
  });
  let debit = 0;
  let kredit = 0;
  for (const b of baris) {
    const n = Number(b.amount);
    if (b.side === "DEBIT") debit += n;
    else kredit += n;
  }
  return { debit: bulat(debit), kredit: bulat(kredit) };
}

function bulat(n: number): number {
  return Math.round(n * 100) / 100;
}

function bandingkan(nama: string, agregat: number, journal: number): BarisRekonsiliasi {
  const a = bulat(agregat);
  const j = bulat(journal);
  return { nama, agregat: a, journal: j, selisih: bulat(a - j), cocok: a === j };
}

/**
 * Menyusun laporan rekonsiliasi untuk satu tenant.
 *
 * `sejak` dipakai untuk membatasi periode. null = sepanjang waktu.
 */
export async function susunRekonsiliasi(
  tenantId: string,
  sejak: Date | null = null,
): Promise<LaporanRekonsiliasi> {
  const periodeInvoice = sejak
    ? { tenantId, status: "PAID" as const, paidAt: { gte: sejak } }
    : { tenantId, status: "PAID" as const };

  const [pendapatanAgregat, kasAgregat, pengeluaranAgregat, movements] =
    await Promise.all([
      prisma.invoice.aggregate({
        where: periodeInvoice,
        _sum: { totalAmount: true },
      }),
      prisma.invoice.aggregate({
        where: periodeInvoice,
        _sum: { totalAmount: true },
      }),
      prisma.expense.aggregate({
        where: {
          tenantId,
          ...(sejak ? { expenseDate: { gte: sejak } } : {}),
        },
        _sum: { amount: true },
      }),
      prisma.stockMovement.findMany({
        where: {
          type: "OUT",
          batch: { variant: { product: { tenantId } } },
          ...(sejak ? { createdAt: { gte: sejak } } : {}),
        },
        select: { quantity: true, unitCost: true, reference: true },
      }),
    ]);

  // --- Sisi journal ---
  const [pendapatan, kas, bank, pengeluaran, hpp] = await Promise.all([
    saldoAkun(
      tenantId,
      [KODE_AKUN.pendapatanPenjualan, KODE_AKUN.pendapatanJasa],
      sejak,
    ),
    saldoAkun(tenantId, [KODE_AKUN.kas], sejak),
    saldoAkun(tenantId, [KODE_AKUN.bank], sejak),
    saldoAkun(tenantId, [KODE_AKUN.kas, KODE_AKUN.bank], sejak),
    saldoAkun(tenantId, [KODE_AKUN.hpp], sejak),
  ]);

  const hppAgregat = hppDariMovementOut(
    movements.map((m) => ({
      quantity: m.quantity,
      unitCost: m.unitCost === null ? null : Number(m.unitCost),
      reference: m.reference,
    })),
  );

  const baris: BarisRekonsiliasi[] = [
    bandingkan(
      "Pendapatan",
      Number(pendapatanAgregat._sum.totalAmount ?? 0),
      pendapatan.kredit,
    ),
    bandingkan(
      "Kas masuk",
      Number(kasAgregat._sum.totalAmount ?? 0),
      kas.debit + bank.debit,
    ),
    bandingkan(
      "Pengeluaran",
      Number(pengeluaranAgregat._sum.amount ?? 0),
      pengeluaran.kredit,
    ),
    bandingkan("HPP", hppAgregat.hpp, hpp.debit),
  ];

  // Dokumen yang belum punya jurnal: penyebab selisih paling sering, dan
  // tempatnya terlihat tanpa perlu menebak.
  const [invoiceIds, expenseIds, jurnalRef] = await Promise.all([
    prisma.invoice.findMany({
      where: sejak
        ? { tenantId, status: "PAID", paidAt: { gte: sejak } }
        : { tenantId, status: "PAID" },
      select: { id: true },
    }),
    prisma.expense.findMany({
      where: { tenantId, ...(sejak ? { expenseDate: { gte: sejak } } : {}) },
      select: { id: true },
    }),
    prisma.journalEntry.findMany({
      where: { tenantId, source: { in: ["INVOICE", "EXPENSE"] } },
      select: { refId: true },
    }),
  ]);

  const sudahJurnal = new Set(
    jurnalRef.map((j) => j.refId).filter((x): x is string => x !== null),
  );

  return {
    tenantId,
    sejak,
    baris,
    selisih: baris.filter((b) => !b.cocok),
    dokumenTanpaJurnal: {
      invoiceTanpaJurnal: invoiceIds.filter((i) => !sudahJurnal.has(i.id)).length,
      expenseTanpaJurnal: expenseIds.filter((e) => !sudahJurnal.has(e.id)).length,
    },
  };
}
