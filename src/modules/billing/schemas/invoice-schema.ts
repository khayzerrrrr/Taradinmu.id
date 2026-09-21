import { z } from "zod";

// Validasi input Invoice.

// Jumlah: menerima angka maupun string (form) lalu dinormalkan.
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

const taxPercentSchema = z
  .union([z.number(), z.string()])
  .transform((value) => {
    if (typeof value === "number") return value;
    const trimmed = value.trim();
    if (trimmed === "") return 0;
    return /^\d+(\.\d{1,2})?$/.test(trimmed) ? Number(trimmed) : Number.NaN;
  })
  .pipe(
    z
      .number()
      .min(0, "PPN minimal 0%.")
      .max(100, "PPN maksimal 100%."),
  );

export const listInvoicesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(5).max(50).default(10),
  search: z.string().trim().max(100).optional(),
  status: z.enum(["DRAFT", "SENT", "PAID", "OVERDUE"]).optional(),
});

export const invoiceItemSchema = z.object({
  variantId: z.string().min(1, "Varian wajib dipilih."),
  quantity: quantitySchema,
});

export const createInvoiceSchema = z.object({
  customerId: z.string().min(1, "Pelanggan wajib dipilih."),
  dueDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal jatuh tempo harus format YYYY-MM-DD."),
  taxPercent: taxPercentSchema.optional().default(0),
  items: z.array(invoiceItemSchema).min(1, "Minimal satu item invoice."),
  notes: z.string().trim().max(300, "Catatan maksimal 300 karakter.").optional(),
});

export const updateInvoiceStatusSchema = z.object({
  invoiceId: z.string().min(1, "Invoice tidak valid."),
  status: z.enum(["DRAFT", "SENT", "PAID"]),
});

export const deleteInvoiceSchema = z.object({
  invoiceId: z.string().min(1, "Invoice tidak valid."),
});

export type ListInvoicesInput = z.infer<typeof listInvoicesSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceStatusInput = z.infer<typeof updateInvoiceStatusSchema>;
export type DeleteInvoiceInput = z.infer<typeof deleteInvoiceSchema>;
export type CreateInvoiceFormValues = z.input<typeof createInvoiceSchema>;
export type InvoiceItemFormValues = z.input<typeof invoiceItemSchema>;
