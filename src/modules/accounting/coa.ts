// Template Chart of Accounts (Fase 1, PRD §4 F1.5).
//
// Murni tanpa Prisma: daftar akun di sini adalah DATA, bukan query, sehingga
// bisa diuji tanpa database dan bisa dipakai di client maupun server.
//
// Tiga hal yang membedakan template ini dari sekadar daftar akun:
//
// 1. Kode memakai pola 1-1001, bukan 10101. ACCOUNT/journal presentation di
//    Indonesia umumnya mengelompokkan per tipe (ASET = 1, LIABILITAS = 2,
//    PENDAPATAN = 4, BEBAN = 5, MODAL = 3). Nomor urut jadi tidak ambigu saat
//    CoA diimpor dari Excel atau diekspor ke akuntan.
//
// 2. Setiap akun yang dipakai jurnal otomatis ditandai `system: true`. Akun
//    sistem tidak boleh dihapus/dinonaktifkan: kodenya sudah tercetak di laporan
//    yang pernah diserahkan ke akuntan atau Kantor Pajak.
//
// 3. Akun pajak SENGAJA belum ada. Modul pajak (Fase 4) akan menambahkannya per
//    kelas tarif — PPN 12% dengan DPP nilai lain 11/12 butuh akun terpisah untuk
//    itu, bukan satu akun "PPN" yang tidak menjelaskan apa pun.

import type { AccountType } from "@/generated/prisma/client";

export type TemplateAkun = {
  code: string;
  name: string;
  type: AccountType;
  /** Akun ini dipakai jurnal otomatis, jadi tidak boleh dihapus. */
  system: boolean;
};

/**
 * Enam belas akun ini menutup satu siklus transaksi lengkap: jual, terima
 * uang, beli barang, catat beban, tutup buku. Template ini sengaja pendek — CoA
 * 60 akun/template lengkap menambah rasa lengkap tanpa menambah kebenaran, dan
 * setiap akun yang tidak pernah dipakai adalah satu akun yang bisa salah isi.
 *
 * AKUN YANG SENGAJA TIDAK ADA (dan alasannya):
 * - Utang/Piutang pajak: muncul setelah modul pajak (Fase 4). Sekarang PPN
 *   hanya satu kolom pada Invoice, dan memaksanya jadi akun menyiratkan presisi
 *   yang belum ada.
 * - Aset tetap: penyusutan otomatis belum dibangun (Fase 1 belum); menambah
 *   akun tanpa penyusutan menghasilkan aset yang tidak pernah berkurang.
 * - Beban gaji: sudah ada di `ExpenseCategory.SALARY`, jadi HPP/CoA-nya
 *   disambungkan di Fase 1d saat jurnal otomatis dibangun.
 */
export const COA_MINIMAL: readonly TemplateAkun[] = [
  // --- ASET ---
  { code: "1-1001", name: "Kas", type: "ASSET", system: true },
  { code: "1-1002", name: "Bank", type: "ASSET", system: true },
  { code: "1-1100", name: "Piutang Usaha", type: "ASSET", system: true },
  { code: "1-1200", name: "Persediaan", type: "ASSET", system: true },
  { code: "1-1300", name: "Sisa Utang Usaha", type: "ASSET", system: true },

  // --- LIABILITAS ---
  { code: "2-1000", name: "Utang Usaha", type: "LIABILITY", system: true },

  // --- MODAL ---
  { code: "3-1000", name: "Modal Disetor", type: "EQUITY", system: true },
  { code: "3-2000", name: "Laba Ditahan", type: "EQUITY", system: true },

  // --- PENDAPATAN ---
  { code: "4-1000", name: "Pendapatan Penjualan", type: "REVENUE", system: true },
  { code: "4-2000", name: "Pendapatan Jasa", type: "REVENUE", system: true },

  // --- BEBAN ---
  { code: "5-1000", name: "Harga Pokok Penjualan", type: "EXPENSE", system: true },
  { code: "5-2000", name: "Beban Gaji", type: "EXPENSE", system: true },
  { code: "5-3000", name: "Beban Sewa", type: "EXPENSE", system: true },
  { code: "5-4000", name: "Beban Utilitas", type: "EXPENSE", system: true },
  { code: "5-5000", name: "Beban Pemasaran", type: "EXPENSE", system: true },
  { code: "5-6000", name: "Beban Lain-lain", type: "EXPENSE", system: true },
] as const;

/**
 * Kode akun yang dipakai jurnal otomatis, dikunci dalam satu objek.
 *
 * Dipisah dari array supaya engine jurnal menulis `"KODE_AKUN.penjualan"`
 * alih-alih string yang sama di-copy ke beberapa tempat.]string yang sama
 * yang ditulis ulang di tempat lain adalah cara nomor akun berubah diam-diam
 * lalu jurnal otomatis diam-diam menulis ke akun yang salah.
 */
export const KODE_AKUN = {
  kas: "1-1001",
  bank: "1-1002",
  piutangUsaha: "1-1100",
  persediaan: "1-1200",
  sisaUtangUsaha: "1-1300",
  utangUsaha: "2-1000",
  modalDisetor: "3-1000",
  labaDitahan: "3-2000",
  pendapatanPenjualan: "4-1000",
  pendapatanJasa: "4-2000",
  hpp: "5-1000",
  bebanGaji: "5-2000",
  bebanSewa: "5-3000",
  bebanUtilitas: "5-4000",
  bebanPemasaran: "5-5000",
  bebanLain: "5-6000",
} as const;

export type KunciAkun = keyof typeof KODE_AKUN;

/**
 * Memetakan kategori `ExpenseCategory` yang sudah ada ke akun beban.
 *
 * Pemetaan ini yang membuat Expense lama bisa dipindahkan ke GL tanpa diubah
 * sedikit pun di UI: kategori yang sudah dipilih pengguna punya tempat di
 * pembukuan, bukan luber jadi "akun lain".
 */
export const PETA_BEBAN: Record<
  "OPERATIONAL" | "PURCHASE" | "SALARY" | "RENT" | "UTILITIES" | "MARKETING" | "TAX" | "OTHER",
  KunciAkun
> = {
  // Pembelian stok TIDAK memotong beban: barang masih jadi aset (PRD 4.G.1).
  // Ia jadi jurnal Persediaan, bukan jurnal beban — pemetaannya ada di
  // `engine-jurnal.ts`, bukan di sini.
  PURCHASE: "persediaan",
  SALARY: "bebanGaji",
  RENT: "bebanSewa",
  UTILITIES: "bebanUtilitas",
  MARKETING: "bebanPemasaran",
  // Pajak & retribusi belum punya akun khusus (modul pajak Fase 4), jadi
  // sementara masuk beban lain. Fase 4 yang memindahkannya.
  TAX: "bebanLain",
  // Operasional harian: belum cukup rinci untuk dipisah. Beban lain adalah
  // tempat paling jujur — memaksanya ke akun yang tidak ada berarti
  // mengarang klasifikasi.
  OPERATIONAL: "bebanLain",
  OTHER: "bebanLain",
};

/** Kode akun yang ada di template, dipakai tes konsistensi. */
export const KODE_AKUN_DI_TEMPLATE: readonly string[] = COA_MINIMAL.map(
  (a) => a.code,
);
