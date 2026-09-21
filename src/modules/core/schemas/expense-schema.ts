import { z } from "zod";
import { EXPENSE_CATEGORY_VALUES } from "../expense-categories";

// Validasi input pencatatan pengeluaran.

// Nominal rupiah: menerima angka maupun string (form), maksimal 2 desimal.
const amountSchema = z
  .union([z.number(), z.string()])
  .transform((value) => {
    if (typeof value === "number") return value;
    const trimmed = value.trim();
    return /^\d{1,12}(\.\d{1,2})?$/.test(trimmed) ? Number(trimmed) : Number.NaN;
  })
  .pipe(
    z
      .number()
      .positive("Nominal harus lebih dari 0.")
      .max(999_999_999_999.99, "Nominal terlalu besar."),
  );

const tanggalSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal harus format YYYY-MM-DD.");

const optionalText = (maks: number, label: string) =>
  z
    .string()
    .trim()
    .max(maks, `${label} maksimal ${maks} karakter.`)
    .optional();

export const listExpensesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(5).max(50).default(10),
  search: z.string().trim().max(100).optional(),
  category: z.enum(EXPENSE_CATEGORY_VALUES).optional(),
});

export const createExpenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORY_VALUES),
  description: z
    .string()
    .trim()
    .min(2, "Keterangan minimal 2 karakter.")
    .max(200, "Keterangan maksimal 200 karakter."),
  amount: amountSchema,
  expenseDate: tanggalSchema,
  paymentMethod: optionalText(40, "Metode pembayaran"),
  reference: optionalText(60, "Referensi"),
  notes: optionalText(300, "Catatan"),
});

export const updateExpenseSchema = createExpenseSchema.extend({
  expenseId: z.string().min(1, "Pengeluaran tidak valid."),
});

export const deleteExpenseSchema = z.object({
  expenseId: z.string().min(1, "Pengeluaran tidak valid."),
});

export type ListExpensesInput = z.infer<typeof listExpensesSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type DeleteExpenseInput = z.infer<typeof deleteExpenseSchema>;
export type CreateExpenseFormValues = z.input<typeof createExpenseSchema>;
