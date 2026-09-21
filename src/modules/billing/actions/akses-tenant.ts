import { getCurrentTenant } from "@/lib/tenant";
import { assertTenantMember } from "@/lib/tenant-access";
import { isModuleEnabled } from "@/shared/modules";

export type AksesTenant =
  | { ok: true; tenantId: string; tenantSlug: string }
  | { ok: false; message: string };

// Gerbang seragam untuk semua Server Action modul billing:
// 1) konteks tenant, 2) feature flag modul BILLING, 3) keanggotaan sesi.
export async function aksesTenant(): Promise<AksesTenant> {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    return { ok: false, message: "Konteks tenant tidak ditemukan." };
  }
  if (!isModuleEnabled(tenant.enabledModules, "BILLING")) {
    return { ok: false, message: "Modul Billing tidak aktif untuk tenant ini." };
  }
  const guard = await assertTenantMember(tenant.id);
  if (!guard.ok) {
    return { ok: false, message: guard.message };
  }
  return { ok: true, tenantId: tenant.id, tenantSlug: tenant.slug };
}
