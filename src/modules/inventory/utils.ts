// Helper murni modul inventory (aman dipakai di client maupun server).
// Sebagian besar helper stok, format, dan error Server Action kini tinggal di
// src/lib agar bisa dipakai modul lain (mis. billing) tanpa impor antar-modul.

export {
  EXPIRING_SOON_DAYS,
  LOW_STOCK_THRESHOLD,
  isExpired,
  isExpiringSoon,
  parseTanggalInput,
  ringkasStok,
  type RingkasanStok,
  type StokBatchRingkas,
} from "@/lib/stock";

export { formatRupiah } from "@/lib/format";

export {
  isForeignKeyError,
  isRecordNotFoundError,
  isUniqueConstraintError,
  pesanErrorUmum,
  pesanValidasi,
} from "@/lib/action";

// Harga: maksimal 10 digit di depan dan 2 desimal. Divalidasi sebagai string
// agar nilai Decimal(12,2) tidak kehilangan presisi.
export const PRICE_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
