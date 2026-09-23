"use server";

import { pesanErrorUmum, pesanValidasi } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import type { ActionResponse } from "@/shared/types";
import { update } from "../auth";
import { assertSuperAdmin } from "../auth/dal";
import { masukSebagaiTenantSchema } from "../schemas/impersonation-schema";

// Mode "masuk sebagai tenant" (PRD Bagian 4.B) — hanya untuk SUPER_ADMIN, supaya
// platform owner bisa menelusuri masalah tenant tanpa meminta sandi pelanggan.
//
// PENTING — ini BUKAN penurunan hak. `role` sengaja dibiarkan SUPER_ADMIN agar
// /admin tidak ikut terkunci saat mode ini aktif; yang diubah hanya `tenantId`
// (konteks tenant) dan penanda `impersonatedBy` (pemicu banner). Karena itu
// banner di UI menyatakannya apa adanya, dan halaman ini tidak boleh disebut
// sebagai "login sebagai pengguna".
//
// Sebelumnya mode seperti ini sebenarnya sudah bisa dilakukan (SEMUA guard tenant
// melewatkan SUPER_ADMIN, lihat src/lib/tenant-access.ts) — yang belum ada adalah
// titik masuk, penanda sesi, dan jalan keluar yang jelas.

export type HasilImpersonasi = ActionResponse<{ slug: string }>;

export async function masukSebagaiTenant(
  input: unknown,
): Promise<HasilImpersonasi> {
  const akses = await assertSuperAdmin();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = masukSebagaiTenantSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: parsed.data.tenantId },
      select: { id: true, name: true, slug: true },
    });
    if (!tenant) {
      return { success: false, message: "Tenant tidak ditemukan." };
    }

    // Menulis ulang sesi JWT agar konteks tenant ikut terbawa ke setiap request.
    await update({
      user: {
        tenantId: tenant.id,
        impersonatedBy: akses.userId,
        impersonatingTenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
        },
      },
    });

    return {
      success: true,
      message: `Masuk sebagai ${tenant.name}.`,
      data: { slug: tenant.slug },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal masuk sebagai tenant.",
      error: pesanErrorUmum(error),
    };
  }
}

// Kembalikan sesi ke keadaan Super Admin biasa (tanpa konteks tenant).
export async function keluarDariImpersonasi(): Promise<ActionResponse> {
  const akses = await assertSuperAdmin();
  if (!akses.ok) return { success: false, message: akses.message };

  try {
    await update({
      user: {
        tenantId: null,
        impersonatedBy: null,
        impersonatingTenant: null,
      },
    });

    return { success: true, message: "Keluar dari mode melihat tenant." };
  } catch (error) {
    return {
      success: false,
      message: "Gagal keluar dari mode melihat tenant.",
      error: pesanErrorUmum(error),
    };
  }
}
