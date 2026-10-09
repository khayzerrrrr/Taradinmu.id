import type { PlanType } from "@/generated/prisma/client";
import {
  akhirHariZona,
  nomorHari,
  ZONA_DEFAULT,
} from "@/lib/zona-waktu";

// Batas paket langganan (PRD Bagian 3: pembedaan FREE vs PRO).
// File murni data (tanpa dependensi server) agar aman dipakai client & server.

/** Jenis batas yang bisa diperiksa lewat checkLimit(). */
export type LimitKey =
  | "INVOICE"
  | "PRODUCT"
  | "USERS"
  | "BATCH"
  | "ZAKAT"
  | "PROGRAM"
  | "HPP"
  | "BRANDING"
  | "AI";

/** Batas berbasis jumlah (dihitung dari data tenant). */
export type LimitJumlahKey = Extract<LimitKey, "INVOICE" | "PRODUCT" | "USERS">;

/**
 * Batas berbasis fitur (aktif/tidak untuk paket). Semua kunci di sini wajib
 * ditangani cabang fitur `checkLimit` — menambah kunci tanpa menambah cabangnya
 * membuatnya jatuh ke cabang jumlah dan diperlakukan sebagai hitungan baris.
 */
export type LimitFiturKey = Extract<
  LimitKey,
  "BATCH" | "ZAKAT" | "PROGRAM" | "HPP" | "BRANDING" | "AI"
>;

export type PlanLimits = {
  /**
   * Jumlah maksimum invoice **per bulan** (PRD Bagian 4.D); null = tanpa batas.
   * Hitungannya dibatasi bulan berjalan di `feature-guards.ts`, bukan total.
   */
  invoice: number | null;
  /** Jumlah maksimum produk; null = tanpa batas. */
  product: number | null;
  /** Jumlah maksimum pengguna tenant; null = tanpa batas (PRD 4.D). */
  users: number | null;
  /** Fitur batch (nomor batch + tanggal kedaluwarsa). */
  batch: boolean;
  /** Perhitungan zakat otomatis dari invoice & pengeluaran. */
  autoZakat: boolean;
  /** Modul Program — pusat biaya & tagih per industri (PRD 4.F). */
  program: boolean;
  /**
   * Laporan HPP & margin (PRD 4.G.5). Yang dibatasi hanya LAPORANNYA: pemisahan
   * arus kas vs laba dan pengurangan HPP di angka laba berlaku untuk semua
   * paket, karena itu koreksi angka yang salah — bukan fitur baru.
   */
  hpp: boolean;
  /** White-label: logo & warna tema kustom (PRD 4.D). */
  branding: boolean;
  /** Asisten AI di dalam aplikasi (PRD 4.E). */
  ai: boolean;
};

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  // FREE: 1 pengguna (hanya Owner), 50 invoice per bulan — PRD Bagian 4.D.
  FREE: {
    invoice: 50,
    product: 100,
    users: 1,
    batch: false,
    autoZakat: false,
    program: false,
    hpp: false,
    branding: false,
    ai: false,
  },
  PRO: {
    invoice: null,
    product: null,
    users: null,
    batch: true,
    autoZakat: true,
    program: true,
    hpp: true,
    branding: true,
    ai: true,
  },
};

/** Label ramah pengguna untuk dipakai di pesan batas. */
export const LIMIT_LABELS: Record<LimitKey, string> = {
  INVOICE: "invoice",
  PRODUCT: "produk",
  USERS: "pengguna",
  BATCH: "fitur batch (nomor batch & kedaluwarsa)",
  ZAKAT: "zakat otomatis",
  PROGRAM: "modul Program",
  HPP: "laporan HPP & margin",
  BRANDING: "branding kustom (logo & warna)",
  AI: "Asisten AI",
};

/**
 * Harga PRO per bulan (PRD 4.D). Sumber tunggal: setiap ajakan upgrade membaca
 * konstanta ini, supaya tidak pernah ada dua modal yang menyebut harga berbeda.
 * Pembulatannya memakai `formatRupiah` di berkas UI, bukan di sini — berkas ini
 * sengaja murni data tanpa dependensi.
 * Aktivasinya masih manual lewat WhatsApp admin: belum ada payment gateway.
 */
export const HARGA_PRO_BULAN = 149_000;

/**
 * Keterangan periode untuk batas berbasis jumlah. Invoice dihitung per bulan
 * (PRD 4.D), sedangkan produk & pengguna dihitung total — jadi keduanya sengaja
 * dibedakan supaya pesan batas tidak menyesatkan.
 */
export const LIMIT_PERIODE: Partial<Record<LimitJumlahKey, string>> = {
  INVOICE: "per bulan",
};

/** Label batas jumlah sekaligus periodenya, mis. "invoice per bulan". */
export function labelBatasJumlah(key: LimitJumlahKey): string {
  const periode = LIMIT_PERIODE[key];
  return periode ? `${LIMIT_LABELS[key]} ${periode}` : LIMIT_LABELS[key];
}

export function ambilPlanLimits(plan: PlanType): PlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.FREE;
}

export const SATU_HARI_MS = 24 * 60 * 60 * 1000;

/**
 * Acuan "hari" untuk seluruh perhitungan paket.
 *
 * Dulu konstanta `ZONA_PAKET_MS = UTC+7` di sini. Sekarang diambil dari
 * `zona-waktu.ts` memakai nama zona IANA, karena produk ini tidak hanya melayani
 * satu negara: penyewa di Riyadh +3 harus menghitungey'sa hatinya sendiri, dan
 * tabel offset manual akan salah untuk zona ber-musim-panas.
 *
 * Nilai defaultnya tetap WIB supaya semua pemanggil lama yang belum punya akses
 * ke `tenant.timezone` berperilaku persis seperti sebelumnya.
 */
const ZONA_PAKET_DEFAULT = ZONA_DEFAULT;

/** Awal hari UTC. Dipakai agar hitungan hari tidak terganggu jam pada kolom. */
function awalHari(tanggal: Date): number {
  return Date.UTC(
    tanggal.getUTCFullYear(),
    tanggal.getUTCMonth(),
    tanggal.getUTCDate(),
  );
}

/** Nomor hari kalender penyewa untuk satu titik waktu. */
function hariPenyewa(titik: Date, timeZone: string): number {
  return nomorHari(titik, timeZone);
}

/**
 * Batas masa berlaku sebuah tanggal: sampai akhir HARI TERAKHIR itu menurut
 * zona penyewa, sehingga "berlaku sampai 5 Okt" melayani sampai 6 Okt 00:00 lokal.
 */
function akhirHariPlan(tanggal: Date, timeZone: string): number {
  return akhirHariZona(tanggal, timeZone);
}

/**
 * Jarak hari kalender dari hari ini ke tanggal berakhir: 0 bila berakhir hari
 * ini, positif bila masih ada sisa, negatif bila sudah lewat.
 *
 * Sisi tanggal dibaca sebagai hari UTC-nya karena `tanggalMasaBerlaku()` selalu
 * menyimpan tengah malam UTC -- tanggal yang diketik admin adalah tanggal yang
 * tampil, di zona mana pun servernya berjalan. Yang digeser hanya "hari ini".
 */
export function jarakHariKe(
  planExpiresAt: Date,
  sekarang: Date = new Date(),
  timeZone: string = ZONA_PAKET_DEFAULT,
): number {
  return Math.round(
    (awalHari(planExpiresAt) - hariPenyewa(sekarang, timeZone)) / SATU_HARI_MS,
  );
}

/**
 * Hanya paket PRO yang bisa kedaluwarsa (PRD 4.D.4): FREE adalah keadaan awal
 * sebuah tenant, bukan sesuatu yang berakhir. Helper ini ada di berkas batas
 * paket — bukan di Server Action — supaya pertanyaan "apakah tanggalnya berarti"
 * dijawab oleh kosakata yang sama dengan yang menegakkan paketnya.
 */
export function paketBisaKedaluwarsa(plan: PlanType): boolean {
  return plan === "PRO";
}

/** Keadaan paket sebelum dan sesudah satu tombol "Simpan" ditekan. */
export type KeadaanPaket = { plan: PlanType; planExpiresAt: Date | null };

/**
 * Apakah perubahan ini layak masuk riwayat paket (PRD 4.D.4).
 *
 * Perpanjangan bulanan adalah peristiwa yang PALING SERING terjadi di jalur ini:
 * paketnya tetap PRO, hanya tanggalnya bergeser. Kalau "perubahan" diukur dari
 * `plan` saja, setiap perpanjangan terdokumentasi nol baris dan tabel riwayat
 * hanya berisi aktivasi pertama — persis data yang tidak bisa dipakai menagih.
 *
 * Tanggal dibandingkan sebagai `getTime()`, bukan identitas objek: Prisma
 * mengembalikan `Date` baru setiap query, jadi `===` akan menyebut setiap
 * penyimpanan sebagai perubahan dan mengisi riwayat dengan klik "Simpan" yang
 * tidak mengubah apa pun.
 */
export function riwayatPerluDitulis(
  sebelum: KeadaanPaket,
  sesudah: KeadaanPaket,
): boolean {
  if (sebelum.plan !== sesudah.plan) return true;
  const lama = sebelum.planExpiresAt?.getTime() ?? null;
  const baru = sesudah.planExpiresAt?.getTime() ?? null;
  return lama !== baru;
}

/**
 * Tanggal berakhir yang SUDAH lewat, atau `null` bila paketnya masih berlaku.
 *
 * FREE tidak pernah punya masa berlaku, dan PRO tanpa tanggal (kolomnya kosong)
 * berjalan terus — sama seperti sebelum pencatatan masa berlaku ada, sehingga
 * mengaktifkan fitur ini tidak tiba-tiba menurunkan tenant yang sedang membayar.
 *
 * Tanggal yang tersimpan bersifat INKLUSIF: paket berlaku sampai akhir hari itu,
 * bukan sampai tengah malasnya. Admin yang menulis "berlaku sampai 31-10" berarti
 * tenant-nya masih berjualan pada tanggal 31 — menurunkan akses di pagi hari pada
 * hari terakhir terasa seperti jebakan, dan itu justru yang dihindari kontrak ini.
 */
export function tanggalKedaluwarsaPlan(
  plan: PlanType,
  planExpiresAt: Date | null | undefined,
  sekarang: Date = new Date(),
  timeZone: string = ZONA_PAKET_DEFAULT,
): Date | null {
  if (plan !== "PRO") return null;
  if (!planExpiresAt) return null;
  return sekarang.getTime() >= akhirHariPlan(planExpiresAt, timeZone)
    ? planExpiresAt
    : null;
}

/**
 * Paket yang berlaku SAAT INI (PRD 4.D.4). Setelah tanggal berakhir lewat,
 * tenant berjalan sebagai FREE — dihitung saat pembacaan, tanpa pekerjaan
 * terjadwal, dan TANPA menghapus data apa pun: begitu masanya diperpanjang,
 * semua angkanya kembali seperti semula.
 *
 * Kolom `plan` tidak diubah oleh fungsi ini. Ia tetap menyimpan paket yang
 * dibeli, supaya perpanjangan cukup mengisi tanggal dan riwayat tidak hilang.
 */
export function planEfektif(
  plan: PlanType,
  planExpiresAt: Date | null | undefined,
  sekarang: Date = new Date(),
  timeZone: string = ZONA_PAKET_DEFAULT,
): PlanType {
  return tanggalKedaluwarsaPlan(plan, planExpiresAt, sekarang, timeZone)
    ? "FREE"
    : plan;
}

/** Batas jumlah untuk INVOICE/PRODUCT/USERS; null berarti tanpa batas. */
export function ambilBatasJumlah(
  plan: PlanType,
  key: LimitJumlahKey,
): number | null {
  const limits = ambilPlanLimits(plan);
  if (key === "INVOICE") return limits.invoice;
  if (key === "PRODUCT") return limits.product;
  return limits.users;
}

/**
 * Status fitur untuk semua LimitFiturKey. `switch` tanpa `default` dipilih
 * sengaja: menambah satu kunci ke LimitFiturKey tanpa menangani cabangnya di
 * sini menjadi error kompilasi, bukan nilai diam-diam dari cabang lain.
 */
export function ambilBatasFitur(
  plan: PlanType,
  key: LimitFiturKey,
): boolean {
  const limits = ambilPlanLimits(plan);
  switch (key) {
    case "BATCH":
      return limits.batch;
    case "ZAKAT":
      return limits.autoZakat;
    case "HPP":
      return limits.hpp;
    case "PROGRAM":
      return limits.program;
    case "BRANDING":
      return limits.branding;
    case "AI":
      return limits.ai;
  }
}

/**
 * Kuota yang perlu diperhatikan di dashboard (PRD 4.D.3). Batas yang datang
 * tiba-tiba terasa seperti jebakan, jadi kemajuan kuota mulai ditampilkan sebelum
 * tersenggol. Ambangnya sengaja tinggi: dashboard warung jangan sampai berubah
 * menjadi spanduk penjualan.
 */
export const AMBANG_KUOTA_DASHBOARD = 0.8;

export type KuotaMendesak = {
  key: LimitJumlahKey;
  label: string;
  terpakai: number;
  batas: number;
};

/**
 * `null` bila batasnya tidak berlaku (PRO), datanya belum mencapai ambang, atau
 * modulnya tidak aktif (pemanggil mengirim terpakai = 0 untuk kasus itu).
 */
export function kuotaMendesak(
  key: LimitJumlahKey,
  plan: PlanType,
  terpakai: number,
): KuotaMendesak | null {
  const batas = ambilBatasJumlah(plan, key);
  if (batas === null || batas <= 0) return null;
  if (terpakai / batas < AMBANG_KUOTA_DASHBOARD) return null;
  return { key, label: labelBatasJumlah(key), terpakai, batas };
}
