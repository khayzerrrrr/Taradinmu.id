import { z } from "zod";

// Validasi input Supplier / pemasok (PRD 4.G.4).

export const listSuppliersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(5).max(50).default(10),
  search: z.string().trim().max(100).optional(),
});

const nama = z
  .string()
  .trim()
  .min(2, "Nama pemasok minimal 2 karakter.")
  .max(120, "Nama pemasok maksimal 120 karakter.");

const telepon = z
  .string()
  .trim()
  .max(30, "Telepon maksimal 30 karakter.")
  .optional();

const email = z
  .union([z.literal(""), z.string().trim().email("Email tidak valid.")])
  .optional();

const alamat = z
  .string()
  .trim()
  .max(300, "Alamat maksimal 300 karakter.")
  .optional();

const catatan = z
  .string()
  .trim()
  .max(500, "Catatan maksimal 500 karakter.")
  .optional();

export const createSupplierSchema = z.object({
  name: nama,
  phone: telepon,
  email,
  address: alamat,
  notes: catatan,
});

export const updateSupplierSchema = z.object({
  supplierId: z.string().min(1, "Pemasok tidak valid."),
  name: nama,
  phone: telepon,
  email,
  address: alamat,
  notes: catatan,
});

export const deleteSupplierSchema = z.object({
  supplierId: z.string().min(1, "Pemasok tidak valid."),
});

export type ListSuppliersInput = z.infer<typeof listSuppliersSchema>;
export type CreateSupplierFormValues = z.input<typeof createSupplierSchema>;
export type UpdateSupplierFormValues = z.input<typeof updateSupplierSchema>;
