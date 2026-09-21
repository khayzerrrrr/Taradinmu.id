import { isBatchTrackingEnabled } from "@/lib/business-presets";
import { getCurrentTenant } from "@/lib/tenant";
import { assertTenantMember } from "@/lib/tenant-access";
import { isModuleEnabled } from "@/shared/modules";

export type AksesTenant =
  | { ok: true; tenantId: string; batchEnabled: boolean }
  | { ok: false; message: string };

// Gerbang seragam untuk semua Server Action modul inventory:
// 1) konteks tenant, 2) feature flag modul, 3) keanggotaan sesi,
// sekaligus meneruskan apakah fitur batch aktif untuk tenant ini.
export async function aksesTenant(): Promise<AksesTenant> {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    return { ok: false, message: "Konteks tenant tidak ditemukan." };
  }
  if (!isModuleEnabled(tenant.enabledModules, "INVENTORY")) {
    return { ok: false, message: "Modul Inventory tidak aktif untuk tenant ini." };
  }
  const guard = await assertTenantMember(tenant.id);
  if (!guard.ok) {
    return { ok: false, message: guard.message };
  }
  return {
    ok: true,
    tenantId: tenant.id,
    batchEnabled: isBatchTrackingEnabled(tenant.plan, tenant.businessType),
  };
}
