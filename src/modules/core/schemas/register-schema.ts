import { z } from "zod";
import type { BusinessType } from "@/generated/prisma/client";
import { BUSINESS_PRESETS } from "@/lib/business-presets";

// Nilai literal diambil dari preset agar tidak ada dua sumber kebenaran.
const businessTypeSchema = z.enum(
  BUSINESS_PRESETS.map((preset) => preset.businessType) as [
    BusinessType,
    ...BusinessType[],
  ],
);

// Validasi input registrasi tenant (dipakai form klien & Server Action).
export const registerSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(2, "Nama usaha minimal 2 karakter.")
    .max(120, "Nama usaha maksimal 120 karakter."),
  businessType: businessTypeSchema,
  ownerName: z
    .string()
    .trim()
    .min(2, "Nama pemilik minimal 2 karakter.")
    .max(120, "Nama pemilik maksimal 120 karakter."),
  ownerEmail: z
    .string()
    .trim()
    .min(1, "Email wajib diisi.")
    .email("Email tidak valid."),
  ownerPassword: z
    .string()
    .min(8, "Kata sandi minimal 8 karakter.")
    .max(72, "Kata sandi maksimal 72 karakter."),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterFormValues = z.input<typeof registerSchema>;
