import type { BusinessType, PlanType } from "@/generated/prisma/client";
import type { ModuleKey } from "@/shared/modules";

// Preset per jenis usaha (PRD Bagian 3): menentukan modul yang diaktifkan,
// dukungan fitur batch, dan kategori default saat tenant baru mendaftar.
// File ini murni data (tanpa React / dependensi server) agar aman dipakai
// client maupun server action. Ikon kartu dipetakan di komponen UI.

export type BusinessPreset = {
  businessType: BusinessType;
  /** Label singkat untuk kartu pilihan. */
  label: string;
  /** Penjelasan satu baris di bawah label. */
  description: string;
  /** Modul yang langsung diaktifkan untuk jenis usaha ini. */
  enabledModules: ModuleKey[];
  /** Fitur batch (nomor batch + tanggal kedaluwarsa) untuk jenis usaha ini. */
  batchTracking: boolean;
  /** Kategori default usaha (dipakai modul saat menambah produk/pengeluaran). */
  categories: string[];
};

const OTHER_PRESET: BusinessPreset = {
  businessType: "OTHER",
  label: "Usaha Lainnya",
  description: "Jenis usaha yang belum tercantum di atas.",
  enabledModules: ["INVENTORY", "BILLING"],
  batchTracking: false,
  categories: ["Umum"],
};

// Urutan array ini juga menentukan urutan kartu di halaman registrasi.
export const BUSINESS_PRESETS: readonly BusinessPreset[] = [
  {
    businessType: "RETAIL",
    label: "Toko / Ritel",
    description: "Minimarket, kelontong, pakaian, dan toko fisik lainnya.",
    enabledModules: ["INVENTORY", "BILLING"],
    batchTracking: true,
    categories: [
      "Sembako",
      "Makanan & Minuman",
      "Perawatan Diri",
      "Perlengkapan Rumah",
      "Lainnya",
    ],
  },
  {
    businessType: "FNB",
    label: "Kuliner (F&B)",
    description: "Restoran, kafe, katering, dan usaha makanan-minuman.",
    enabledModules: ["INVENTORY", "BILLING"],
    batchTracking: true,
    categories: [
      "Makanan Utama",
      "Minuman",
      "Camilan",
      "Dessert",
      "Bahan Baku",
    ],
  },
  {
    businessType: "PHARMACY",
    label: "Farmasi / Klinik",
    description: "Apotek, klinik, dan layanan kesehatan.",
    enabledModules: ["INVENTORY", "BILLING"],
    batchTracking: false,
    categories: [
      "Obat Bebas",
      "Obat Keras",
      "Vitamin & Suplemen",
      "Alat Kesehatan",
      "Bahan Medis Habis Pakai",
    ],
  },
  {
    businessType: "SERVICE",
    label: "Jasa",
    description: "Konsultasi, perbaikan, dan layanan berbasis jasa.",
    enabledModules: ["BILLING"],
    batchTracking: false,
    categories: [
      "Jasa Konsultasi",
      "Jasa Perbaikan",
      "Jasa Instalasi",
      "Langganan",
    ],
  },
  {
    businessType: "MANUFACTURING",
    label: "Manufaktur / Produksi",
    description: "Usaha produksi dengan bahan baku dan barang jadi.",
    enabledModules: ["INVENTORY", "BILLING"],
    batchTracking: false,
    categories: [
      "Bahan Baku",
      "Barang Setengah Jadi",
      "Barang Jadi",
      "Kemasan",
    ],
  },
  OTHER_PRESET,
];

// Preset untuk jenis usaha tertentu; jatuh ke preset "Usaha Lainnya" bila tidak dikenal.
export function getPresetConfig(businessType: BusinessType): BusinessPreset {
  return (
    BUSINESS_PRESETS.find((preset) => preset.businessType === businessType) ??
    OTHER_PRESET
  );
}

// Nomor batch default untuk tenant yang tidak memakai fitur batch: semua stok
// masuk menumpuk di satu batch per varian.
export const DEFAULT_BATCH_NUMBER = "UMUM";

// Kebijakan fitur batch (nomor batch & tanggal kedaluwarsa):
// plan PRO selalu boleh, selain itu mengikuti preset jenis usaha (RETAIL/FNB).
export function isBatchTrackingEnabled(
  plan: PlanType,
  businessType: BusinessType,
): boolean {
  if (plan === "PRO") return true;
  return getPresetConfig(businessType).batchTracking;
}
