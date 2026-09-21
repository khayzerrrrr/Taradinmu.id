import type { PlanType } from "@/generated/prisma/client";

// Batas paket langganan (PRD Bagian 3: pembedaan FREE vs PRO).
// File murni data (tanpa dependensi server) agar aman dipakai client & server.

/** Jenis batas yang bisa diperiksa lewat checkLimit(). */
export type LimitKey = "INVOICE" | "PRODUCT" | "BATCH" | "ZAKAT";

/** Batas berbasis jumlah (dihitung dari data tenant). */
export type LimitJumlahKey = Extract<LimitKey, "INVOICE" | "PRODUCT">;

/** Batas berbasis fitur (aktif/tidak untuk paket). */
export type LimitFiturKey = Extract<LimitKey, "BATCH" | "ZAKAT">;

export type PlanLimits = {
  /** Jumlah maksimum invoice; null = tanpa batas. */
  invoice: number | null;
  /** Jumlah maksimum produk; null = tanpa batas. */
  product: number | null;
  /** Fitur batch (nomor batch + tanggal kedaluwarsa). */
  batch: boolean;
  /** Perhitungan zakat otomatis dari invoice & pengeluaran. */
  autoZakat: boolean;
};

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  FREE: { invoice: 50, product: 100, batch: false, autoZakat: false },
  PRO: { invoice: null, product: null, batch: true, autoZakat: true },
};

/** Label ramah pengguna untuk dipakai di pesan batas. */
export const LIMIT_LABELS: Record<LimitKey, string> = {
  INVOICE: "invoice",
  PRODUCT: "produk",
  BATCH: "fitur batch (nomor batch & kedaluwarsa)",
  ZAKAT: "zakat otomatis",
};

export function ambilPlanLimits(plan: PlanType): PlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.FREE;
}

/** Batas jumlah untuk INVOICE/PRODUCT; null berarti tanpa batas. */
export function ambilBatasJumlah(
  plan: PlanType,
  key: LimitJumlahKey,
): number | null {
  const limits = ambilPlanLimits(plan);
  return key === "INVOICE" ? limits.invoice : limits.product;
}

/** Status fitur untuk BATCH/ZAKAT. */
export function ambilBatasFitur(
  plan: PlanType,
  key: LimitFiturKey,
): boolean {
  const limits = ambilPlanLimits(plan);
  return key === "BATCH" ? limits.batch : limits.autoZakat;
}
