import type { PlanType } from "@/generated/prisma/client";
import {
  HPP_NOL,
  KELENGKAPAN_MODAL_NONAKTIF,
  type HasilHpp,
  type KelengkapanModal,
} from "@/lib/hpp";
import { hppInvoiceLunas, ringkasanKelengkapanModal } from "@/lib/hpp-query";
import {
  ambilBatasFitur,
  kuotaMendesak,
  type KuotaMendesak,
} from "@/lib/plan-limits";
import { awalBulan } from "@/lib/periode";
import { prisma } from "@/lib/prisma";
import {
  EXPIRING_SOON_DAYS,
  isExpiringSoon,
  LOW_STOCK_THRESHOLD,
  ringkasStok,
} from "@/lib/stock";
import { hitungZakat, round2 } from "@/lib/zakat";
import { NISAB_PENGHASILAN } from "@/lib/zakat-nisab";
import { saldoPeriode } from "@/modules/accounting/laporan";
import { hitungRingkasanAkuntansi, type RingkasanAkuntansi } from "@/modules/accounting/laporan-murni";
import { isModuleEnabled } from "@/shared/modules";

// Ringkasan Dashboard Owner.
// Ditaruh di src/lib (shared, boleh memakai Prisma langsung — PRD Bagian 6) supaya
// halaman tetap tipis dan modul tidak perlu saling mengimpor.

/** Ringkasan akuntansi nol: dipakai saat modul Akuntansi belum aktif. */
const RINGKASAN_KOSONG: RingkasanAkuntansi = {
  pendapatan: 0,
  bebanOperasional: 0,
  pembelianStok: 0,
  hpp: 0,
  arusKas: 0,
  labaBersih: 0,
  labaKotor: 0,
};

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
  /** Pendapatan bulan berjalan dari journal (F1.10). */
  pendapatanBulanIni: number;
  /** Total seluruh invoice PAID (sepanjang waktu). */
  totalPendapatan: number;
  jumlahInvoiceLunasBulanIni: number;
  jumlahInvoice: number;

  /**
   * Beban usaha + pembelian stok bulan berjalan (dari journal).
   * 0 bila modul Akuntansi tidak aktif.
   */
  pengeluaranBulanIni: number;
  /** Beban usaha bulan berjalan dari journal (akun 5- selain HPP). */
  bebanOperasionalBulanIni: number;
  /**
   * Saldo akun Persediaan (1-1200) bulan berjalan: uang keluar, tapi barangnya
   * masih jadi aset, jadi angka ini tidak mengurangi laba.
   */
  pembelianStokBulanIni: number;
  /**
   * Arus kas bulan berjalan = gerakan neto Kas (1-1001) + Bank (1-1002).
   * Ini BUKAN saldo kas: sistem tidak menyimpan saldo awal, jadi angkanya
   * menggambarkan pergerakan bulan ini saja.
   */
  arusKasBulanIni: number;
  /**
   * Laba bersih bulan berjalan = pendapatan - HPP - beban usaha (semuanya dari
   * journal, F1.10). Pembelian stok yang masih di rak sengaja tidak ikut
   * dikurangi (PRD 4.G.1); inilah dasar estimasi zakat penghasilan.
   */
  labaBersihBulanIni: number;
  /**
   * HPP bulan berjalan dari journal (akun 5-1000), PRD 4.G.3. 0 bisa berarti
   * "tidak ada barang terjual" ATAU "terjual tapi modalnya belum dicatat" -
   * bedanya ada di `unitModalBelumTercatat`.
   */
  hppBulanIni: number;
  /** Unit keluar yang batch-nya tidak punya harga modal; HPP bulan ini kurang besar. */
  unitModalBelumTercatat: number;
  /**
   * Apakah `hppBulanIni` boleh dibaca sebagai angka utuh (Fase 0.1).
   *
   * Diperisahkan dari `unitModalBelumTercocat` karena satu lubang tidak
   * tertangkapnya: tenant yang stoknya tidak pernah melewati Stok Masuk punya
   * nol movement SEHINGGA nol HPP dan nol `unitModalBelumTercatat` sekaligus.
   * Tanpa penanda ini, kartu Laba Bersih terlihat bersih padahal modalnya belum
   * pernah dicatat — dan zakat penghasilan, yang dihitung dari laba usaha, ikut
   * mewarisi kesalahan itu.
   */
  kelengkapanModal: KelengkapanModal;
  /** Pendapatan bulan ini − HPP. Hanya ditampilkan pada paket PRO. */
  labaKotorBulanIni: number;
  /** Laporan HPP & margin tersedia pada paket ini (PRD 4.G.5). */
  laporanHppAktif: boolean;
  /** Estimasi zakat penghasilan bulan ini (2,5% × laba bersih). */
  estimasiZakat: number;
  /**
   * Zakat otomatis (menarik data + mencatat riwayat) tersedia pada paket ini.
   * Angkanya sendiri tampil di SEMUA paket (PRD 4.D): menghitung estimasi dari
   * data milik tenant bukan kemampuan bayar, dan menyembunyikannya hanya
   * membuat dashboard FREE berbeda dari halaman Zakat yang sudah menampilkan
   * angka yang sama. Yang tetap PRO adalah penarikan otomatis & pencatatannya.
   */
  zakatOtomatisAktif: boolean;
  /** Laba bersih bulan ini sudah mencapai nisab? */
  mencapaiNisabZakat: boolean;
  /** Nisab zakat penghasilan bulanan, untuk keterangan kartu. */
  nisabZakat: number;

  jumlahProduk: number;
  jumlahVarian: number;
  stokMenipis: StokMenipisItem[];
  hampirKedaluwarsa: HampirKedaluwarsaItem[];

  /**
   * Kuota berbasis jumlah yang hampir tersenggol (PRD 4.D.3): hanya terisi pada
   * paket FREE dan hanya bila terpakai >= ambang. Penguna sengaja tidak ikut —
   * batas FREE adalah 1 sehingga meternya akan menyala permanen; ajakan
   * upgrade-nya sudah ada di tombol "Tambah Pengguna".
   */
  kuotaMenipis: KuotaMendesak[];

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
  let totalPendapatan = 0;
  let jumlahInvoiceLunasBulanIni = 0;
  let jumlahInvoice = 0;
  // Dipakai untuk meter kuota: batas FREE dihitung dari invoice yang DIBUAT bulan
  // ini (aturan yang sama dengan checkLimit("INVOICE")), bukan yang lunas.
  let jumlahInvoiceBulanIni = 0;

  if (billingAktif) {
    const [belumBayar, lunasBulanIni, semuaLunas, totalInvoice, dibuatBulanIni] =
      await Promise.all([
        prisma.invoice.aggregate({
          where: { tenantId, status: "SENT" },
          _sum: { totalAmount: true },
          _count: true,
        }),
        prisma.invoice.aggregate({
          where: { tenantId, status: "PAID", paidAt: { gte: batasBulanIni } },
          _count: true,
        }),
        prisma.invoice.aggregate({
          where: { tenantId, status: "PAID" },
          _sum: { totalAmount: true },
        }),
        prisma.invoice.count({ where: { tenantId } }),
        prisma.invoice.count({
          where: { tenantId, createdAt: { gte: batasBulanIni } },
        }),
      ]);

    piutang = Number(belumBayar._sum.totalAmount ?? 0);
    jumlahInvoiceBelumBayar = belumBayar._count;
    totalPendapatan = Number(semuaLunas._sum.totalAmount ?? 0);
    jumlahInvoiceLunasBulanIni = lunasBulanIni._count;
    jumlahInvoice = totalInvoice;
    jumlahInvoiceBulanIni = dibuatBulanIni;
  }

  // --- Akuntansi: SELURUH angka dari journal (F1.10) ---
  // Sumber kebenaran angka akuntansi sudah berpindah ke `Posting` (lihat
  // laporan.ts), jadi dashboard tidak lagi menjumlah Expense/Invoice sendiri.
  // Konsekuensi yang disengaja: dokumen lama yang belum punya jurnal tampak 0
  // di sini — angka yang belum dibukukan memang belum ada.
  let r: RingkasanAkuntansi = RINGKASAN_KOSONG;
  if (accountingAktif) {
    // Batas bulan berjalan dihitung UTC supaya sama persis dengan laporan
    // (jurnal disaring tanggal bisnis; selisih zona bisa memindah satu jurnal
    // ke bulan yang salah). batasBulanIni = awal bulan dari `awalBulan`.
    const batasBulanDepan = new Date(
      Date.UTC(batasBulanIni.getUTCFullYear(), batasBulanIni.getUTCMonth() + 1, 1),
    );
    const sal = await saldoPeriode(tenantId, batasBulanIni, batasBulanDepan);
    r = hitungRingkasanAkuntansi(sal);
  }

  // --- HPP: modal barang dari invoice yang LUNAS bulan berjalan (PRD 4.G.3) ---
  // Hanya ada bila modul Inventory aktif; penjualan item SERVICE memang tidak
  // punya harga pokok barang (PRD 4.G.6).
  // Sejak F1.10 angka HPP dashboard diambil dari journal; perhitungan ini
  // tinggal menyuplai `unitModalBelumTercatat` — penanda modal yang belum dicatat.
  const hppBarang: HasilHpp = inventoryAktif
    ? await hppInvoiceLunas(tenantId, batasBulanIni)
    : HPP_NOL;

  // Penanda "HPP ini belum layak dipercaya" (Fase 0.1). Modul Inventory mati
  // bukan berarti datanya salah, jadi tidak diperingatkan.
  const kelengkapanModal: KelengkapanModal = inventoryAktif
    ? await ringkasanKelengkapanModal(tenantId, batasBulanIni)
    : KELENGKAPAN_MODAL_NONAKTIF;

  // --- Estimasi zakat penghasilan ---
  // Dasar zakat adalah LABA journal, bukan arus kas: toko yang bulan ini menghabiskan kas
  // untuk menimbun stok belum tentu untung — tapi juga belum tentu rugi.
  // Laba bersih sudah memuat HPP & beban pada SEMUA paket (PRD 4.G.5):
  // yang dikunci hanya laporannya, bukan kebenarannya.
  const labaBersih = r.labaBersih;
  const hasilZakat = hitungZakat(labaBersih, NISAB_PENGHASILAN);
  // Angkanya dihitung pada semua paket (PRD 4.D): FREE boleh melihat berapa
  // zakatnya bulan ini; yang PRO adalah menarik datanya otomatis ke riwayat dan
  // menandai lunas — ditegakkan di zakat-actions, bukan dengan menihilkan angka.
  const zakatOtomatisAktif = plan === "PRO";

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

  // --- Kuota paket (PRD 4.D.3) ---
  // Dua batas yang paling sering tersenggol tanpa terasa. Dibangun di sini supaya
  // ambang & batas paket hanya dipakai satu aturan yang sama dengan checkLimit.
  const kuotaMenipis: KuotaMendesak[] = [];
  if (billingAktif) {
    const kuota = kuotaMendesak("INVOICE", plan, jumlahInvoiceBulanIni);
    if (kuota) kuotaMenipis.push(kuota);
  }
  if (inventoryAktif) {
    const kuota = kuotaMendesak("PRODUCT", plan, jumlahProduk);
    if (kuota) kuotaMenipis.push(kuota);
  }

  return {
    billingAktif,
    inventoryAktif,
    accountingAktif,

    piutang,
    jumlahInvoiceBelumBayar,
    pendapatanBulanIni: r.pendapatan,
    totalPendapatan,
    jumlahInvoiceLunasBulanIni,
    jumlahInvoice,

    pengeluaranBulanIni: round2(r.bebanOperasional + r.pembelianStok),
    bebanOperasionalBulanIni: r.bebanOperasional,
    pembelianStokBulanIni: r.pembelianStok,
    // Arus kas = gerakan kas+bank neto bulan ini (dari journal), bukan resep
    // "pendapatan - pengeluaran": penjualan kredit tidak menambah kas.
    arusKasBulanIni: r.arusKas,
    labaBersihBulanIni: r.labaBersih,
    hppBulanIni: r.hpp,
    unitModalBelumTercatat: hppBarang.unitTanpaModal,
    kelengkapanModal,
    labaKotorBulanIni: r.labaKotor,
    laporanHppAktif: ambilBatasFitur(plan, "HPP"),
    estimasiZakat: hasilZakat.estimasi,
    zakatOtomatisAktif,
    mencapaiNisabZakat: hasilZakat.mencapaiNisab,
    nisabZakat: NISAB_PENGHASILAN,

    jumlahProduk,
    jumlahVarian,
    stokMenipis: stokMenipis.slice(0, BATAS_DAFTAR),
    hampirKedaluwarsa: hampirKedaluwarsa.slice(0, BATAS_DAFTAR),
    kuotaMenipis,

    ambangStokMenipis: LOW_STOCK_THRESHOLD,
    ambangHampirKedaluwarsaHari: EXPIRING_SOON_DAYS,
  };
}
