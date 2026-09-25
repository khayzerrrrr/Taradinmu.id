"use server";

import { pesanErrorUmum, pesanValidasi } from "@/lib/action";
import { checkLimit } from "@/lib/feature-guards";
import { hppInvoiceLunas } from "@/lib/hpp-query";
import { hitungLaba, pilahBeban } from "@/lib/laba";
import { awalBulan, labelPeriode, periodeDari } from "@/lib/periode";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { assertTenantMember } from "@/lib/tenant-access";
import { hitungZakat, round2, ZAKAT_RATE } from "@/lib/zakat";
import {
  NISAB_PENGHASILAN,
  NISAB_PERDAGANGAN,
} from "@/lib/zakat-nisab";
import { isModuleEnabled } from "@/shared/modules";
import type { ActionResponse } from "@/shared/types";
import {
  hitungPerniagaanSchema,
  tandaiZakatSchema,
} from "../schemas/zakat-schema";
import type {
  ZakatHistoryItem,
  ZakatPenghasilan,
  ZakatPerniagaan,
} from "../types";

// Gerbang seragam untuk semua Server Action zakat:
// 1) konteks tenant, 2) feature flag modul ACCOUNTING, 3) keanggotaan sesi.
type AksesZakat =
  | { ok: true; tenantId: string }
  | { ok: false; message: string };

async function aksesZakat(): Promise<AksesZakat> {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    return { ok: false, message: "Konteks tenant tidak ditemukan." };
  }
  if (!isModuleEnabled(tenant.enabledModules, "ACCOUNTING")) {
    return { ok: false, message: "Modul Akuntansi tidak aktif untuk tenant ini." };
  }
  const guard = await assertTenantMember(tenant.id);
  if (!guard.ok) {
    return { ok: false, message: guard.message };
  }
  return { ok: true, tenantId: tenant.id };
}

// Pendapatan (invoice PAID) & kas keluar bulan berjalan, dipilah per kategori.
// Pembelian stok (PURCHASE) TIDAK ikut mengurangi dasar zakat: barang yang masih
// jadi aset bukan rugi. Lihat PRD 4.G.1 — alasannya sama dengan dashboard.
async function ringkasanBulanIni(tenantId: string) {
  const batasBulanIni = awalBulan();
  const [pendapatan, perKategori, hppBarang] = await Promise.all([
    prisma.invoice.aggregate({
      where: { tenantId, status: "PAID", paidAt: { gte: batasBulanIni } },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.expense.groupBy({
      by: ["category"],
      where: { tenantId, expenseDate: { gte: batasBulanIni } },
      _sum: { amount: true },
      _count: true,
    }),
    // Modal barang yang sudah terjual: bagian ketiga dasar zakat (PRD 4.G.1),
    // dan sumber angka yang sama dengan kartu Laba Bersih di dashboard.
    hppInvoiceLunas(tenantId, batasBulanIni),
  ]);

  const beban = pilahBeban(
    perKategori.map((row) => ({
      category: row.category,
      amount: Number(row._sum.amount ?? 0),
      jumlah: row._count,
    })),
  );

  return {
    pendapatan: Number(pendapatan._sum.totalAmount ?? 0),
    jumlahInvoice: pendapatan._count,
    beban,
    hpp: hppBarang.hpp,
    unitModalBelumTercatat: hppBarang.unitTanpaModal,
  };
}

// ZAKAT PENGHASILAN — otomatis: invoice PAID dikurangi BEBAN USAHA bulan berjalan.
// Pembelian stok tidak dikurangkan (PRD 4.G.1).
export async function calculateZakatPenghasilan(): Promise<
  ActionResponse<ZakatPenghasilan>
> {
  const akses = await aksesZakat();
  if (!akses.ok) return { success: false, message: akses.message };

  try {
    const r = await ringkasanBulanIni(akses.tenantId);
    const labaBersih = hitungLaba(r.pendapatan, r.beban, r.hpp);
    const hasil = hitungZakat(labaBersih, NISAB_PENGHASILAN);

    return {
      success: true,
      message: "Perhitungan zakat penghasilan berhasil dimuat.",
      data: {
        periode: labelPeriode(),
        pendapatan: r.pendapatan,
        bebanOperasional: r.beban.operasional,
        pembelianStok: r.beban.pembelian,
        pengeluaranKas: r.beban.total,
        hpp: r.hpp,
        unitModalBelumTercatat: r.unitModalBelumTercatat,
        labaBersih,
        nisab: NISAB_PENGHASILAN,
        rate: ZAKAT_RATE,
        estimasi: hasil.estimasi,
        mencapaiNisab: hasil.mencapaiNisab,
        terutang: hasil.terutang,
        jumlahInvoice: r.jumlahInvoice,
        jumlahPengeluaran: r.beban.jumlah,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal menghitung zakat penghasilan.",
      error: pesanErrorUmum(error),
    };
  }
}

// ZAKAT PERNIAGAAN — manual: aset dikurangi hutang.
export async function calculateZakatPerniagaan(
  input: unknown,
): Promise<ActionResponse<ZakatPerniagaan>> {
  const akses = await aksesZakat();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = hitungPerniagaanSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  try {
    const aset = round2(parsed.data.aset);
    const hutang = round2(parsed.data.hutang);
    const neto = round2(aset - hutang);
    const hasil = hitungZakat(neto, NISAB_PERDAGANGAN);

    return {
      success: true,
      message: "Perhitungan zakat perniagaan berhasil dimuat.",
      data: {
        aset,
        hutang,
        neto,
        nisab: NISAB_PERDAGANGAN,
        rate: ZAKAT_RATE,
        estimasi: hasil.estimasi,
        mencapaiNisab: hasil.mencapaiNisab,
        terutang: hasil.terutang,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal menghitung zakat perniagaan.",
      error: pesanErrorUmum(error),
    };
  }
}

// TANDAI SUDAH DIBAYAR — angka dihitung ulang di server (angka dari client
// tidak pernah dipercaya), lalu disimpan sebagai riwayat di ZakatCalculation.
export async function tandaiZakatDibayar(
  input: unknown,
): Promise<ActionResponse<{ zakatId: string; terutang: string }>> {
  const akses = await aksesZakat();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = tandaiZakatSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  try {
    // Zakat otomatis (penghasilan) adalah fitur PRO: FREE hanya boleh melihat
    // pratinjau, tidak boleh mencatat/menunaikannya.
    if (parsed.data.type === "INCOME") {
      const batas = await checkLimit(akses.tenantId, "ZAKAT");
      if (!batas.allowed) {
        return { success: false, message: batas.message, code: batas.code };
      }
    }

    let totalAssets: number;
    let totalLiabilities: number;
    let nisab: number;

    if (parsed.data.type === "INCOME") {
      const r = await ringkasanBulanIni(akses.tenantId);
      totalAssets = r.pendapatan;
      // Yang dikurangkan adalah beban usaha + HPP barang terjual, bukan seluruh
      // kas keluar — riwayat zakat harus menyimpan dasar yang sama persis dengan
      // angka yang dilihat pengguna (PRD 4.G.1).
      totalLiabilities = round2(r.beban.operasional + r.hpp);
      nisab = NISAB_PENGHASILAN;
    } else {
      totalAssets = round2(parsed.data.aset);
      totalLiabilities = round2(parsed.data.hutang);
      nisab = NISAB_PERDAGANGAN;
    }

    const netAssets = round2(totalAssets - totalLiabilities);
    const hasil = hitungZakat(netAssets, nisab);
    const catatan = parsed.data.notes?.trim();
    // Periode laporan diambil dari bulan berjalan di server (tidak pernah dari
    // klien), supaya riwayat bisa dikelompokkan dan dicetak per bulan.
    const { tahun, bulan } = periodeDari();

    const records = await prisma.zakatCalculation.create({
      data: {
        tenantId: akses.tenantId,
        type: parsed.data.type,
        periodYear: tahun,
        periodMonth: bulan,
        totalAssets: totalAssets.toFixed(2),
        totalLiabilities: totalLiabilities.toFixed(2),
        netAssets: netAssets.toFixed(2),
        nisab: nisab.toFixed(2),
        rate: ZAKAT_RATE.toFixed(4),
        zakatDue: hasil.terutang.toFixed(2),
        isPaid: true,
        paidAt: new Date(),
        notes: catatan && catatan.length > 0 ? catatan : null,
      },
      select: { id: true },
    });

    const label = parsed.data.type === "INCOME" ? "penghasilan" : "perniagaan";
    return {
      success: true,
      message: `Zakat ${label} ditandai sudah dibayar dan tersimpan di riwayat.`,
      data: {
        zakatId: records.id,
        terutang: hasil.terutang.toFixed(2),
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal menyimpan riwayat zakat.",
      error: pesanErrorUmum(error),
    };
  }
}

// Riwayat perhitungan zakat tenant.
export async function getZakatHistory(): Promise<
  ActionResponse<ZakatHistoryItem[]>
> {
  const akses = await aksesZakat();
  if (!akses.ok) return { success: false, message: akses.message };

  try {
    const rows = await prisma.zakatCalculation.findMany({
      where: { tenantId: akses.tenantId },
      // Diurutkan per periode laporan lebih dulu, sehingga riwayat sudah
      // terkelompok saat ditampilkan. `nulls: "last"` menjaga baris tanpa
      // periode tidak menyerobot ke atas (PostgreSQL menaruh NULL di awal DESC).
      orderBy: [
        { periodYear: { sort: "desc", nulls: "last" } },
        { periodMonth: { sort: "desc", nulls: "last" } },
        { calculationDate: "desc" },
      ],
      take: 20,
    });

    return {
      success: true,
      message: "Riwayat zakat berhasil dimuat.",
      data: rows.map((row) => ({
        id: row.id,
        type: row.type,
        calculationDate: row.calculationDate.toISOString(),
        periodYear: row.periodYear,
        periodMonth: row.periodMonth,
        totalAssets: row.totalAssets.toString(),
        totalLiabilities: row.totalLiabilities.toString(),
        netAssets: row.netAssets.toString(),
        nisab: row.nisab.toString(),
        rate: row.rate.toString(),
        zakatDue: row.zakatDue.toString(),
        isPaid: row.isPaid,
        paidAt: row.paidAt ? row.paidAt.toISOString() : null,
        notes: row.notes,
      })),
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal memuat riwayat zakat.",
      error: pesanErrorUmum(error),
    };
  }
}
