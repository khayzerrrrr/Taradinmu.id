// Penulisan jurnal dari perubahan status invoice (Fase 1.8).
//
// Dipisah dari `invoice-actions.ts` supaya modul billing tidak mengimpor modul
// accounting secara langsung -- aturan isolasi modul di PRD 6. Modul ini tinggal
// mengimpor dari `@/modules/accounting`, satu arah.
//
// Urutan jurnal untuk satu invoice:
//   SENT/PAID -> jurnal pendapatan   (Dr Piutang, Cr Pendapatan)
//   PAID      -> jurnal pembayaran    (Dr Kas,   Cr Piutang)
//   PAID      -> jurnal HPP          (Dr HPP,    Cr Persediaan)
//
// HPP dibaca dari `StockMovement` seperti di seluruh aplikasi (PRD 4.G.3), bukan
// dari kolom baru di invoice.

import { prisma } from "@/lib/prisma";
import {
  jurnalHppInvoice,
  jurnalPembayaranInvoice,
  jurnalPendapatanInvoice,
} from "@/modules/accounting/jurnal-otomatis";
import { hppDokumen } from "@/lib/hpp-query";

type StatusInvoice = "DRAFT" | "SENT" | "PAID" | "OVERDUE";

/**
 * Menulis jurnal yang sesuai untuk transisi status invoice.
 *
 * Mengembalikan daftar jurnal yang benar-benar ditulis (yang sudah ada sebelumnya
 * tidak dihitung ulang) supaya bisa dipakai reconciliation report.
 */
export async function tulisJurnalInvoice(input: {
  tenantId: string;
  currency: string;
  invoiceId: string;
  statusSebelum: string;
  status: string;
}): Promise<string[]> {
  const sebelum = input.statusSebelum as StatusInvoice;
  const sesudah = input.status as StatusInvoice;

  // Menuju DRAFT berarti faktur kembali bisa disunting, jadi pengakuan
  // pendapatan yang sudah terjadi harus dibatalkan lewat jurnal pembalik --
  // bukan dihapus. Ke sini hanya lewat `deleteInvoice`, jadi jalur ini praktis
  // tidak terjadi, tapi percakonnetnya dijaga.
  if (sesudah === "DRAFT") return [];

  const invoice = await prisma.invoice.findFirst({
    where: { id: input.invoiceId, tenantId: input.tenantId },
    select: {
      id: true,
      invoiceNumber: true,
      totalAmount: true,
      createdAt: true,
      paidAt: true,
      items: {
        select: {
          quantity: true,
          price: true,
          variant: { select: { product: { select: { kind: true } } } },
        },
      },
    },
  });
  if (!invoice) return [];

  const tanggal = invoice.paidAt ?? invoice.createdAt;
  const ditulis: string[] = [];

  // --- Pendapatan diakui saat faktur LEAVES DRAFT ---
  // DRAFT sendiri tidak menghasilkan jurnal: selama faktur masih bisa diubah,
  // pengakuan pendapatan belum terjadi.
  if (sebelum === "DRAFT" && (sesudah === "SENT" || sesudah === "PAID" || sesudah === "OVERDUE")) {
    const jasa = hitungJasa(invoice.items);
    const hasil = await jurnalPendapatanInvoice({
      tenantId: input.tenantId,
      currency: input.currency,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      totalAmount: Number(invoice.totalAmount),
      ...(jasa > 0 ? { subtotal: jasa } : {}),
      tanggal: invoice.createdAt,
    });
    if (hasil.ok && hasil.journalId) ditulis.push(hasil.journalId);
  }

  // --- Kas masuk saat lunas ---
  if (sesudah === "PAID" && sebelum !== "PAID") {
    const hasil = await jurnalPembayaranInvoice({
      tenantId: input.tenantId,
      currency: input.currency,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      totalAmount: Number(invoice.totalAmount),
      tanggal,
    });
    if (hasil.ok && hasil.journalId) ditulis.push(hasil.journalId);

    // --- HPP diakui bersamaan dengan pelunasan ---
    // Basisnya sama dengan pendapatan: keduanya diakui saat invoice lunas, bukan
    // saat stok keluar. Kalau HPP mengikuti tanggal movement, satu invoice draft
    // akan tampil sebagai rugi sebesar seluruh modalnya (PRD 4.G.3).
    const hpp = await hppDokumen(input.tenantId, invoice.invoiceNumber);
    const hasilHpp = await jurnalHppInvoice({
      tenantId: input.tenantId,
      currency: input.currency,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      hpp: hpp.hpp,
      tanggal,
    });
    if (hasilHpp.ok && hasilHpp.journalId) ditulis.push(hasilHpp.journalId);
  }

  return ditulis;
}

/**
 * Nominal bagian JASA pada invoice.
 *
 * `engine-jurnal` memakai `subtotal` sebagai bagian jasa dalam RUPIAH, bukan
 * jumlah unit. Mengirim quantity akan salah setiap kali harga satuan tidak
 * seragam -- dan invoice campuran (barang + jasa dalam satu faktur) justru
 * kasus yang paling umum di usaha jasa.
 */
function hitungJasa(
  items: {
    quantity: number;
    price: { toString(): string };
    variant: { product: { kind: string } };
  }[],
): number {
  return Math.round(
    items
      .filter((i) => i.variant.product.kind === "SERVICE")
      .reduce((s, i) => s + i.quantity * Number(i.price.toString()), 0) * 100,
  ) / 100;
}
