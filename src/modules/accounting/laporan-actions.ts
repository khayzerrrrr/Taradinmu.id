// Server Action untuk laporan keuangan (Fase 1, PRD 4 butir F1.11).
//
// semua angka di sini dibaca dari JOURNAL, bukan dari agregat Invoice/Expense.
// Ini akhir dari dual-write: selama dashboard masih agregat (F1.10) dan laporan
// sudah journal, keduanya bisa dibandingkan -- dan persis itulah yang
// `rekonsiliasi.ts` lakukan.
//
// Gerbang: laporan hanya untuk anggota tenant. NONE di sini memakai
// `checkLimit` — laporan dasar bukan kemampuan berbayar (PRD 4.D: kunci
// kemampuan, jangan kunci kebenaran). Laporan lengkap yang PRO adalah matter
// F1.13.

import { pesanErrorUmum } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import { assertTenantMember } from "@/lib/tenant-access";
import type { ActionResponse } from "@/shared/types";
import { susunRekonsiliasi, type LaporanRekonsiliasi } from "./rekonsiliasi";
import { buatLaporan, LAPORAN_TERSEDIA } from "./laporan";
import type { NamaLaporan, PeriodeLaporan } from "./laporan";

/** Satu laporan keuangan untuk satu periode. */
export type HasilLaporan = {
  nama: NamaLaporan;
  periode: PeriodeLaporan;
  baris: { label: string; nilai: number; tebal?: boolean }[];
  total: { label: string; nilai: number } | null;
};

/**
 * Mengambil satu laporan keuangan.
 *
 * Periode WAJIB diisi dan harus bentuk "YYYY-MM". Tanpa batas periode, laporan
 * laba rugi menjumlahkan seluruh sejarah — dan untuk pengguna yang salah pilih
 * bulan, itu angka yang terlihat benar tapi salah.
 */
export async function ambilLaporan(input: {
  tenantId: string;
  nama: NamaLaporan;
  periode: string;
}): Promise<ActionResponse<HasilLaporan>> {
  const akses = await assertTenantMember(input.tenantId);
  if (!akses.ok) return { success: false, message: akses.message };

  if (!LAPORAN_TERSEDIA.includes(input.nama)) {
    return {
      success: false,
      message: `Laporan "${input.nama}" tidak dikenal. Pilihan: ${LAPORAN_TERSEDIA.join(", ")}.`,
    };
  }
  if (!/^\d{4}-\d{2}$/.test(input.periode)) {
    return { success: false, message: "Periode harus berbentuk YYYY-MM." };
  }

  try {
    const laporan = await buatLaporan(input.tenantId, input.nama, input.periode);
    return {
      success: true,
      message: "Laporan siap.",
      data: {
        nama: input.nama,
        periode: laporan.periode,
        baris: laporan.baris,
        total: laporan.total,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal menyusun laporan.",
      error: pesanErrorUmum(error),
    };
  }
}

/**
 * Rekonsiliasi agregat vs journal untuk seluruh tenant.
 *
 * Hanya SUPER_ADMIN. Alasannya: laporan ini sengaja membaca MINGGUAN
 * (jurnal yang gagal ditulis, invoice tanpa jurnal) -- bukan sesuatu yang perlu
 * dilihat pengguna, dan membocorkan data tenant lain ke satu akun biasa.
 */
export async function ambilRekonsiliasiSemua(
  input: { slug?: string } = {},
): Promise<ActionResponse<{ laporan: LaporanRekonsiliasi[] }>> {
  const { assertSuperAdmin } = await import("@/modules/core/auth/dal");
  const boleh = await assertSuperAdmin();
  if (!boleh.ok) return { success: false, message: boleh.message };

  try {
    const tenant = await prisma.tenant.findMany({
      where: input.slug ? { slug: input.slug } : {},
      select: { id: true },
    });
    const laporan: LaporanRekonsiliasi[] = [];
    for (const t of tenant) {
      laporan.push(await susunRekonsiliasi(t.id));
    }
    return { success: true, message: "ok", data: { laporan } };
  } catch (error) {
    return {
      success: false,
      message: "Gagal menyusun rekonsiliasi.",
      error: pesanErrorUmum(error),
    };
  }
}
