import type { z } from "zod";

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

export function pesanErrorUmum(error: unknown): string {
  return error instanceof Error ? error.message : "Terjadi kesalahan tak terduga.";
}
