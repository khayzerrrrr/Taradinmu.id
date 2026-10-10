"use server";

import { revalidatePath } from "next/cache";
import { pesanErrorUmum, pesanValidasi } from "@/lib/action";
import { labelPeriode } from "@/lib/periode";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { assertTenantMember } from "@/lib/tenant-access";
import { isModuleEnabled } from "@/shared/modules";
import { periodSchema } from "./period-schema";

// Gerbang seragam untuk semua Server Action penutupan periode (ROADMAP F1.12):
// 1) konteks tenant, 2) feature flag modul ACCOUNTING, 3) keanggotaan sesi.
// Jalurnya mengikuti `aksesKeuangan` di modul pengeluaran supaya
// `server-action-guards.test.ts` mengenali rantai action -> pembungkus -> gerbang.
type AksesKeuangan =
  | { ok: true; tenantId: string; userId: string }
  | { ok: false; message: string };

async function aksesKeuangan(): Promise<AksesKeuangan> {
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
  return { ok: true, tenantId: tenant.id, userId: guard.userId };
}

export type BarisPeriode = {
  periode: string;
  status: "OPEN" | "CLOSED";
  closedAt: string | null;
};

// Daftar periode tenant, urut periode terbaru dulu.
//
// Bulan berjalan selalu disisipkan (OPEN) bila belum pernah disentuh: tanpa itu
// pengguna tidak punya baris untuk menutup bulan ini dari UI.
export async function daftarPeriode(): Promise<BarisPeriode[]> {
  const akses = await aksesKeuangan();
  if (!akses.ok) return [];

  try {
    const baris = await prisma.accountingPeriod.findMany({
      where: { tenantId: akses.tenantId },
      orderBy: { period: "desc" },
      select: { period: true, status: true, closedAt: true },
    });

    const hasil: BarisPeriode[] = baris.map((p) => ({
      periode: p.period,
      status: p.status,
      closedAt: p.closedAt ? p.closedAt.toISOString() : null,
    }));

    const sekarang = labelPeriode();
    if (!hasil.some((b) => b.periode === sekarang)) {
      hasil.push({ periode: sekarang, status: "OPEN", closedAt: null });
      hasil.sort((a, b) =>
        a.periode < b.periode ? 1 : a.periode > b.periode ? -1 : 0,
      );
    }
    return hasil;
  } catch (error) {
    // Gagal membaca tabel periode tidak boleh menjatuhkan halaman; sebabnya
    // tetap dicatat lewat `pesanErrorUmum` supaya tidak hilang diam-diam.
    pesanErrorUmum(error);
    return [];
  }
}

// Kunci sebuah periode: mulai sekarang tidak ada posting baru untuk bulan itu.
export async function tutupPeriode(
  periode: string,
): Promise<{ ok: boolean; alasan?: string }> {
  const akses = await aksesKeuangan();
  if (!akses.ok) return { ok: false, alasan: akses.message };

  const parsed = periodSchema.safeParse(periode);
  if (!parsed.success) {
    return { ok: false, alasan: pesanValidasi(parsed.error) };
  }

  try {
    const saat = new Date();
    await prisma.accountingPeriod.upsert({
      where: {
        tenantId_period: { tenantId: akses.tenantId, period: parsed.data },
      },
      create: {
        tenantId: akses.tenantId,
        period: parsed.data,
        status: "CLOSED",
        closedAt: saat,
        closedById: akses.userId,
      },
      update: {
        status: "CLOSED",
        closedAt: saat,
        closedById: akses.userId,
      },
    });
    revalidatePath("/dashboard/keuangan/periode");
    return { ok: true };
  } catch (error) {
    return { ok: false, alasan: pesanErrorUmum(error) };
  }
}

// Buka kembali periode yang sudah ditutup, mis. untuk koreksi.
export async function bukaPeriode(
  periode: string,
): Promise<{ ok: boolean; alasan?: string }> {
  const akses = await aksesKeuangan();
  if (!akses.ok) return { ok: false, alasan: akses.message };

  const parsed = periodSchema.safeParse(periode);
  if (!parsed.success) {
    return { ok: false, alasan: pesanValidasi(parsed.error) };
  }

  try {
    await prisma.accountingPeriod.upsert({
      where: {
        tenantId_period: { tenantId: akses.tenantId, period: parsed.data },
      },
      create: {
        tenantId: akses.tenantId,
        period: parsed.data,
        status: "OPEN",
        closedAt: null,
      },
      update: {
        status: "OPEN",
        closedAt: null,
        closedById: null,
      },
    });
    revalidatePath("/dashboard/keuangan/periode");
    return { ok: true };
  } catch (error) {
    return { ok: false, alasan: pesanErrorUmum(error) };
  }
}