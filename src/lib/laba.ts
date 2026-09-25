import type { ExpenseCategory } from "@/generated/prisma/client";
import { round2 } from "@/lib/zakat";

// Pemisahan "kas keluar" dari "beban laba" (PRD 4.G.1).
// File murni (tanpa Prisma, tanpa server) agar bisa diuji tanpa database.
//
// Alasan kolom ini ada: pembelian stok mengeluarkan uang, tapi barangnya masih
// jadi aset. Bila angka itu dikurangkan begitu saja dari laba, toko yang belanja
// besar bulan ini tampak rugi — dan zakat penghasilannya ikut salah hitung.

/**
 * Kategori yang merupakan perpindahan aset (kas -> barang), bukan beban usaha.
 * Hanya kategori ini yang boleh keluar dari dasar laba/zakat.
 */
export const KATEGORI_PEMBELIAN_STOK: ReadonlySet<ExpenseCategory> = new Set([
  "PURCHASE",
]);

export type BebanBulan = {
  /** Beban usaha: mengurangi laba dan dasar zakat penghasilan. */
  operasional: number;
  /** Pembelian stok: kas keluar, tapi tidak mengurangi laba. */
  pembelian: number;
  /** Seluruh kas keluar bulan ini (operasional + pembelian). */
  total: number;
  jumlah: number;
};

export type BarisPengeluaran = {
  category: ExpenseCategory;
  /** Jumlah kategori tersebut, sudah dikonversi dari Decimal ke number. */
  amount: number;
  jumlah: number;
};

export const BEBAN_NOL: BebanBulan = {
  operasional: 0,
  pembelian: 0,
  total: 0,
  jumlah: 0,
};

// Pilah hasil agregasi pengeluaran per kategori menjadi beban usaha vs pembelian.
export function pilahBeban(rows: readonly BarisPengeluaran[]): BebanBulan {
  let operasional = 0;
  let pembelian = 0;
  let jumlah = 0;

  for (const row of rows) {
    const amount = Number.isFinite(row.amount) ? row.amount : 0;
    if (KATEGORI_PEMBELIAN_STOK.has(row.category)) pembelian += amount;
    else operasional += amount;
    jumlah += row.jumlah;
  }

  return {
    operasional: round2(operasional),
    pembelian: round2(pembelian),
    total: round2(operasional + pembelian),
    jumlah,
  };
}

/** Arus kas = pendapatan diterima − seluruh kas keluar, termasuk pembelian stok. */
export function hitungArusKas(pendapatan: number, beban: BebanBulan): number {
  return round2(pendapatan - beban.total);
}

/**
 * Laba usaha = pendapatan − beban usaha − HPP barang yang benar-benar terjual
 * (PRD 4.G.1). Pembelian stok sengaja TIDAK dikurangi sebagai beban: ia baru
 * memotong laba lewat `hpp` setelah barangnya keluar dari rak.
 *
 * `hpp` boleh 0 karena dua sebab yang sangat berbeda — barangnya memang jasa,
 * atau modalnya belum dicatat. Pemanggil wajib membaca `unitTanpaModal` dari
 * perhitungan HPP sebelum menyimpulkan labanya penuh (PRD 4.G.6).
 */
export function hitungLaba(
  pendapatan: number,
  beban: BebanBulan,
  hpp = 0,
): number {
  return round2(pendapatan - beban.operasional - hpp);
}
