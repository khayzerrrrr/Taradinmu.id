import { z } from "zod";
import { HEX_COLOR_PATTERN } from "@/lib/branding";

// Validasi input Pengaturan Toko (white-label).
export const updateBrandingSchema = z.object({
  primaryColor: z
    .string()
    .trim()
    .regex(HEX_COLOR_PATTERN, "Warna harus format hex, contoh #059669."),
});

export type UpdateBrandingInput = z.infer<typeof updateBrandingSchema>;
