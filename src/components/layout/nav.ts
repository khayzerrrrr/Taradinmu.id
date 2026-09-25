// Definisi navigasi & label rute untuk seluruh chrome aplikasi.
// File ini SENGAJA tanpa dependensi server maupun React agar bisa diimpor
// dari Server Component (layout) maupun Client Component (NavList, Breadcrumbs).

export type NavIcon =
  | "dashboard"
  | "products"
  | "stock"
  | "stockIn"
  | "stockOut"
  | "suppliers"
  | "customers"
  | "invoices"
  | "expenses"
  | "zakat"
  | "programs"
  | "settings"
  | "users"
  | "tenants";

export type NavItem = {
  href: string;
  label: string;
  /** Cocok persis. Dipakai untuk Dashboard agar tidak menelan sub-halaman. */
  exact?: boolean;
  /** Penanda paket di sisi kanan baris. */
  badge?: "PRO";
  icon?: NavIcon;
  /**
   * Modul belum aktif untuk tenant ini (mis. Billing pada paket FREE).
   * Baris tetap bisa diklik — halamannya menjelaskan cara mengaktifkan —
   * tetapi diredupkan dan diberi ikon gembok agar statusnya terbaca sekilas.
   */
  terkunci?: boolean;
  /**
   * Fitur PRO yang belum tersedia pada paket FREE. Baris tetap bisa dibuka,
   * dan ikon gembok di sisi kanan membuka modal upgrade. Nilainya adalah kunci
   * gating: modal menampilkan manfaat yang sesuai dengan menu yang diklik, jadi
   * BOOLEAN `true` tidak lagi cukup. NavList meneruskannya ke UpgradeModal, dan
   * TypeScript menolak nilai yang bukan kunci asli di sana.
   */
  kunciPro?: "BATCH" | "ZAKAT" | "PROGRAM" | "HPP" | "BRANDING" | "AI";
};

export type NavSection = {
  judul?: string;
  items: NavItem[];
};

/**
 * Label ramah pengguna untuk tiap segmen URL. Segmen yang tidak ada di peta ini
 * (mis. slug tenant atau id numerik) dilewati oleh breadcrumb, sehingga tidak
 * pernah muncul sebagai "tokoku-abc-123" di antarmuka.
 */
export const SEGMEN_LABEL: Record<string, string> = {
  dashboard: "Dashboard",
  inventory: "Inventory",
  products: "Produk",
  stock: "Stok",
  "stock-in": "Stok Masuk",
  "stock-out": "Stok Keluar",
  // Pemasok berada di bawah folder inventory, jadi segmen induknya wajib tetap
  // punya halaman sendiri — sudah, dan dicek oleh nav-hrefs.test.ts.
  suppliers: "Pemasok",
  billing: "Billing",
  customers: "Pelanggan",
  // "keuangan" SENGAJA tidak diberi label: segmen itu hanya folder pengelompok
  // di URL (/dashboard/keuangan/pengeluaran) dan tidak punya halaman sendiri.
  // Breadcrumbs merakit tautan dari tiap segmen berlabel, jadi melabelinya
  // menghasilkan remah yang menunjuk ke 404 — persis cacat "Invoice" yang
  // dilaporkan pengguna. Lihat penjaga aturannya di nav-hrefs.test.ts.
  pengeluaran: "Pengeluaran",
  zakat: "Zakat",
  program: "Program",
  settings: "Pengaturan Toko",
  users: "Pengguna",
  admin: "Admin",
  tenants: "Tenant",
};

/** Segmen akar aplikasi — dipakai untuk membedakan slug tenant dari rute sistem. */
export const SEGMEN_APLIKASI = new Set(Object.keys(SEGMEN_LABEL));

export function itemAktif(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export type ShellTenant = {
  name: string;
  /** Host atau path yang sedang dipakai, mis. "tokoku.taradinmu.id" atau "/tokoku". */
  host: string;
  plan: string;
  isPro: boolean;
};

export type ShellUser = {
  name: string;
  email: string;
};

/** Dua huruf pertama dari nama untuk Avatar fallback. */
export function inisial(nama: string): string {
  const kata = nama.trim().split(/\s+/).filter((k) => k.length > 0);
  if (kata.length === 0) return "?";
  if (kata.length === 1) return kata[0].slice(0, 2).toUpperCase();
  return `${kata[0][0]}${kata[1][0]}`.toUpperCase();
}
