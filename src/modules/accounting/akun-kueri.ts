// Lapisan BACA-ONLY untuk Bagan Akun (CoA) dan Buku Besar (Fase 1, PRD 4 F1.11).
//
// Kenapa berkas terpisah tanpa sesi: sama seperti jurnal-aktif.ts, angka CoA
// dan mutasi buku besar harus bisa dibaca ulang oleh skrip pembuktian tanpa
// menyalakan Next.js dan tanpa login. Semua fungsi di sini HANYA MEMBACA
// LedgerAccount dan Posting - tidak pernah menulis, tidak pernah menyentuh sesi.
//
// Semua angka berasal dari Posting (bukan dari Invoice/Expense). Di situlah
// sumber kebenaran pembukuan berada, dan halaman CoA/Buku Besar ada justru untuk
// membuat angka itu bisa ditelusuri.

import { prisma } from "@/lib/prisma";

export type InfoAkun = {
  id: string;
  kode: string;
  nama: string;
  tipe: string;
  debit: number;
  kredit: number;
  /** debit - kredit: positif = sisi debit (konvensi repo). */
  saldo: number;
};

export type MutasiPosting = {
  idPosting: string;
  idJournal: string;
  businessDate: Date;
  source: string;
  reference: string | null;
  deskripsi: string | null;
  sisi: string;
  nominal: number;
  saldo: number;
};

/**
 * Label Indonesia untuk JournalSource. Nilai yang belum dikenal dikembalikan
 * apa adanya - lebih jujur menampilkan kode asing daripada menebak artinya.
 */
const LABEL_SUMBER_JURNAL: Record<string, string> = {
  INVOICE: "Penjualan",
  PAYMENT: "Pembayaran",
  STOCK: "Stok",
  EXPENSE: "Pengeluaran",
  MANUAL: "Manual",
  OPENING: "Saldo Awal",
  REVERSAL: "Pembalik",
  CLOSING: "Penutupan",
};

export function labelSumberJurnal(source: string): string {
  return LABEL_SUMBER_JURNAL[source] ?? source;
}
/**
 * Saldo berjalan dari deretan baris: DEBIT menambah, KREDIT mengurangi.
 *
 * Dipisah jadi fungsi murni supaya bisa diuji dengan angka yang diketahui tanpa
 * menyiapkan jurnal di database - tes yang butuh DB hanya akan lolos karena
 * datanya kebetulan benar, bukan karena aritmetikanya benar.
 */
export function hitungSaldoBerjalan(
  rows: readonly { sisi: string; nominal: number }[],
  saldoAwal = 0,
): number[] {
  let saldo = saldoAwal;
  return rows.map((row) => {
    saldo += row.sisi === "DEBIT" ? row.nominal : -row.nominal;
    return saldo;
  });
}

/**
 * Semua akun tenant, urut kode, beserta total debit/kredit dan saldonya.
 *
 * Debit dan kredit dijumlahkan lewat dua groupBy terpisah, bukan dengan memuat
 * seluruh posting lalu menjumlahkan di memori: halaman CoA tidak seharusnya
 * menumbuhkan biaya seiring bertambahnya transaksi. Nol untuk akun yang belum
 * pernah dipakai (bukan null) supaya tabel tidak perlu menebak.
 */
export async function daftarAkun(tenantId: string): Promise<InfoAkun[]> {
  const [akun, debit, kredit] = await Promise.all([
    prisma.ledgerAccount.findMany({
      where: { tenantId },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, type: true },
    }),
    prisma.posting.groupBy({
      by: ["accountId"],
      where: { side: "DEBIT", journal: { tenantId } },
      _sum: { amount: true },
    }),
    prisma.posting.groupBy({
      by: ["accountId"],
      where: { side: "CREDIT", journal: { tenantId } },
      _sum: { amount: true },
    }),
  ]);

  const petaDebit = new Map(
    debit.map((baris) => [baris.accountId, Number(baris._sum.amount ?? 0)]),
  );
  const petaKredit = new Map(
    kredit.map((baris) => [baris.accountId, Number(baris._sum.amount ?? 0)]),
  );

  return akun.map((a) => {
    const totalDebit = petaDebit.get(a.id) ?? 0;
    const totalKredit = petaKredit.get(a.id) ?? 0;
    return {
      id: a.id,
      kode: a.code,
      nama: a.name,
      tipe: a.type,
      debit: totalDebit,
      kredit: totalKredit,
      saldo: totalDebit - totalKredit,
    };
  });
}
/**
 * Mutasi satu akun pada rentang tanggal, urut tanggal akuntansi lalu urutan
 * pembuatan jurnal, dengan saldo berjalan.
 *
 * Rentang memakai [dari, sampai): jurnal tepat di batas akhir bulan TIDAK ikut
 * terhitung, supaya laporan bulan lalu tidak bergerak saat ada transaksi
 * tanggal 1 - konvensi yang sama dengan batasPeriode di laporan-murni.ts.
 */
export async function mutasiAkun(
  tenantId: string,
  accountId: string,
  dari: Date,
  sampai: Date,
): Promise<MutasiPosting[]> {
  const posting = await prisma.posting.findMany({
    where: {
      accountId,
      journal: { tenantId, businessDate: { gte: dari, lt: sampai } },
    },
    select: {
      id: true,
      side: true,
      amount: true,
      journal: {
        select: {
          id: true,
          businessDate: true,
          source: true,
          reference: true,
          description: true,
          createdAt: true,
        },
      },
    },
    // Tanggal akuntansi dulu; untuk tanggal yang sama, urutan pembuatan jurnal
    // yang menentukan, sehingga saldo berjalan selalu punya urutan yang pasti.
    orderBy: [
      { journal: { businessDate: "asc" } },
      { journal: { createdAt: "asc" } },
    ],
  });

  const baris = posting.map((p) => ({
    idPosting: p.id,
    idJournal: p.journal.id,
    businessDate: p.journal.businessDate,
    source: p.journal.source,
    reference: p.journal.reference,
    deskripsi: p.journal.description,
    sisi: p.side,
    nominal: Number(p.amount),
  }));

  const saldo = hitungSaldoBerjalan(baris);
  return baris.map((b, i) => ({ ...b, saldo: saldo[i] }));
}
