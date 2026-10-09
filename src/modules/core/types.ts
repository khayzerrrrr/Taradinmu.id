import type {
  ExpenseCategory,
  PlanType,
  Role,
  ZakatType,
} from "@/generated/prisma/client";
import type { MinatUpgradeRingkas } from "@/lib/upgrade-interest";

// Kontrak bersama kini tinggal di src/shared/ supaya modul lain (mis. inventory)
// tidak perlu mengimpor dari modul core. Re-export ini menjaga kode lama tetap jalan.
export type { ActionResponse, PaginationMeta } from "@/shared/types";
export { MODULE_KEYS } from "@/shared/modules";
export type { ModuleKey } from "@/shared/modules";

// Ringkasan klik gembok suatu tenant dalam 30 hari terakhir (PRD 4.D.5).
// Bentuknya ikut mendefinisikan perangkumannya (rangkumMinat) di
// src/lib/upgrade-interest.ts, supaya tidak ada dua tipe untuk angka yang sama.
export type { MinatUpgradeRingkas };

// Riwayat perubahan paket satu tenant (PRD 4.D.4). Hanya beberapa perubahan
// terakhir yang dibaca halaman admin — tabelnya append-only dan bisa tumbuh
// bertahun-tahun.
export type PlanChangeItem = {
  id: string;
  dari: PlanType;
  ke: PlanType;
  /** Serialisasi tanggal berakhir yang dicatat pada perubahan itu. */
  expiresAt: string | null;
  /** Nama Super Admin yang mengubahnya; null bila akunnya sudah dihapus. */
  oleh: string | null;
  catatan: string | null;
  createdAt: string;
};

// Representasi tenant yang dikirim ke UI (tanggal sudah diserialisasi ke string).
export type TenantListItem = {
  id: string;
  name: string;
  slug: string;
  subdomain: string | null;
  plan: PlanType;
  /**
   * Batas masa berlaku paket (PRD 4.D.4), serialisasi ISO tanggal. null berarti
   * tanpa tanggal berakhir — bukan "sudah kedaluwarsa".
   */
  planExpiresAt: string | null;
  enabledModules: string[];
  createdAt: string;
  userCount: number;
  minat: MinatUpgradeRingkas;
  riwayat: PlanChangeItem[];
};

export type TenantListData = {
  tenants: TenantListItem[];
  meta: import("@/shared/types").PaginationMeta;
};

// --- MODUL KEUANGAN (Pencatatan Pengeluaran) ---

export type ExpenseItem = {
  id: string;
  category: ExpenseCategory;
  description: string;
  /** Decimal dikirim sebagai string agar presisi tidak hilang. */
  amount: string;
  expenseDate: string;
  paymentMethod: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: string;
};

export type ExpenseListData = {
  expenses: ExpenseItem[];
  meta: import("@/shared/types").PaginationMeta;
};

export type ExpenseSummary = {
  /** Total pengeluaran bulan berjalan (UTC). */
  totalBulanIni: number;
  jumlahBulanIni: number;
  totalKeseluruhan: number;
};

// --- MODUL ZAKAT ---

export type ZakatPenghasilan = {
  /** Periode perhitungan, format YYYY-MM. */
  periode: string;
  /** Total invoice PAID bulan berjalan. */
  pendapatan: number;
  /**
   * Beban usaha bulan berjalan — inilah yang dikurangkan dari pendapatan untuk
   * mendapat laba bersih. Pembelian stok TIDAK termasuk (PRD 4.G.1).
   */
  bebanOperasional: number;
  /** Pembelian stok bulan berjalan: kas keluar, tapi masih jadi aset. */
  pembelianStok: number;
  /** Seluruh kas keluar bulan berjalan (beban usaha + pembelian stok). */
  pengeluaranKas: number;
  /**
   * Modal barang yang keluar (terjual) bulan berjalan — kurangkan ketiga pada
   * dasar zakat bersama beban usaha (PRD 4.G.1).
   */
  hpp: number;
  /** Unit keluar yang modalnya belum dicatat; > 0 berarti HPP masih kurang besar. */
  unitModalBelumTercatat: number;
  labaBersih: number;
  nisab: number;
  rate: number;
  /** 2,5% dari laba bersih (selalu dihitung, untuk ditampilkan). */
  estimasi: number;
  mencapaiNisab: boolean;
  /** Zakat yang benar-benar terutang (0 bila di bawah nisab). */
  terutang: number;
  jumlahInvoice: number;
  jumlahPengeluaran: number;
};

export type ZakatPerniagaan = {
  aset: number;
  hutang: number;
  /** Harta bersih = aset - hutang. */
  neto: number;
  nisab: number;
  rate: number;
  estimasi: number;
  mencapaiNisab: boolean;
  terutang: number;
};

export type ZakatHistoryItem = {
  id: string;
  type: ZakatType;
  /** Waktu perhitungan/penyimpanan (jejak input). */
  calculationDate: string;
  /** Periode laporan; null hanya untuk baris lama sebelum migrasi. */
  periodYear: number | null;
  periodMonth: number | null;
  totalAssets: string;
  totalLiabilities: string;
  netAssets: string;
  nisab: string;
  rate: string;
  zakatDue: string;
  isPaid: boolean;
  paidAt: string | null;
  notes: string | null;
};

// --- MODUL CORE: MANAJEMEN PENGGUNA ---

export type UserListItem = {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  /** Baris milik sesi yang sedang aktif — tidak boleh dihapus/diubah sendiri. */
  isSelf: boolean;
  /** Akun pemilik/SUPER_ADMIN tidak dapat diubah dari halaman ini. */
  tidakDapatDiubah: boolean;
};

export type UserListData = {
  users: UserListItem[];
  meta: import("@/shared/types").PaginationMeta;
};
