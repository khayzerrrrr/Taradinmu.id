import {
  normalisasiKunci,
  normalisasiSumber,
  normalisasiTahap,
  type KunciMinat,
  type SumberMinat,
  type TahapMinat,
} from "@/lib/upgrade-interest";

// Validasi input pencatatan minat upgrade (PRD 4.D.5).
//
// Sengaja bukan Zod: ketiga lapangannya adalah daftar tertutup dan satu-satunya
// aturan yang relevan adalah "termasuk daftar atau tidak". Zod dengan daftar
// tertutup akan mendefinisikan ulang KUNCI_MINAT di sini, dan begitu ada dua
// sumber kebenaran, salah satunya pasti tertinggal saat kunci baru ditambahkan.

export type CatatMinatTervalidasi = {
  kunci: KunciMinat;
  tahap: TahapMinat;
  sumber: SumberMinat;
};

/**
 * Menerima `unknown` (Server Action tidak pernah memercayai bentuk input dari
 * klien). Yang tidak ada dalam daftar ditolak dengan pesan umum — bukan ditebak
 * atau diluruskan, karena catatan minat yang salah lebih menyesatkan daripada
 * catatan yang hilang.
 */
export function validasiCatatMinat(
  input: unknown,
): CatatMinatTervalidasi | null {
  if (typeof input !== "object" || input === null) return null;
  const nilai = input as Record<string, unknown>;

  const kunci = normalisasiKunci(nilai.kunci);
  if (!kunci) return null;

  const tahap = normalisasiTahap(nilai.tahap);
  if (!tahap) return null;

  return { kunci, tahap, sumber: normalisasiSumber(nilai.sumber) };
}
