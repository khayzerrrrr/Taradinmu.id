"use server";

import { pesanErrorUmum, pesanValidasi } from "@/lib/action";
import { simpanLogo, validasiLogo } from "@/lib/logo-storage";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { assertTenantOwner } from "@/lib/tenant-access";
import type { ActionResponse } from "@/shared/types";
import { updateBrandingSchema } from "../schemas/branding-schema";

const PESAN_KHUSUS_PRO =
  "Fitur white-label (logo & warna kustom) hanya tersedia untuk plan PRO.";

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

  if (!tenant.isPro) {
    return { success: false, message: PESAN_KHUSUS_PRO };
  }

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

  if (!tenant.isPro) {
    return { success: false, message: PESAN_KHUSUS_PRO };
  }

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
