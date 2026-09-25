import type { PlanType } from "@/generated/prisma/client";
import { HPP_NOL, labaKotor, type HasilHpp } from "@/lib/hpp";
import { hppInvoiceLunas } from "@/lib/hpp-query";
import { BEBAN_NOL, hitungArusKas, hitungLaba, pilahBeban } from "@/lib/laba";
import { ambilBatasFitur } from "@/lib/plan-limits";
import { awalBulan } from "@/lib/periode";
import { prisma } from "@/lib/prisma";
import {
  EXPIRING_SOON_DAYS,
  isExpiringSoon,
  LOW_STOCK_THRESHOLD,
  ringkasStok,
} from "@/lib/stock";
import { hitungZakat } from "@/lib/zakat";
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

  /**
   * Seluruh kas keluar bulan berjalan, termasuk pembelian stok.
   * 0 bila modul Akuntansi tidak aktif.
   */
  pengeluaranBulanIni: number;
  /** Kas keluar yang menjadi beban usaha (di luar pembelian stok). */
  bebanOperasionalBulanIni: number;
  /**
   * Pembelian stok bulan berjalan (kategori PURCHASE): uang keluar, tapi
   * barangnya masih jadi aset, jadi angka ini tidak mengurangi laba.
   */
  pembelianStokBulanIni: number;
  /**
   * Arus kas bulan berjalan = pendapatan yang sudah diterima − SELURUH kas keluar,
   * termasuk pembelian stok.
   * Ini BUKAN saldo kas: sistem tidak menyimpan saldo awal, jadi angkanya
   * menggambarkan pergerakan bulan ini saja.
   */
  arusKasBulanIni: number;
  /**
   * Laba bersih bulan berjalan = pendapatan − beban usaha − HPP barang dari
   * invoice yang lunas. Pembelian stok yang masih di rak sengaja tidak ikut
   * dikurangi (PRD 4.G.1); inilah dasar estimasi zakat penghasilan.
   */
  labaBersihBulanIni: number;
  /**
   * Nilai modal barang yang keluar untuk penjualan yang sudah dibayar bulan ini
   * (PRD 4.G.3). 0 bisa berarti "tidak ada barang terjual" ATAU "terjual tapi
   * modalnya belum dicatat" — bedanya ada di `unitModalBelumTercatat`.
   */
  hppBulanIni: number;
  /** Unit keluar yang batch-nya tidak punya harga modal; HPP bulan ini kurang besar. */
  unitModalBelumTercatat: number;
  /** Pendapatan bulan ini − HPP. Hanya ditampilkan pada paket PRO. */
  labaKotorBulanIni: number;
  /** Laporan HPP & margin tersedia pada paket ini (PRD 4.G.5). */
  laporanHppAktif: boolean;
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
  const batasBulanIni = awalBulan(sekarang);

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
          where: { tenantId, status: "PAID", paidAt: { gte: batasBulanIni } },
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

  // --- Akuntansi: kas keluar bulan berjalan, dipilah per kategori ---
  // groupBy, bukan satu agregat: pembelian stok harus bisa dipisahkan dari beban
  // usaha sebelum laba dihitung (PRD 4.G.1).
  let beban = BEBAN_NOL;
  if (accountingAktif) {
    const perKategori = await prisma.expense.groupBy({
      by: ["category"],
      where: { tenantId, expenseDate: { gte: batasBulanIni } },
      _sum: { amount: true },
      _count: true,
    });

    beban = pilahBeban(
      perKategori.map((row) => ({
        category: row.category,
        amount: Number(row._sum.amount ?? 0),
        jumlah: row._count,
      })),
    );
  }

  // --- HPP: modal barang dari invoice yang LUNAS bulan berjalan (PRD 4.G.3) ---
  // Hanya ada bila modul Inventory aktif; penjualan item SERVICE memang tidak
  // punya harga pokok barang (PRD 4.G.6).
  // Basisnya sengaja sama dengan pendapatanBulanIni di atas: stok sudah dipotong
  // sejak draft, jadi HPP yang mengikuti movement OUT akan membuat rugi phantom.
  const hppBarang: HasilHpp = inventoryAktif
    ? await hppInvoiceLunas(tenantId, batasBulanIni)
    : HPP_NOL;

  // --- Estimasi zakat penghasilan (fitur PRO) ---
  // Dasar zakat adalah LABA, bukan arus kas: toko yang bulan ini menghabiskan kas
  // untuk menimbun stok belum tentu untung — tapi juga belum tentu rugi.
  // HPP tetap dikurangi pada SEMUA paket (PRD 4.G.5): yang dikunci hanya
  // laporannya, bukan kebenarannya.
  const labaBersih = hitungLaba(pendapatanBulanIni, beban, hppBarang.hpp);
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

    pengeluaranBulanIni: beban.total,
    bebanOperasionalBulanIni: beban.operasional,
    pembelianStokBulanIni: beban.pembelian,
    // Arus kas = seluruh kas keluar; laba = hanya beban usaha (PRD 4.G.1).
    arusKasBulanIni: hitungArusKas(pendapatanBulanIni, beban),
    labaBersihBulanIni: labaBersih,
    hppBulanIni: hppBarang.hpp,
    unitModalBelumTercatat: hppBarang.unitTanpaModal,
    labaKotorBulanIni: labaKotor(pendapatanBulanIni, hppBarang.hpp),
    laporanHppAktif: ambilBatasFitur(plan, "HPP"),
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
