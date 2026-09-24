import { createHash } from "node:crypto";

// Kontrak token "lupa kata sandi", dipakai bersama oleh pihak yang MENGINSTALL
// token (mintaResetSandi/simpanSandiBaru) dan pihak yang MEMBATALKAN token
// (resetKataSandiAkun milik Super Admin). Keduanya harus memakai prefix dan hash
// yang sama: kalau berbeda, tautan reset lama tidak ikut terhapus dan masih bisa
// dipakai menimpa kata sandi — kegagalan yang tidak terlihat oleh siapa pun.

/**
 * Prefix identifier di tabel VerificationToken.
 *
 * Nilainya terlanjur tersimpan di baris database, jadi mengganti string ini sama
 * dengan menelantarkan tautan reset yang sedang aktif. Dikunci oleh tes.
 */
export const PREFIX_TOKEN_RESET = "reset-sandi:";

export function identifierReset(userId: string): string {
  return `${PREFIX_TOKEN_RESET}${userId}`;
}

/**
 * Hash SHA-256 atas token mentah. Yang tersimpan di database hanyalah hash ini,
 * sehingga isi database yang bocor tidak langsung memberi tautan reset yang hidup.
 */
export function hashTokenReset(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
