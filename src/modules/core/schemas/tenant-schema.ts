import { z } from "zod";
import { isReservedSlug } from "@/shared/constants";
import { MODULE_KEYS } from "../types";

// Semua input divalidasi Zod sebelum menyentuh Prisma (PRD Bagian 6).
export const moduleKeySchema = z.enum(MODULE_KEYS);

export const listTenantsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(5).max(50).default(10),
  search: z.string().trim().max(100).optional(),
});

// Slug/subdomain tidak boleh menabrak route sistem (mis. /admin, /login).
const optionalSlugField = z
  .union([
    z.literal(""),
    z
      .string()
      .trim()
      .max(60, "Maksimal 60 karakter.")
      .regex(/^[a-z0-9-]+$/, "Hanya boleh huruf kecil, angka, dan tanda hubung."),
  ])
  .optional()
  .refine(
    (value) => value === undefined || value === "" || !isReservedSlug(value),
    "Nilai ini dipakai sistem, silakan pilih yang lain.",
  );

/**
 * Kolom masa berlaku pada dialog tenant (PRD 4.D.4). Hanya format tanggal HTML
 * (`YYYY-MM-DD`) yang diterima; string kosong berarti "tanpa tanggal berakhir",
 * bukan "hari ini" — bedanya besar bagi tenant yang sedang dipertimbangkan
 * penolakannya.
 */
const tanggalBerakhir = z
  .union([
    z.literal(""),
    z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}$/,
        "Format tanggal harus YYYY-MM-DD, mis. 2026-10-31.",
      ),
  ])
  .optional();

export const createTenantSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama usaha minimal 2 karakter.")
    .max(120, "Nama usaha maksimal 120 karakter."),
  slug: optionalSlugField,
  subdomain: optionalSlugField,
  plan: z.enum(["FREE", "PRO"]).default("FREE"),
  /** Masa berlaku PRO saat provisioning (PRD 4.D.4); dilenyapkan bila FREE. */
  expiresAt: tanggalBerakhir,
  enabledModules: z.array(moduleKeySchema).default([]),
  ownerName: z
    .string()
    .trim()
    .min(2, "Nama pemilik minimal 2 karakter.")
    .max(120, "Nama pemilik maksimal 120 karakter."),
  ownerEmail: z
    .string()
    .trim()
    .min(1, "Email pemilik wajib diisi.")
    .email("Email pemilik tidak valid."),
  ownerPassword: z
    .string()
    .min(8, "Kata sandi pemilik minimal 8 karakter.")
    .max(72, "Kata sandi pemilik maksimal 72 karakter."),
});

export const updateTenantSchema = z.object({
  tenantId: z.string().min(1, "Tenant tidak valid."),
  plan: z.enum(["FREE", "PRO"]),
  enabledModules: z.array(moduleKeySchema),
  expiresAt: tanggalBerakhir,
  /** Catatan Super Admin (mis. nomor transaksi). Bukan data tenant. */
  catatan: z
    .string()
    .trim()
    .max(200, "Catatan maksimal 200 karakter.")
    .optional(),
});

export type ListTenantsInput = z.infer<typeof listTenantsSchema>;
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type CreateTenantFormValues = z.input<typeof createTenantSchema>;

/**
 * Isian "berakhir pada" dari dialog → nilai tersimpan.
 *
 * Kosong dan tidak terisi menghasilkan `null` = tanpa tanggal berakhir. Sengaja
 * tidak melempar error: pemanggil sudah memvalidasi formatnya lewat
 * `updateTenantSchema`, dan kasus di sini hanya "admin tidak mengisi kolomnya".
 *
 * Waktunya diambil pada tengah malam UTC supaya tanggal yang sama muncul di
 * seluruh zona — untuk WIB (+7) ini tetap hari yang sama, hanya bergeser pagi.
 */
export function tanggalMasaBerlaku(
  isian: string | undefined,
): Date | null {
  if (!isian) return null;
  const tanggal = new Date(`${isian}T00:00:00.000Z`);
  if (Number.isNaN(tanggal.getTime())) return null;
  // "2026-02-31" tidak ditolak parser JavaScript — ia diloloskan menjadi 3 Maret.
  // Untuk batas masa berlaku, menggeser tanggal diam-diam seburuk menerimanya,
  // jadi hanya isian yang terbaca kembali sama persis yang dipakai.
  return tanggalIsoLokal(tanggal) === isian ? tanggal : null;
}

/**
 * Kebalikan dari `tanggalMasaBerlaku`: nilai tersimpan → isian `input type=date`.
 *
 * Memakai komponen UTC, bukan `toISOString().slice(0,10)` yang biasa — kolom
 * tanggal disimpan pada tengah malam UTC, jadi membaca jam lokal bisa menggeser
 * tampilannya satu hari ke belakang di zona WIB.
 */
export function tanggalIsoLokal(
  value: string | Date | null | undefined,
): string {
  if (!value) return "";
  const tanggal = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(tanggal.getTime())) return "";
  const dua = (n: number) => String(n).padStart(2, "0");
  return `${tanggal.getUTCFullYear()}-${dua(tanggal.getUTCMonth() + 1)}-${dua(tanggal.getUTCDate())}`;
}
