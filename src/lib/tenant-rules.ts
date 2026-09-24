import type { Role } from "@/generated/prisma/client";

// Aturan otorisasi tenant — MURNI (tanpa I/O, tanpa Next.js) supaya bisa diuji
// langsung. Pasangan file ini adalah `tenant-access.ts` (yang menyentuh sesi dan
// redirect), mengikuti pola `plan-limits.ts` → `feature-guards.ts`.
//
// Sengaja dipisah: halaman (`requireTenantX`) dan Server Action (`assertTenantX`)
// dulu menuliskan aturan yang sama dua kali. Sekarang keduanya memanggil
// `nilaiAksesTenant()`, sehingga tidak mungkin lagi menyimpang satu sama lain.

// Role tenant yang boleh mengelola data (SUPER_ADMIN selalu boleh).
export const TENANT_MANAGER_ROLES: readonly Role[] = ["OWNER", "ADMIN", "STAFF"];
// Role yang boleh mengubah identitas/branding tenant.
export const TENANT_OWNER_ROLES: readonly Role[] = ["OWNER"];
// Role yang boleh mengelola pengguna tenant (PRD Bagian 4.D: PRO dapat menambah
// Admin, Staff, dan Akuntan; yang boleh mengundang adalah OWNER dan ADMIN).
export const TENANT_USER_MANAGER_ROLES: readonly Role[] = ["OWNER", "ADMIN"];

export const PESAN_TANPA_SESI =
  "Sesi tidak ditemukan. Silakan masuk terlebih dahulu.";
export const PESAN_BUKAN_ANGGOTA =
  "Akses ditolak. Anda bukan anggota tenant ini.";
export const PESAN_PERAN_UMUM = "Akses ditolak. Role Anda tidak diizinkan.";
export const PESAN_PERAN_OWNER =
  "Akses ditolak. Hanya pemilik (OWNER) yang boleh mengubah pengaturan toko.";
export const PESAN_PERAN_PENGGUNA =
  "Akses ditolak. Hanya pemilik atau admin yang boleh mengelola pengguna.";

// Bagian sesi yang dibutuhkan keputusan izin. Sengaja bukan tipe `Session`
// lengkap agar aturan ini tidak bergantung pada bentuk NextAuth.
export type SesiPengguna = {
  id: string;
  role: Role;
  tenantId: string | null;
};

export type HasilIzinTenant =
  | { ok: true; userId: string }
  | { ok: false; message: string };

// Keputusan izin tenant. Urutan pemeriksaan penting dan disengaja:
// 1. Tanpa sesi        -> tolak (pesan "masuk dulu").
// 2. SUPER_ADMIN       -> selalu boleh, untuk tenant mana pun. Ini yang membuat
//                         mode impersonasi (role tetap SUPER_ADMIN) bekerja.
// 3. Bukan anggota     -> tolak. Inilah penjaga lintas-tenant: role setinggi
//                         apa pun tidak menembus batas tenant.
// 4. Role tidak cocok  -> tolak.
export function nilaiAksesTenant(
  user: SesiPengguna | null,
  tenantId: string,
  peranDiizinkan: readonly Role[],
  pesanPeranDitolak: string,
): HasilIzinTenant {
  if (!user) return { ok: false, message: PESAN_TANPA_SESI };
  if (user.role === "SUPER_ADMIN") return { ok: true, userId: user.id };
  if (user.tenantId !== tenantId) {
    return { ok: false, message: PESAN_BUKAN_ANGGOTA };
  }
  if (!peranDiizinkan.includes(user.role)) {
    return { ok: false, message: pesanPeranDitolak };
  }
  return { ok: true, userId: user.id };
}

// Tujuan standar setelah masuk, supaya login tidak mendarat di "/" yang merupakan
// halaman pemasaran. Polanya sama dengan alur daftar (PRD Bagian 4.A) yang sudah
// mengirim pemilik usaha baru ke `/${slug}/dashboard`.
//
// Fallback "/" disengaja untuk akun tanpa tenant: lebih baik mendarat di halaman
// publik daripada di `/admin` yang pasti menolak.
export function rumahSetelahMasuk(
  role: Role,
  tenantSlug: string | null,
): string {
  if (role === "SUPER_ADMIN") return "/admin";
  if (tenantSlug) return `/${tenantSlug}/dashboard`;
  return "/";
}
