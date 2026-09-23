import { z } from "zod";

// Validasi input batch & pergerakan stok.

// Jumlah stok: menerima angka maupun string (form) lalu dinormalkan.
const quantitySchema = z
  .union([z.number(), z.string()])
  .transform((value) => {
    if (typeof value === "number") return value;
    const trimmed = value.trim();
    return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
  })
  .pipe(
    z
      .number()
      .int("Jumlah harus angka bulat.")
      .min(1, "Jumlah minimal 1.")
      .max(1_000_000, "Jumlah maksimal 1.000.000."),
  );

const optionalText = (maks: number, label: string) =>
  z
    .string()
    .trim()
    .max(maks, `${label} maksimal ${maks} karakter.`)
    .optional();

export const listStockSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(5).max(50).default(10),
  search: z.string().trim().max(100).optional(),
});

export const listMovementsSchema = z.object({
  variantId: z.string().min(1).optional(),
  type: z.enum(["IN", "OUT", "ADJUSTMENT"]).optional(),
  perPage: z.coerce.number().int().min(1).max(50).default(10),
});

export const stockInSchema = z.object({
  variantId: z.string().min(1, "Varian wajib dipilih."),
  // Opsional: wajib hanya bila fitur batch aktif (paket PRO).
  // Kewajibannya diputuskan & divalidasi di Server Action.
  batchNumber: z
    .union([
      z.literal(""),
      z
        .string()
        .trim()
        .min(2, "Nomor batch minimal 2 karakter.")
        .max(40, "Nomor batch maksimal 40 karakter.")
        .regex(
          /^[A-Za-z0-9\-_/]+$/,
          "Nomor batch hanya boleh huruf, angka, tanda hubung, garis miring, dan garis bawah.",
        ),
    ])
    .optional(),
  quantity: quantitySchema,
  expiredDate: z
    .union([
      z.literal(""),
      z
        .string()
        .trim()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal kedaluwarsa harus YYYY-MM-DD."),
    ])
    .optional(),
  reference: optionalText(60, "Referensi"),
  notes: optionalText(300, "Catatan"),
});

export const stockOutSchema = z.object({
  variantId: z.string().min(1, "Varian wajib dipilih."),
  quantity: quantitySchema,
  reference: optionalText(60, "Referensi"),
  notes: optionalText(300, "Catatan"),
});

export type ListStockInput = z.infer<typeof listStockSchema>;
export type ListMovementsInput = z.infer<typeof listMovementsSchema>;
export type StockInInput = z.infer<typeof stockInSchema>;
export type StockOutInput = z.infer<typeof stockOutSchema>;
export type StockInFormValues = z.input<typeof stockInSchema>;
export type StockOutFormValues = z.input<typeof stockOutSchema>;
