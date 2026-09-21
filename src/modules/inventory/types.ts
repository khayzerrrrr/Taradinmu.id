import type { PaginationMeta } from "@/shared/types";

// Tipe internal modul inventory (tidak mengimpor tipe dari modul lain).

export type VariantItem = {
  id: string;
  sku: string;
  name: string;
  /** Decimal dikirim sebagai string agar presisi tidak hilang. */
  price: string;
};

export type ProductListItem = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  variants: VariantItem[];
};

export type ProductListData = {
  products: ProductListItem[];
  meta: PaginationMeta;
};

// --- Batch & stok ---

export type BatchItem = {
  id: string;
  batchNumber: string;
  quantity: number;
  expiredDate: string | null;
  isExpired: boolean;
};

export type VariantOption = {
  id: string;
  sku: string;
  name: string;
  productName: string;
  /** Stok yang masih layak keluar (belum kedaluwarsa). */
  available: number;
  /** Stok yang sudah kedaluwarsa (tidak diikutkan FEFO). */
  expired: number;
  batchCount: number;
};

export type StockSummaryItem = {
  variantId: string;
  sku: string;
  variantName: string;
  productName: string;
  totalQuantity: number;
  nonExpiredQuantity: number;
  expiredQuantity: number;
  batchCount: number;
  nearestExpiry: string | null;
  isLowStock: boolean;
  isExpiringSoon: boolean;
};

export type StockListData = {
  items: StockSummaryItem[];
  meta: PaginationMeta;
};

export type MovementType = "IN" | "OUT" | "ADJUSTMENT";

export type StockMovementItem = {
  id: string;
  type: MovementType;
  quantity: number;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  batchNumber: string;
  sku: string;
  variantName: string;
};

export type StockOutAllocation = {
  batchId: string;
  batchNumber: string;
  expiredDate: string | null;
  quantity: number;
};
