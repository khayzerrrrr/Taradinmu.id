import type { BusinessType } from "@/generated/prisma/client";
import type { LabelProgram, ProgramStatusValue } from "./types";

// Logika murni modul PROGRAM (PRD 4.F). Sengaja tanpa Prisma, Next, maupun
// sesi supaya bisa diuji langsung (`src/modules/program/utils.test.ts`),
// mengikuti pola tenant-rules.ts terhadap tenant-access.ts.

/**
 * Label per industri, diambil dari `businessType` tenant saat render — BUKAN
 * disimpan di baris program (PRD 4.F.4). Bila jenis usaha tenant berubah,
 * seluruh labelnya ikut berubah dan tidak ada data yang tertinggal.
 */
const LABEL_PER_JENIS: Partial<Record<BusinessType, LabelProgram>> = {
  TRAVEL_UMROH: { program: "Kloter", peserta: "Jamaah" },
  PROJECT_BASED: { program: "Proyek", peserta: "Klien" },
  EDUCATION: { program: "Tahun Ajaran", peserta: "Siswa" },
  JASA_ORDER: { program: "Pesanan", peserta: "Pelanggan" },
  // Retail/F&B jarang memakai program; kalau Super Admin menyalakannya,
  // sebutan yang paling masuk akal adalah "Acara".
  RETAIL_FNB: { program: "Acara", peserta: "Tamu" },
};

const LABEL_DEFAULT: LabelProgram = { program: "Program", peserta: "Peserta" };

export function labelProgram(businessType: BusinessType): LabelProgram {
  return LABEL_PER_JENIS[businessType] ?? LABEL_DEFAULT;
}

export const STATUS_PROGRAM: readonly ProgramStatusValue[] = [
  "PLANNING",
  "ACTIVE",
  "COMPLETED",
  "CANCELLED",
];

export const LABEL_STATUS: Record<ProgramStatusValue, string> = {
  PLANNING: "Direncanakan",
  ACTIVE: "Berjalan",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};

/**
 * Status lanjutan yang sah dari sebuah status (PRD 4.F.5).
 *
 * `CANCELLED` sengaja bisa dicapai dari mana pun — pembatalan adalah keputusan
 * bisnis, bukan tahap. Sebaliknya `COMPLETED -> ACTIVE` ditolak: angka program
 * sudah dihitung ulang oleh pembukuan, membuka kembali tanpa jejak akan membuat
 * laporan bulan lalu berubah sendiri.
 */
export function langkahStatusBerikut(
  status: ProgramStatusValue,
): ProgramStatusValue[] {
  if (status === "PLANNING") return ["ACTIVE", "CANCELLED"];
  if (status === "ACTIVE") return ["COMPLETED", "CANCELLED"];
  return [];
}

export function statusBolehDipakai(
  dari: ProgramStatusValue,
  ke: ProgramStatusValue,
): boolean {
  return dari === ke || langkahStatusBerikut(dari).includes(ke);
}

// Date-only (YYYY-MM-DD) agar zona waktu pengguna tidak menggeser tanggal.
const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Bolak-balik "YYYY-MM-DD" <-> Date untuk kolom tanggal program.
 *
 * Kolomnya TIMESTAMP(3) tanpa zona, jadi nilainya wajib berlabuh di tengah
 * malam UTC — sama seperti `parseTanggalInput` yang dipakai invoice dan
 * pengeluaran. Membangun Date dari `T00:00:00` tanpa "Z" membuat "1 Jan 2027"
 * tersimpan sebagai 31 Des 2026 pada zona UTC+7, dan tanggal yang sudah
 * tersimpan seperti itu tampil mundur satu hari.
 */
export function tanggalIso(waktu: Date): string {
  return waktu.toISOString().slice(0, 10);
}

export function tanggalNull(waktu: Date | null): string | null {
  return waktu ? tanggalIso(waktu) : null;
}

function tanggalValid(nilai: string): boolean {
  if (!POLA_TANGGAL.test(nilai)) return false;
  const date = new Date(`${nilai}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  // "2026-02-31" lolos regex tetapi Date memindahkannya jadi 3 Maret.
  return date.toISOString().slice(0, 10) === nilai;
}

/**
 * Periksa rentang tanggal input baru (PRD 4.F.9: data lama yang sudah
 * menyimpang tidak dipaksa lolos, validasi ini hanya untuk form).
 * Mengembalikan pesan error, atau null bila rentangnya sah.
 */
export function pesanRentangTanggal(
  startDate: string,
  endDate: string | null | undefined,
): string | null {
  if (!tanggalValid(startDate)) return "Tanggal mulai tidak valid.";
  if (endDate === undefined || endDate === null || endDate === "") return null;
  if (!tanggalValid(endDate)) return "Tanggal selesai tidak valid.";
  if (endDate < startDate) {
    return "Tanggal selesai tidak boleh sebelum tanggal mulai.";
  }
  return null;
}

export type AngkaRingkasan = {
  targetAmount: number | null;
  budgetAmount: number | null;
  collected: number;
  spent: number;
};

export type RingkasanProgram = {
  /** Persentase target yang sudah masuk; null bila target tidak diisi. */
  persenTarget: number | null;
  /** Kurang berapa agar target tercapai; 0 bila sudah lewat atau tanpa target. */
  sisaTarget: number;
  /** Sisa anggaran; negatif berarti pengeluaran melewati anggaran. */
  sisaAnggaran: number | null;
  anggaranTerlewat: boolean;
  /** Saldo program: uang masuk dikurangi uang keluar. */
  saldo: number;
};

function pembulatkan(nilai: number): number {
  if (!Number.isFinite(nilai)) return 0;
  return Math.round(nilai * 100) / 100;
}

/**
 * Ringkasan satu program dari angka yang sudah di-roll-up di server.
 * Target dan anggaran boleh kosong — program tanpa target tetap sah (mis.
 * proyek yang dibayar per progres), jadi turunannya ikut null, bukan 0.
 */
export function hitungRingkasan(angka: AngkaRingkasan): RingkasanProgram {
  const collected = pembulatkan(angka.collected);
  const spent = pembulatkan(angka.spent);
  const target = angka.targetAmount;
  const budget = angka.budgetAmount;

  return {
    persenTarget:
      target === null || target <= 0 ? null : pembulatkan((collected / target) * 100),
    sisaTarget: target === null || target <= collected ? 0 : pembulatkan(target - collected),
    sisaAnggaran: budget === null ? null : pembulatkan(budget - spent),
    anggaranTerlewat: budget !== null && spent > budget,
    saldo: pembulatkan(collected - spent),
  };
}

/**
 * Program berjalan yang tanggal selesainya sudah lewat perlu ditinjau: ia
 * masih dihitung aktif sementara uangnya kemungkinan sudah berhenti masuk.
 * Ini hanya penanda di UI — status tidak diubah otomatis, karena penutupan
 * program adalah keputusan pemilik usaha.
 */
export function perluDitinjau(
  status: ProgramStatusValue,
  endDate: string | null,
  now: Date = new Date(),
): boolean {
  if (status !== "ACTIVE" || !endDate) return false;
  const batas = new Date(`${endDate}T23:59:59`);
  if (Number.isNaN(batas.getTime())) return false;
  return now > batas;
}
