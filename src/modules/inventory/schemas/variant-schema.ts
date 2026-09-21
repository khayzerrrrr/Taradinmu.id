import { z } from "zod";
import { PRICE_PATTERN } from "../utils";

// Validasi input Product Variant.
const skuSchema = z
  .string()
  .trim()
  .min(2, "SKU minimal 2 karakter.")
  .max(40, "SKU maksimal 40 karakter.")
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "SKU hanya boleh huruf, angka, tanda hubung, dan garis bawah.",
  );

const variantNameSchema = z
  .string()
  .trim()
  .min(2, "Nama varian minimal 2 karakter.")
  .max(120, "Nama varian maksimal 120 karakter.");

const priceSchema = z
  .string()
  .trim()
  .regex(PRICE_PATTERN, "Harga tidak valid (contoh: 12500 atau 12500.50).");

export const createVariantSchema = z.object({
  productId: z.string().min(1, "Produk tidak valid."),
  sku: skuSchema,
  name: variantNameSchema,
  price: priceSchema,
});

export const updateVariantSchema = z.object({
  variantId: z.string().min(1, "Varian tidak valid."),
  sku: skuSchema,
  name: variantNameSchema,
  price: priceSchema,
});

export const deleteVariantSchema = z.object({
  variantId: z.string().min(1, "Varian tidak valid."),
});

export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
export type DeleteVariantInput = z.infer<typeof deleteVariantSchema>;
export type CreateVariantFormValues = z.input<typeof createVariantSchema>;
export type UpdateVariantFormValues = z.input<typeof updateVariantSchema>;
