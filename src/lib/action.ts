import type { z } from "zod";
import { catatError, type KonteksLog } from "@/lib/log";

// Helper Server Action bersama (dipakai modul mana pun lewat src/lib).

// Kumpulkan pesan validasi Zod menjadi satu kalimat.
export function pesanValidasi(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join(" ");
}

// Deteksi error Prisma lewat kode, tanpa bergantung pada kelas error-nya.
function punyaKode(error: unknown, kode: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === kode
  );
}

export function isUniqueConstraintError(error: unknown): boolean {
  return punyaKode(error, "P2002");
}

export function isForeignKeyError(error: unknown): boolean {
  return punyaKode(error, "P2003");
}

export function isRecordNotFoundError(error: unknown): boolean {
  return punyaKode(error, "P2025");
}

// Satu-satunya tempat setiap catch block Server Action berakhir. Selain menyusun
// pesan aman untuk UI, fungsi ini ikut mencatat error mentah ke log server —
// tanpa itu, kegagalan produksi hanya menyisakan `message` manusiawi dan sebab
// aslinya hilang sama sekali (ROADMAP §4 P4).
//
// `konteks` opsional: call site lama tetap berlaku, dan tempat yang paling perlu
// ditelusuri bisa menambahkannya tanpa mengubah yang lain.
export function pesanErrorUmum(error: unknown, konteks?: KonteksLog): string {
  catatError(error, konteks);
  return error instanceof Error ? error.message : "Terjadi kesalahan tak terduga.";
}
