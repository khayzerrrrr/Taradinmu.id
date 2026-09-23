import type { BusinessType, PlanType } from "@/generated/prisma/client";
import { ambilBatasFitur } from "@/lib/plan-limits";
import type { ItemKindValue } from "@/shared/item-kind";
import type { ModuleKey } from "@/shared/modules";

// Preset per jenis usaha (PRD Bagian 4.C): menentukan modul yang diaktifkan,
// jenis item yang paling sering dibuat, dan kategori default saat tenant baru
// mendaftar.
// File ini murni data (tanpa React / dependensi server) agar aman dipakai
// client maupun server action. Ikon kartu dipetakan di komponen UI.

/**
 * Modul dasar untuk SEMUA jenis usaha.
 *
 * PENTING — INVENTORY bukan sekadar "stok". Katalog item (barang maupun jasa)
 * berada di modul ini, dan tanpa itu tenant tidak dapat membuat satu pun item
 * yang bisa ditagih. Preset travel umrah, jasa pesanan, dan pendidikan dahulu
 * hanya memberi BILLING, sehingga form invoice menyuruh membuka modul yang tidak
 * mereka miliki — tenant-nya buntu total.
 *
 * ACCOUNTING memuat pengeluaran & zakat; tanpa itu kartu Arus Kas Bulan Ini dan
 * estimasi zakat selalu bernilai 0 untuk tenant baru.
 */
const MODUL_DASAR: ModuleKey[] = ["INVENTORY", "BILLING", "ACCOUNTING"];

export type BusinessPreset = {
  businessType: BusinessType;
  /** Label singkat untuk kartu pilihan. */
  label: string;
  /** Penjelasan satu baris di bawah label. */
  description: string;
  /** Modul yang langsung diaktifkan untuk jenis usaha ini. */
  enabledModules: ModuleKey[];
  /**
   * Jenis item yang paling sering dibuat usaha ini, dipakai sebagai nilai awal
   * form katalog. Hanya nilai awal — pengguna tetap bisa memilih jenis lain.
   */
  defaultItemKind: ItemKindValue;
  /**
   * Industri ini lazim memakai nomor batch & tanggal kedaluwarsa.
   *
   * PENTING — ini BUKAN penentu akses. Penegakan fitur batch mengikuti PAKET
   * (PRD Bagian 4.D: paket FREE tanpa batch/kedaluwarsa) dan dihitung satu kali
   * di `isBatchTrackingEnabled()`. Sebelumnya flag ini dipakai sebagai penentu
   * akses, sehingga bertabrakan dengan src/lib/plan-limits.ts.
   */
  batchTracking: boolean;
  /** Kategori default usaha (dipakai modul saat menambah produk/pengeluaran). */
  categories: string[];
};

const OTHER_PRESET: BusinessPreset = {
  businessType: "OTHER",
  label: "Usaha Lainnya",
  description: "Jenis usaha yang belum tercantum di atas.",
  enabledModules: [...MODUL_DASAR],
  defaultItemKind: "GOODS",
  batchTracking: false,
  categories: ["Umum"],
};

// Urutan array ini juga menentukan urutan kartu di halaman registrasi,
// mengikuti urutan pada PRD Bagian 4.C.
export const BUSINESS_PRESETS: readonly BusinessPreset[] = [
  {
    businessType: "RETAIL_FNB",
    label: "Toko & Kuliner",
    description: "Minimarket, kelontong, catering, restoran, dan kafe.",
    enabledModules: [...MODUL_DASAR],
    defaultItemKind: "GOODS",
    batchTracking: true,
    categories: [
      "Sembako",
      "Makanan & Minuman",
      "Camilan",
      "Perawatan Diri",
      "Perlengkapan Rumah",
      "Lainnya",
    ],
  },
  {
    businessType: "TRAVEL_UMROH",
    label: "Travel Umrah & Haji",
    description: "Travel umrah, haji, dan penjualan tiket.",
    enabledModules: [...MODUL_DASAR],
    defaultItemKind: "SERVICE",
    batchTracking: false,
    categories: [
      "Paket Umrah",
      "Paket Haji",
      "Tiket & Visa",
      "Layanan Tambahan",
    ],
  },
  {
    businessType: "JASA_ORDER",
    label: "Jasa Pesanan",
    description: "Laundry, aqiqah, konveksi, dan jasa berdasarkan pesanan.",
    enabledModules: [...MODUL_DASAR],
    defaultItemKind: "SERVICE",
    batchTracking: false,
    categories: [
      "Laundry",
      "Aqiqah & Katering",
      "Konveksi & Jahit",
      "Perawatan",
      "Lainnya",
    ],
  },
  {
    businessType: "PROJECT_BASED",
    label: "Proyek & Event",
    description: "Kontraktor, event organizer, dan pekerjaan berbasis proyek.",
    enabledModules: [...MODUL_DASAR],
    defaultItemKind: "SERVICE",
    batchTracking: false,
    categories: [
      "Material Bangunan",
      "Alat & Sewa",
      "Tenaga Kerja",
      "Jasa Profesional",
      "Lainnya",
    ],
  },
  {
    businessType: "TRADING",
    label: "Perdagangan & Distribusi",
    description: "Distributor, ekspor-impor, dan perdagangan grosir.",
    enabledModules: [...MODUL_DASAR],
    defaultItemKind: "GOODS",
    batchTracking: false,
    categories: [
      "Barang Dagangan",
      "Bahan Baku",
      "Kemasan",
      "Lainnya",
    ],
  },
  {
    businessType: "EDUCATION",
    label: "Pendidikan",
    description: "Sekolah, bimbingan belajar, dan pesantren.",
    enabledModules: [...MODUL_DASAR],
    defaultItemKind: "SERVICE",
    batchTracking: false,
    categories: [
      "SPP & Uang Sekolah",
      "Pendaftaran",
      "Buku & Seragam",
      "Kegiatan",
      "Lainnya",
    ],
  },
  {
    businessType: "HEALTH_CLINIC",
    label: "Klinik & Apotek",
    description: "Klinik, apotek, dan layanan kesehatan.",
    enabledModules: [...MODUL_DASAR],
    // Klinik menjual obat (barang) sekaligus layanan konsultasi (jasa).
    defaultItemKind: "GOODS",
    // PRD Bagian 3: tanggal kedaluwarsa wajib untuk F&B dan Farmasi.
    batchTracking: true,
    categories: [
      "Obat Bebas",
      "Obat Keras",
      "Vitamin & Suplemen",
      "Alat Kesehatan",
      "Bahan Medis Habis Pakai",
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

/**
 * Apakah fitur batch (nomor batch & tanggal kedaluwarsa) aktif?
 *
 * Satu-satunya sumber kebenaran adalah paket langganan (PRD Bagian 4.D: paket
 * FREE tanpa batch/kedaluwarsa, PRO dapat). Fungsi ini sengaja mendelegasikan ke
 * plan-limits.ts supaya aturan yang sama tidak ditulis dua kali — dulu ada dua
 * aturan berbeda dan keduanya bertabrakan.
 */
export function isBatchTrackingEnabled(plan: PlanType): boolean {
  return ambilBatasFitur(plan, "BATCH");
}
