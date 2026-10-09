"use server";

import { pesanErrorUmum } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import { BATAS_MINAT, periksaBatas } from "@/lib/rate-limit";
import { getCurrentTenant } from "@/lib/tenant";
import { assertTenantMember } from "@/lib/tenant-access";
import { validasiCatatMinat } from "@/modules/core/schemas/upgrade-schema";
import type { ActionResponse } from "@/shared/types";

// Pencatatan minat upgrade (PRD 4.D.5).
//
// Aksi ini TIDAK mengubah apa pun yang dilihat pengguna: ia hanya menulis satu
// baris jejak. Karena itu dipanggil "api-baris" dari komponen client tanpa
// menunggu hasil — melihatnya gagal tidak boleh sampai mengubah modal.
//
// Batasnya memakai rate limiter yang sudah ada (satu jendela per tenant): yang
// ditahan hanya banjir baris, bukan orang yang memang membuka-tutup modal karena
// penasaran. Itu justru data yang diinginkan.

export async function catatMinatUpgrade(
  input: unknown,
): Promise<ActionResponse<null>> {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    return { success: false, message: "Konteks tenant tidak ditemukan." };
  }

  // Gerbang izin: hanya anggota tenant ini yang boleh mencatat minat tenant ini.
  // Tanpa gerbang, aksi apa pun yang menerima `kunci` bisa dipakai menulis atas
  // nama tenant lain.
  const guard = await assertTenantMember(tenant.id);
  if (!guard.ok) return { success: false, message: guard.message };

  const data = validasiCatatMinat(input);
  if (!data) {
    // Pesan umum: input yang ditolak di sini selalu berarti pemanggilnya salah
    // atau memalsukan nilai, bukan kesalahan yang bisa diperbaiki pengguna.
    return { success: false, message: "Catatan minat tidak dikenali." };
  }

  const batas = await periksaBatas(`minat:${tenant.id}`, BATAS_MINAT);
  if (!batas.allowed) {
    return { success: false, message: "Terlalu banyak catatan, coba lagi nanti." };
  }

  try {
    await prisma.upgradeInterest.create({
      data: { tenantId: tenant.id, ...data },
    });
    return { success: true, message: "Minat tercatat.", data: null };
  } catch (error) {
    return {
      success: false,
      message: "Gagal mencatat minat.",
      error: pesanErrorUmum(error, {
        aksi: "catatMinatUpgrade",
        tenantId: tenant.id,
      }),
    };
  }
}
