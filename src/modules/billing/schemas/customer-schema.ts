import { z } from "zod";

// Validasi input Customer (PRD Bagian 6: semua input wajib lewat Zod).
export const listCustomersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(5).max(50).default(10),
  search: z.string().trim().max(100).optional(),
});

const nama = z
  .string()
  .trim()
  .min(2, "Nama pelanggan minimal 2 karakter.")
  .max(120, "Nama pelanggan maksimal 120 karakter.");

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

export const createCustomerSchema = z.object({
  name: nama,
  phone: telepon,
  email,
  address: alamat,
});

export const updateCustomerSchema = z.object({
  customerId: z.string().min(1, "Pelanggan tidak valid."),
  name: nama,
  phone: telepon,
  email,
  address: alamat,
});

export const deleteCustomerSchema = z.object({
  customerId: z.string().min(1, "Pelanggan tidak valid."),
});

export type ListCustomersInput = z.infer<typeof listCustomersSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type DeleteCustomerInput = z.infer<typeof deleteCustomerSchema>;
export type CreateCustomerFormValues = z.input<typeof createCustomerSchema>;
export type UpdateCustomerFormValues = z.input<typeof updateCustomerSchema>;
