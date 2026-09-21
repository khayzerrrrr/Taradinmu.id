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

export const createTenantSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama usaha minimal 2 karakter.")
    .max(120, "Nama usaha maksimal 120 karakter."),
  slug: optionalSlugField,
  subdomain: optionalSlugField,
  plan: z.enum(["FREE", "PRO"]).default("FREE"),
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
});

export type ListTenantsInput = z.infer<typeof listTenantsSchema>;
export type CreateTenantInput = z.infer<typeof createTenantSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type CreateTenantFormValues = z.input<typeof createTenantSchema>;
