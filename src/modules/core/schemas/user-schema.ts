import { z } from "zod";
import type { Role } from "@/generated/prisma/client";

// Skema pengguna tenant (PRD Bagian 4.D + Bagian 6: semua input divalidasi Zod).

/**
 * Role yang boleh dibuat/diatur dari dalam tenant.
 *
 * OWNER sengaja TIDAK ada di sini — satu tenant hanya punya satu pemilik, dan
 * memindahkannya lewat daftar pengguna berisiko mengunci pemilik keluar.
 * SUPER_ADMIN juga tidak, karena itu akun platform, bukan akun tenant.
 */
export const ASSIGNABLE_ROLES = ["ADMIN", "STAFF", "ACCOUNTANT"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const ROLE_LABELS: Record<AssignableRole, string> = {
  ADMIN: "Admin",
  STAFF: "Staf",
  ACCOUNTANT: "Akuntan",
};

/**
 * Label untuk SEMUA role, termasuk yang tidak bisa dipilih di form
 * (OWNER dan SUPER_ADMIN tetap muncul di daftar, jadi keduanya butuh label).
 */
export const SEMUA_ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  OWNER: "Pemilik",
  ADMIN: "Admin",
  STAFF: "Staf",
  ACCOUNTANT: "Akuntan",
};

export const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(5).max(50).default(10),
  search: z.string().trim().max(100).optional(),
});

const nameField = z
  .string()
  .trim()
  .min(2, "Nama minimal 2 karakter.")
  .max(120, "Nama maksimal 120 karakter.");

const emailField = z
  .string()
  .trim()
  .min(1, "Email wajib diisi.")
  .max(160, "Email maksimal 160 karakter.")
  .email("Email tidak valid.");

// Aturan kata sandi dipakai bersama (pembuatan pengguna & reset sandi), supaya
// batas panjangnya tidak berbeda antar alur.
export const passwordField = z
  .string()
  .min(8, "Kata sandi minimal 8 karakter.")
  .max(72, "Kata sandi maksimal 72 karakter.");

export const createUserSchema = z.object({
  name: nameField,
  email: emailField,
  role: z.enum(ASSIGNABLE_ROLES),
  password: passwordField,
});

export const updateUserSchema = z.object({
  userId: z.string().min(1, "Pengguna tidak valid."),
  name: nameField,
  role: z.enum(ASSIGNABLE_ROLES),
  /** Kosongkan bila kata sandi tidak ingin diganti. */
  password: z.union([z.literal(""), passwordField]).optional(),
});

export const deleteUserSchema = z.object({
  userId: z.string().min(1, "Pengguna tidak valid."),
});

/**
 * Reset kata sandi oleh Super Admin (PRD 4.B: pemulihan akun yang terkunci).
 *
 * Targetnya email, bukan id pengguna, karena itulah yang dimiliki orang saat
 * menghubungi admin. Konfirmasi ketik ulang diminta di sini meskipun bukan
 * aturan keamanan: jalur ini sengaja tidak menanyakan kata sandi lama, jadi
 * tidak ada jaring pengaman lain bila satu karakter tersalah ketik.
 */
export const resetSandiAkunSchema = z
  .object({
    email: emailField,
    password: passwordField,
    konfirmasi: z.string().min(1, "Ulangi kata sandi wajib diisi."),
  })
  .refine((data) => data.password === data.konfirmasi, {
    message: "Ulangi kata sandi tidak sama.",
    path: ["konfirmasi"],
  });

export type ListUsersInput = z.infer<typeof listUsersSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type DeleteUserInput = z.infer<typeof deleteUserSchema>;
export type ResetSandiAkunInput = z.infer<typeof resetSandiAkunSchema>;
