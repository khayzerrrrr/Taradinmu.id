import type { Prisma } from "@/generated/prisma/client";
import type { HasilHpp } from "@/lib/hpp";
import { hppDariMovementOut, hitungHpp, HPP_NOL } from "@/lib/hpp";
import { prisma } from "@/lib/prisma";

// Pembacaan HPP dari database (PRD 4.G.3). Aturan angkanya ada di src/lib/hpp.ts;
// berkas ini hanya mengambil baris movement yang benar dan mengonversi Decimal.
//
// Dipakai dua permukaan: dashboard/zakat (satu periode, basis invoice lunas) dan
// detail invoice (satu dokumen). Menyalin query-nya di dua tempat adalah cara
// tercepat membuat keduanya berbeda angka — persis cacat yang dihindari 4.F.2.

const PILIHAN_HPP = {
  quantity: true,
  unitCost: true,
  reference: true,
} as const satisfies Prisma.StockMovementSelect;

type BarisMovement = {
  quantity: number;
  unitCost: Prisma.Decimal | null;
  reference: string | null;
};

/**
 * HPP barang yang TERJUAL pada periode tertentu, dengan basis pengakuan yang
 * sama dengan kartu pendapatan: invoice PAID dengan `paidAt` >= `sejakLunas`.
 *
 * Menyaring lewat nomor invoice, bukan `movement.createdAt`, karena penjualan
 * dipotong stoknya saat masih Draft. Kalau yang dihitung semua movement OUT,
 * satu invoice draft saja membuat dashboard menampilkan rugi sebesar seluruh
 * modalnya padahal pendapatan bulan itu masih nol.
 *
 * Konsekuensi yang disengaja: stok keluar manual (tanpa reference invoice) tidak
 * masuk HPP. Barang yang hilang/rusak memang belum punya jalur pembukuan sendiri
 * — dicatat di ROADMAP, bukan dipaksakan jadi harga pokok.
 */
export async function hppInvoiceLunas(
  tenantId: string,
  sejakLunas: Date,
): Promise<HasilHpp> {
  const invoiceLunas = await prisma.invoice.findMany({
    where: { tenantId, status: "PAID", paidAt: { gte: sejakLunas } },
    select: { invoiceNumber: true },
  });
  if (invoiceLunas.length === 0) return HPP_NOL;

  const movements = await prisma.stockMovement.findMany({
    where: {
      type: "OUT",
      reference: { in: invoiceLunas.map((i) => i.invoiceNumber) },
      // StockMovement tidak punya tenantId; jalan satu-satunya lewat batch ->
      // varian -> produk, sama seperti penyaringan di kembalikanStokDariReferensi.
      batch: { variant: { product: { tenantId } } },
    },
    select: PILIHAN_HPP,
  });

  return hppDariMovementOut(movements.map(keBarisMovement));
}

/**
 * HPP satu dokumen, dibedakan lewat `reference` = nomor invoice.
 * Pencocokan persis sudah cukup mengecualikan dokumen yang dibatalkan:
 * pengembalian stok mengganti reference movement OUT menjadi berakhiran
 * `#BATAL`, jadi ia tidak lagi cocok dengan nomor aslinya.
 */
export async function hppDokumen(
  tenantId: string,
  reference: string,
): Promise<HasilHpp> {
  const movements = await prisma.stockMovement.findMany({
    where: {
      type: "OUT",
      reference,
      batch: { variant: { product: { tenantId } } },
    },
    select: PILIHAN_HPP,
  });

  return hitungHpp(movements.map(keBarisMovement));
}

function keBarisMovement(movement: BarisMovement) {
  return {
    quantity: movement.quantity,
    // null dipertahankan: "belum diketahui" bukan nol (PRD 4.G.2).
    unitCost: movement.unitCost === null ? null : Number(movement.unitCost),
    reference: movement.reference,
  };
}
