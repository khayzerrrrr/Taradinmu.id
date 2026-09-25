import type { ItemKindValue } from "@/shared/item-kind";
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

/**
 * Laporan HPP satu dokumen (PRD 4.G.5): hanya dikirim bila paket tenant
 * menyertakannya, supaya penguncian PRO ditegakkan di server, bukan dengan
 * menyembunyikan kolom di UI.
 */
export type LaporanHppDokumen = {
  /** Modal barang yang keluar untuk dokumen ini. */
  hpp: number;
  /** Total tagihan − HPP. */
  labaKotor: number;
  /** Unit keluar tanpa catatan harga modal; > 0 berarti HPP kurang besar. */
  unitModalBelumTercatat: number;
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
  /** null bila laporan HPP tidak tersedia pada paket ini. */
  laporanHpp: LaporanHppDokumen | null;
};

export type InvoiceVariantOption = {
  id: string;
  sku: string;
  name: string;
  productName: string;
  price: string;
  /** Barang (memotong stok saat ditagih) atau jasa (tidak menyentuh stok). */
  kind: ItemKindValue;
  /** Stok layak keluar (belum kedaluwarsa). Tidak berarti untuk item jasa. */
  available: number;
};
