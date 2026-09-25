import type { PlanType } from "@/generated/prisma/client";

// Batas paket langganan (PRD Bagian 3: pembedaan FREE vs PRO).
// File murni data (tanpa dependensi server) agar aman dipakai client & server.

/** Jenis batas yang bisa diperiksa lewat checkLimit(). */
export type LimitKey =
  | "INVOICE"
  | "PRODUCT"
  | "USERS"
  | "BATCH"
  | "ZAKAT"
  | "PROGRAM"
  | "HPP";

/** Batas berbasis jumlah (dihitung dari data tenant). */
export type LimitJumlahKey = Extract<LimitKey, "INVOICE" | "PRODUCT" | "USERS">;

/** Batas berbasis fitur (aktif/tidak untuk paket). */
export type LimitFiturKey = Extract<
  LimitKey,
  "BATCH" | "ZAKAT" | "PROGRAM" | "HPP"
>;

export type PlanLimits = {
  /**
   * Jumlah maksimum invoice **per bulan** (PRD Bagian 4.D); null = tanpa batas.
   * Hitungannya dibatasi bulan berjalan di `feature-guards.ts`, bukan total.
   */
  invoice: number | null;
  /** Jumlah maksimum produk; null = tanpa batas. */
  product: number | null;
  /** Jumlah maksimum pengguna tenant; null = tanpa batas (PRD 4.D). */
  users: number | null;
  /** Fitur batch (nomor batch + tanggal kedaluwarsa). */
  batch: boolean;
  /** Perhitungan zakat otomatis dari invoice & pengeluaran. */
  autoZakat: boolean;
  /** Modul Program — pusat biaya & tagih per industri (PRD 4.F). */
  program: boolean;
  /**
   * Laporan HPP & margin (PRD 4.G.5). Yang dibatasi hanya LAPORANNYA: pemisahan
   * arus kas vs laba dan pengurangan HPP di angka laba berlaku untuk semua
   * paket, karena itu koreksi angka yang salah — bukan fitur baru.
   */
  hpp: boolean;
};

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  // FREE: 1 pengguna (hanya Owner), 50 invoice per bulan — PRD Bagian 4.D.
  FREE: {
    invoice: 50,
    product: 100,
    users: 1,
    batch: false,
    autoZakat: false,
    program: false,
    hpp: false,
  },
  PRO: {
    invoice: null,
    product: null,
    users: null,
    batch: true,
    autoZakat: true,
    program: true,
    hpp: true,
  },
};

/** Label ramah pengguna untuk dipakai di pesan batas. */
export const LIMIT_LABELS: Record<LimitKey, string> = {
  INVOICE: "invoice",
  PRODUCT: "produk",
  USERS: "pengguna",
  BATCH: "fitur batch (nomor batch & kedaluwarsa)",
  ZAKAT: "zakat otomatis",
  PROGRAM: "modul Program",
  HPP: "laporan HPP & margin",
};

/**
 * Harga PRO per bulan (PRD 4.D). Sumber tunggal: setiap ajakan upgrade membaca
 * konstanta ini, supaya tidak pernah ada dua modal yang menyebut harga berbeda.
 * Pembulatannya memakai `formatRupiah` di berkas UI, bukan di sini — berkas ini
 * sengaja murni data tanpa dependensi.
 * Aktivasinya masih manual lewat WhatsApp admin: belum ada payment gateway.
 */
export const HARGA_PRO_BULAN = 149_000;

/**
 * Keterangan periode untuk batas berbasis jumlah. Invoice dihitung per bulan
 * (PRD 4.D), sedangkan produk & pengguna dihitung total — jadi keduanya sengaja
 * dibedakan supaya pesan batas tidak menyesatkan.
 */
export const LIMIT_PERIODE: Partial<Record<LimitJumlahKey, string>> = {
  INVOICE: "per bulan",
};

/** Label batas jumlah sekaligus periodenya, mis. "invoice per bulan". */
export function labelBatasJumlah(key: LimitJumlahKey): string {
  const periode = LIMIT_PERIODE[key];
  return periode ? `${LIMIT_LABELS[key]} ${periode}` : LIMIT_LABELS[key];
}

export function ambilPlanLimits(plan: PlanType): PlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.FREE;
}

/** Batas jumlah untuk INVOICE/PRODUCT/USERS; null berarti tanpa batas. */
export function ambilBatasJumlah(
  plan: PlanType,
  key: LimitJumlahKey,
): number | null {
  const limits = ambilPlanLimits(plan);
  if (key === "INVOICE") return limits.invoice;
  if (key === "PRODUCT") return limits.product;
  return limits.users;
}

/** Status fitur untuk BATCH/ZAKAT/PROGRAM/HPP. */
export function ambilBatasFitur(
  plan: PlanType,
  key: LimitFiturKey,
): boolean {
  const limits = ambilPlanLimits(plan);
  if (key === "BATCH") return limits.batch;
  if (key === "ZAKAT") return limits.autoZakat;
  if (key === "HPP") return limits.hpp;
  return limits.program;
}

/**
 * Kuota yang perlu diperhatikan di dashboard (PRD 4.D.3). Batas yang datang
 * tiba-tiba terasa seperti jebakan, jadi kemajuan kuota mulai ditampilkan sebelum
 * tersenggol. Ambangnya sengaja tinggi: dashboard warung jangan sampai berubah
 * menjadi spanduk penjualan.
 */
export const AMBANG_KUOTA_DASHBOARD = 0.8;

export type KuotaMendesak = {
  key: LimitJumlahKey;
  label: string;
  terpakai: number;
  batas: number;
};

/**
 * `null` bila batasnya tidak berlaku (PRO), datanya belum mencapai ambang, atau
 * modulnya tidak aktif (pemanggil mengirim terpakai = 0 untuk kasus itu).
 */
export function kuotaMendesak(
  key: LimitJumlahKey,
  plan: PlanType,
  terpakai: number,
): KuotaMendesak | null {
  const batas = ambilBatasJumlah(plan, key);
  if (batas === null || batas <= 0) return null;
  if (terpakai / batas < AMBANG_KUOTA_DASHBOARD) return null;
  return { key, label: labelBatasJumlah(key), terpakai, batas };
}
