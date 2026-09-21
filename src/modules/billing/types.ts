import type { PaginationMeta } from "@/shared/types";

// Tipe internal modul billing (tidak mengimpor tipe dari modul lain).

export type CustomerItem = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  createdAt: string;
  invoiceCount: number;
};

export type CustomerListData = {
  customers: CustomerItem[];
  meta: PaginationMeta;
};

export type InvoiceStatusValue = "DRAFT" | "SENT" | "PAID" | "OVERDUE";

export type InvoiceListItem = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  /** Decimal dikirim sebagai string agar presisi tidak hilang. */
  totalAmount: string;
  taxAmount: string;
  status: InvoiceStatusValue;
  dueDate: string;
  createdAt: string;
  itemCount: number;
  /** Turunan: status SENT dan sudah melewati dueDate. */
  isOverdue: boolean;
};

export type InvoiceListData = {
  invoices: InvoiceListItem[];
  meta: PaginationMeta;
};

export type InvoiceLineItem = {
  id: string;
  variantId: string;
  sku: string;
  variantName: string;
  quantity: number;
  price: string;
  subtotal: string;
};

export type InvoiceDetail = InvoiceListItem & {
  notes: string | null;
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  };
  items: InvoiceLineItem[];
};

export type InvoiceVariantOption = {
  id: string;
  sku: string;
  name: string;
  productName: string;
  price: string;
  /** Stok layak keluar (belum kedaluwarsa). */
  available: number;
};
