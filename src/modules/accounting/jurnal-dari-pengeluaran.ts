// Orkestrasi jurnal untuk pengeluaran operasional (Fase 1, PRD 4 butir F1.8).
//
// Dipisah dari `expense-actions.ts` karena dua alasan:
//   1. PRD 6 melarang modul saling mengimpor langsung; `core` memanggil `core`
//      lewat berkas perantara ini, sama seperti billing -> jurnal-dari-invoice.
//   2. Siklus hidup jurnal pengeluaran (buat / ubah / hapus) adalah aturan
//      akuntansi, bukan urusan HTTP. Menaruhnya di sini membuat aturannya bisa
//      dibuktikan script tanpa menyalakan Next.js.
//
// ATURAN yang dijaga di sini:
//   - kategori PURCHASE TIDAK menghasilkan jurnal beban: pembelian stok adalah
//     aset (persediaan), dan jalurnya `jurnalPembelianStok`. Menjadikannya beban
//     akan menghapus laba dua kali — sekali saat membeli, sekali saat terjual.
//   - "ubah" dan "hapus" MEMBALIK jurnal lama, bukan mengubah atau menghapusnya.
//     Pembukuan yang bisa dibetulkan dengan menimpa barisnya berhenti menjadi bukti.

import type { HasilPosting } from "@/modules/accounting/jurnal-actions";
import {
  batalkanJurnalDokumen,
  jurnalPengeluaran,
} from "@/modules/accounting/jurnal-otomatis";

/** Kategori pengeluaran, sama persis dengan enum `ExpenseCategory` di database. */
export type KategoriPengeluaran =
  | "OPERATIONAL"
  | "PURCHASE"
  | "SALARY"
  | "RENT"
  | "UTILITIES"
  | "MARKETING"
  | "TAX"
  | "OTHER";

/**
 * Apakah kategori ini menghasilkan jurnal BEBAN.
 *
 * Hanya PURCHASE yang tidak: ia masuk aset lewat `jurnalPembelianStok`, dan
 * `jurnalPengeluaran` sengaja menolaknya agar tidak ada dua jalan untuk fakta
 * yang sama.
 */
export function perluJurnalBeban(kategori: KategoriPengeluaran): boolean {
  return kategori !== "PURCHASE";
}

/**
 * Apakah pengeluaran dibayar lewat bank (bukan kas).
 *
 * Nilai `paymentMethod` di database terbatas: "CASH" atau "TRANSFER" (lihat
 * schema `Expense.paymentMethod`). Selain TRANSFER dianggap kas, termasuk `null`
 * — pengeluaran lama yang belum mengisi metode bayar paling aman dianggap tunai.
 */
export function lewatBankDari(
  paymentMethod: string | null | undefined,
): boolean {
  return (paymentMethod ?? "").trim().toUpperCase() === "TRANSFER";
}

export type DataPengeluaran = {
  tenantId: string;
  currency: string;
  expenseId: string;
  /** Nomor nota bila ada; kalau kosong, pemanggil mengirim keterangan. */
  reference: string;
  amount: number;
  kategori: KategoriPengeluaran;
  paymentMethod: string | null;
  tanggal: Date;
};

/** Catat jurnal beban untuk pengeluaran (idempoten: klik ganda tidak menggandakan). */
export async function catatJurnalPengeluaran(
  data: DataPengeluaran,
): Promise<HasilPosting> {
  if (!perluJurnalBeban(data.kategori)) return { ok: true };

  return jurnalPengeluaran({
    tenantId: data.tenantId,
    currency: data.currency,
    expenseId: data.expenseId,
    reference: data.reference,
    amount: data.amount,
    kategori: data.kategori,
    ...(lewatBankDari(data.paymentMethod) ? { lewatBank: true } : {}),
    tanggal: data.tanggal,
  });
}

/**
 * Perbarui jurnal setelah pengeluaran disunting: balik yang lama, catat yang baru.
 *
 * Urutannya penting. Kalau mencatat dulu lalu membalik, jurnal lama masih aktif
 * saat jurnal baru dibuat, dan `simpanJurnalIdempoten` akan menganggapnya duplikat
 * lalu menolak — suntingan pengguna hilang diam-diam.
 */
export async function perbaruiJurnalPengeluaran(
  data: DataPengeluaran,
): Promise<HasilPosting> {
  const batal = await hapusJurnalPengeluaran({
    tenantId: data.tenantId,
    expenseId: data.expenseId,
    tanggal: data.tanggal,
  });
  if (!batal.ok) return batal;
  return catatJurnalPengeluaran(data);
}

/** Balik jurnal aktif milik pengeluaran ini, kalau ada. */
export async function hapusJurnalPengeluaran(input: {
  tenantId: string;
  expenseId: string;
  tanggal: Date;
}): Promise<HasilPosting> {
  return batalkanJurnalDokumen({
    tenantId: input.tenantId,
    refType: "expense",
    refId: input.expenseId,
    source: "EXPENSE",
    tanggal: input.tanggal,
  });
}
