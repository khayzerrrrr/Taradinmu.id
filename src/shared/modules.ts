// Registry modul (feature flags) — shared agar bisa dipakai semua modul
// tanpa saling mengimpor (PRD Bagian 6: isolasi modul).

export const MODULE_KEYS = ["INVENTORY", "BILLING", "ACCOUNTING", "PROGRAM"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export const AVAILABLE_MODULES: { key: ModuleKey; label: string }[] = [
  { key: "INVENTORY", label: "Inventory (Katalog, Stok & Batch)" },
  { key: "BILLING", label: "Billing (Invoice & Piutang)" },
  // Label lama menyebut "(Fase 2)", padahal pengeluaran & zakat sudah jalan
  // dan sekarang diaktifkan untuk semua tenant baru.
  { key: "ACCOUNTING", label: "Akuntansi (Pengeluaran & Zakat)" },
  // PRD 4.F: satu mesin untuk kloter umrah, proyek, dan tahun ajaran.
  { key: "PROGRAM", label: "Program (Kloter, Proyek & Tahun Ajaran)" },
];

// PRD Bagian 6: selalu cek feature flag sebelum merender UI modul.
export function isModuleEnabled(
  enabledModules: readonly string[],
  key: ModuleKey,
): boolean {
  return enabledModules.includes(key);
}
