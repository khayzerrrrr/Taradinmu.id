import type { PlanType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  EXPIRING_SOON_DAYS,
  isExpiringSoon,
  LOW_STOCK_THRESHOLD,
  ringkasStok,
} from "@/lib/stock";
import { hitungZakat, round2 } from "@/lib/zakat";
import { NISAB_PENGHASILAN } from "@/lib/zakat-nisab";
import { isModuleEnabled } from "@/shared/modules";

// Ringkasan Dashboard Owner.
// Ditaruh di src/lib (shared, boleh memakai Prisma langsung — PRD Bagian 6) supaya
// halaman tetap tipis dan modul tidak perlu saling mengimpor.

const BATAS_DAFTAR = 5;

export type StokMenipisItem = {
  variantId: string;
  sku: string;
  variantName: string;
  productName: string;
  tersedia: number;
};

export type HampirKedaluwarsaItem = {
  variantId: string;
  sku: string;
  variantName: string;
  batchNumber: string;
  quantity: number;
  expiredDate: string;
};

export type RingkasanOwner = {
  billingAktif: boolean;
  inventoryAktif: boolean;
  accountingAktif: boolean;

  /** Total tagihan invoice berstatus SENT (belum dibayar). */
  piutang: number;
  jumlahInvoiceBelumBayar: number;
  /** Total invoice PAID yang paidAt-nya di bulan berjalan. */
  pendapatanBulanIni: number;
  /** Total seluruh invoice PAID (sepanjang waktu). */
  totalPendapatan: number;
  jumlahInvoiceLunasBulanIni: number;
  jumlahInvoice: number;

  /** Pengeluaran bulan berjalan (0 bila modul Akuntansi tidak aktif). */
  pengeluaranBulanIni: number;
  /** Estimasi zakat penghasilan bulan ini; null bila fitur PRO belum aktif. */
  estimasiZakat: number | null;
  /** Laba bersih bulan ini sudah mencapai nisab? */
  mencapaiNisabZakat: boolean;
  /** Nisab zakat penghasilan bulanan, untuk keterangan kartu. */
  nisabZakat: number;

  jumlahProduk: number;
  jumlahVarian: number;
  stokMenipis: StokMenipisItem[];
  hampirKedaluwarsa: HampirKedaluwarsaItem[];

  ambangStokMenipis: number;
  ambangHampirKedaluwarsaHari: number;
};

export async function getOwnerSummary(
  tenantId: string,
  enabledModules: readonly string[],
  plan: PlanType,
): Promise<RingkasanOwner> {
  const billingAktif = isModuleEnabled(enabledModules, "BILLING");
  const inventoryAktif = isModuleEnabled(enabledModules, "INVENTORY");
  const accountingAktif = isModuleEnabled(enabledModules, "ACCOUNTING");
  const sekarang = new Date();
  const awalBulan = new Date(
    Date.UTC(sekarang.getUTCFullYear(), sekarang.getUTCMonth(), 1),
  );

  // --- Billing ---
  let piutang = 0;
  let jumlahInvoiceBelumBayar = 0;
  let pendapatanBulanIni = 0;
  let totalPendapatan = 0;
  let jumlahInvoiceLunasBulanIni = 0;
  let jumlahInvoice = 0;

  if (billingAktif) {
    const [belumBayar, lunasBulanIni, semuaLunas, totalInvoice] =
      await Promise.all([
        prisma.invoice.aggregate({
          where: { tenantId, status: "SENT" },
          _sum: { totalAmount: true },
          _count: true,
        }),
        prisma.invoice.aggregate({
          where: { tenantId, status: "PAID", paidAt: { gte: awalBulan } },
          _sum: { totalAmount: true },
          _count: true,
        }),
        prisma.invoice.aggregate({
          where: { tenantId, status: "PAID" },
          _sum: { totalAmount: true },
        }),
        prisma.invoice.count({ where: { tenantId } }),
      ]);

    piutang = Number(belumBayar._sum.totalAmount ?? 0);
    jumlahInvoiceBelumBayar = belumBayar._count;
    pendapatanBulanIni = Number(lunasBulanIni._sum.totalAmount ?? 0);
    totalPendapatan = Number(semuaLunas._sum.totalAmount ?? 0);
    jumlahInvoiceLunasBulanIni = lunasBulanIni._count;
    jumlahInvoice = totalInvoice;
  }

  // --- Akuntansi: pengeluaran bulan berjalan ---
  let pengeluaranBulanIni = 0;
  if (accountingAktif) {
    const pengeluaran = await prisma.expense.aggregate({
      where: { tenantId, expenseDate: { gte: awalBulan } },
      _sum: { amount: true },
    });
    pengeluaranBulanIni = Number(pengeluaran._sum.amount ?? 0);
  }

  // --- Estimasi zakat penghasilan (fitur PRO) ---
  const labaBersih = round2(pendapatanBulanIni - pengeluaranBulanIni);
  const hasilZakat = hitungZakat(labaBersih, NISAB_PENGHASILAN);
  const estimasiZakat = plan === "PRO" ? hasilZakat.estimasi : null;

  // --- Inventory ---
  let jumlahProduk = 0;
  let jumlahVarian = 0;
  const stokMenipis: StokMenipisItem[] = [];
  const hampirKedaluwarsa: HampirKedaluwarsaItem[] = [];

  if (inventoryAktif) {
    const [produk, varian] = await Promise.all([
      prisma.product.count({ where: { tenantId } }),
      prisma.productVariant.findMany({
        where: { product: { tenantId } },
        select: {
          id: true,
          sku: true,
          name: true,
          product: { select: { name: true } },
          batches: {
            select: { batchNumber: true, quantity: true, expiredDate: true },
          },
        },
      }),
    ]);

    jumlahProduk = produk;
    jumlahVarian = varian.length;

    for (const item of varian) {
      const ringkasan = ringkasStok(item.batches, sekarang);

      if (ringkasan.layak <= LOW_STOCK_THRESHOLD) {
        stokMenipis.push({
          variantId: item.id,
          sku: item.sku,
          variantName: item.name,
          productName: item.product.name,
          tersedia: ringkasan.layak,
        });
      }

      for (const batch of item.batches) {
        if (
          batch.quantity > 0 &&
          batch.expiredDate &&
          isExpiringSoon(batch.expiredDate, sekarang)
        ) {
          hampirKedaluwarsa.push({
            variantId: item.id,
            sku: item.sku,
            variantName: item.name,
            batchNumber: batch.batchNumber,
            quantity: batch.quantity,
            expiredDate: batch.expiredDate.toISOString(),
          });
        }
      }
    }

    stokMenipis.sort((a, b) => a.tersedia - b.tersedia);
    hampirKedaluwarsa.sort((a, b) => a.expiredDate.localeCompare(b.expiredDate));
  }

  return {
    billingAktif,
    inventoryAktif,
    accountingAktif,

    piutang,
    jumlahInvoiceBelumBayar,
    pendapatanBulanIni,
    totalPendapatan,
    jumlahInvoiceLunasBulanIni,
    jumlahInvoice,

    pengeluaranBulanIni,
    estimasiZakat,
    mencapaiNisabZakat: hasilZakat.mencapaiNisab,
    nisabZakat: NISAB_PENGHASILAN,

    jumlahProduk,
    jumlahVarian,
    stokMenipis: stokMenipis.slice(0, BATAS_DAFTAR),
    hampirKedaluwarsa: hampirKedaluwarsa.slice(0, BATAS_DAFTAR),

    ambangStokMenipis: LOW_STOCK_THRESHOLD,
    ambangHampirKedaluwarsaHari: EXPIRING_SOON_DAYS,
  };
}
