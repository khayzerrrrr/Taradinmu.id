"use server";

import { pesanErrorUmum, pesanValidasi } from "@/lib/action";
import { checkLimit } from "@/lib/feature-guards";
import { simpanLogo, validasiLogo } from "@/lib/logo-storage";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { assertTenantOwner } from "@/lib/tenant-access";
import type { ActionResponse } from "@/shared/types";
import { updateBrandingSchema } from "../schemas/branding-schema";

// White-label (logo & warna kustom) khusus PRO. Keputatannya diambil dari
// checkLimit("BRANDING") — bukan string lokal — supaya pesan penolakannya menyebut
// manfaat dan harga seperti kunci lain, dan supaya aturan paket hanya hidup di
// PLAN_LIMITS (PRD 4.D).
async function tolakanBranding(
  tenantId: string,
): Promise<ActionResponse<never> | null> {
  const batas = await checkLimit(tenantId, "BRANDING");
  if (batas.allowed) return null;
  return { success: false, message: batas.message, code: batas.code };
}

// Simpan warna utama dan/atau logo kustom (khusus plan PRO + role OWNER).
export async function updateTenantBranding(formData: FormData): Promise<
  ActionResponse<{ primaryColor: string; customLogoUrl: string | null }>
> {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    return { success: false, message: "Konteks tenant tidak ditemukan." };
  }

  const guard = await assertTenantOwner(tenant.id);
  if (!guard.ok) return { success: false, message: guard.message };

  const ditolak = await tolakanBranding(tenant.id);
  if (ditolak) return ditolak;

  const parsed = updateBrandingSchema.safeParse({
    primaryColor: formData.get("primaryColor"),
  });
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const berkas = formData.get("logo");
  let customLogoUrl = tenant.customLogoUrl;

  try {
    if (berkas instanceof File && berkas.size > 0) {
      const pesan = validasiLogo(berkas);
      if (pesan) return { success: false, message: pesan };

      customLogoUrl = await simpanLogo(berkas);
    }

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { primaryColor: parsed.data.primaryColor, customLogoUrl },
    });

    return {
      success: true,
      message:
        customLogoUrl !== tenant.customLogoUrl
          ? "Logo dan warna toko berhasil disimpan."
          : "Warna toko berhasil disimpan.",
      data: { primaryColor: parsed.data.primaryColor, customLogoUrl },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal menyimpan pengaturan tampilan.",
      error: pesanErrorUmum(error),
    };
  }
}

// Hapus logo kustom -> kembali memakai logo default TaradinMu.
export async function removeTenantLogo(): Promise<
  ActionResponse<{ customLogoUrl: null }>
> {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    return { success: false, message: "Konteks tenant tidak ditemukan." };
  }

  const guard = await assertTenantOwner(tenant.id);
  if (!guard.ok) return { success: false, message: guard.message };

  const ditolak = await tolakanBranding(tenant.id);
  if (ditolak) return ditolak;

  if (!tenant.customLogoUrl) {
    return { success: false, message: "Tenant ini belum memakai logo kustom." };
  }

  try {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { customLogoUrl: null },
    });

    return {
      success: true,
      message: "Logo kustom dihapus. Tampilan kembali memakai logo TaradinMu.",
      data: { customLogoUrl: null },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal menghapus logo.",
      error: pesanErrorUmum(error),
    };
  }
}
