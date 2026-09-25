import type { ItemKind } from "@/generated/prisma/client";
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
  /** Barang (punya stok) atau jasa (tanpa stok). */
  kind: ItemKind;
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
  /** null = belum ada catatan harga modal; HPP unit ini tidak bisa dihitung. */
  costPrice: string | null;
  supplierName: string | null;
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
  /**
   * Harga modal per unit batch asal (PRD 4.G.3); null bila batch itu tidak punya
   * catatan harga modal.
   */
  unitCost: number | null;
};

// --- Pemasok (PRD 4.G.4) ---

export type SupplierItem = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  /** Batch yang masih tercatat berasal dari pemasok ini. */
  batchCount: number;
  /** Nilai stok (unit x harga modal) yang masih ada di batch tersebut. */
  nilaiModal: string;
};

export type SupplierListData = {
  suppliers: SupplierItem[];
  meta: PaginationMeta;
};

/** Opsi pemasok untuk form stok masuk. */
export type SupplierOption = {
  id: string;
  name: string;
};
