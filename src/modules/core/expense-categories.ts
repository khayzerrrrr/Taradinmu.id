import type { ExpenseCategory } from "@/generated/prisma/client";

// Kategori pengeluaran untuk form & filter (urutan ini juga urutan di UI).
// File murni data agar aman dipakai client maupun server.

export const EXPENSE_CATEGORY_VALUES = [
  "OPERATIONAL",
  "PURCHASE",
  "SALARY",
  "RENT",
  "UTILITIES",
  "MARKETING",
  "TAX",
  "OTHER",
] as const satisfies readonly ExpenseCategory[];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  OPERATIONAL: "Operasional",
  PURCHASE: "Pembelian Stok",
  SALARY: "Gaji & Upah",
  RENT: "Sewa",
  UTILITIES: "Listrik, Air & Internet",
  MARKETING: "Pemasaran",
  TAX: "Pajak & Retribusi",
  OTHER: "Lainnya",
};
