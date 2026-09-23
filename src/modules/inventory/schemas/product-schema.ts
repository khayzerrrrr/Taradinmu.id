import { z } from "zod";
import { ITEM_KINDS } from "@/shared/item-kind";

// Validasi input Product (PRD Bagian 6: semua input wajib lewat Zod).
export const listProductsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(5).max(50).default(10),
  search: z.string().trim().max(100).optional(),
});

const nameField = z
  .string()
  .trim()
  .min(2, "Nama produk minimal 2 karakter.")
  .max(120, "Nama produk maksimal 120 karakter.");

const descriptionField = z
  .string()
  .trim()
  .max(500, "Deskripsi maksimal 500 karakter.")
  .optional();

export const createProductSchema = z.object({
  name: nameField,
  description: descriptionField,
  kind: z.enum(ITEM_KINDS),
});

export const updateProductSchema = z.object({
  productId: z.string().min(1, "Produk tidak valid."),
  name: nameField,
  description: descriptionField,
  kind: z.enum(ITEM_KINDS),
});

export const deleteProductSchema = z.object({
  productId: z.string().min(1, "Produk tidak valid."),
});

export type ListProductsInput = z.infer<typeof listProductsSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type DeleteProductInput = z.infer<typeof deleteProductSchema>;
export type CreateProductFormValues = z.input<typeof createProductSchema>;
export type UpdateProductFormValues = z.input<typeof updateProductSchema>;
