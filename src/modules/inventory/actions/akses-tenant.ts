import { isBatchTrackingEnabled } from "@/lib/business-presets";
import { getCurrentTenant } from "@/lib/tenant";
import { assertTenantEditor, assertTenantMember } from "@/lib/tenant-access";
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
    batchEnabled: isBatchTrackingEnabled(tenant.plan),
  };
}

/**
 * Gerbang TULIS untuk master data pemasok (PRD 4.G.4): hanya OWNER/ADMIN/
 * SUPER_ADMIN, STAFF hanya membaca.
 *
 * Data transaksi (stok masuk/keluar) sengaja TIDAK dipindah ke gerbang ini —
 * perubahan itu akan mencabut kemampuan STAFF yang sudah berjalan hari ini.
 * Master data berbeda sifatnya: satu nama pemasok yang salah ketik menjangkiti
 * seluruh batch berikutnya, jadi ia layak dijaga lebih ketat.
 */
export async function aksesTenantTulis(): Promise<AksesTenant> {
  const akses = await aksesTenant();
  if (!akses.ok) return akses;

  const penulis = await assertTenantEditor(
    akses.tenantId,
    "Akses ditolak. Hanya pemilik atau admin yang boleh mengubah data pemasok.",
  );
  if (!penulis.ok) return { ok: false, message: penulis.message };
  return akses;
}
