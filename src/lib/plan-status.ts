import type { PlanType } from "@/generated/prisma/client";
import { formatTanggal } from "@/lib/format";
import {
  ambilBatasFitur,
  ambilBatasJumlah,
  jarakHariKe,
  kuotaMendesak,
  labelBatasJumlah,
  LIMIT_LABELS,
  tanggalKedaluwarsaPlan,
  type LimitFiturKey,
  type LimitJumlahKey,
} from "@/lib/plan-limits";

// Bahan tampilan halaman "Paket & penggunaan" (PRD 4.D.3).
//
// Berkas ini SENGAJA murni data tanpa database: halaman hanya bertugas mengambil
// tiga angka pemakaian, dan logika "apa yang ditampilkan untuk angka itu" diuji di
// sini. Karena itu penyusun barisnya menerima `terpakai` sebagai argumen.

export type BarisKuota = {
  key: LimitJumlahKey;
  /** Sudah beserta periode, mis. "invoice per bulan". */
  label: string;
  terpakai: number;
  /** `null` = tanpa batas (paket PRO). */
  batas: number | null;
  /** 0-100; 0 bila tanpa batas supaya pemanggil tidak butuh cabang. */
  persen: number;
  /**
   * Sudah seharusnya ditonjolkan. Aturannya diambil dari `kuotaMendesak` —
   * fungsi yang sama yang menyalakan meter di dashboard — supaya dua permukaan
   * itu tidak bisa berdua beda perilaku saat ambangnya diubah.
   */
  menipis: boolean;
};

export type BarisFitur = {
  key: LimitFiturKey;
  label: string;
  aktif: boolean;
};

export type StatusPaket = {
  plan: PlanType;
  kuota: BarisKuota[];
  fitur: BarisFitur[];
};

/** Urutan baris di halaman — stabil, bukan urutan objek. */
export const URUTAN_KUOTA: readonly LimitJumlahKey[] = [
  "INVOICE",
  "PRODUCT",
  "USERS",
];

export const URUTAN_FITUR: readonly LimitFiturKey[] = [
  "BATCH",
  "ZAKAT",
  "PROGRAM",
  "HPP",
  "BRANDING",
  "AI",
];

export function susunStatusPaket(
  plan: PlanType,
  terpakai: Partial<Record<LimitJumlahKey, number>> = {},
): StatusPaket {
  const kuota = URUTAN_KUOTA.map<BarisKuota>((key) => {
    const batas = ambilBatasJumlah(plan, key);
    const sudah = terpakai[key] ?? 0;
    return {
      key,
      label: labelBatasJumlah(key),
      terpakai: sudah,
      batas,
      persen:
        batas === null || batas <= 0
          ? 0
          : Math.min(100, Math.round((sudah / batas) * 100)),
      menipis: kuotaMendesak(key, plan, sudah) !== null,
    };
  });

  const fitur = URUTAN_FITUR.map<BarisFitur>((key) => ({
    key,
    label: LIMIT_LABELS[key],
    aktif: ambilBatasFitur(plan, key),
  }));

  return { plan, kuota, fitur };
}

/**
 * Berapa kunci fitur yang masih tertutup — dipakai badge dan kalimat pembuka
 * halaman, supaya angka "6 fitur terkunci" tidak diketik di dalam JSX.
 */
export function jumlahFiturTerkunci(status: StatusPaket): number {
  return status.fitur.filter((baris) => !baris.aktif).length;
}

/**
 * Semua batas jumlah sekaligus, mis. "50 invoice per bulan, 100 produk,
 * 1 pengguna". `null` bila tidak ada batas sama sekali (PRO) — pemanggil tidak
 * perlu menyingkirkan baris PRO satu per satu di dalam JSX.
 */
export function ringkasBatas(status: StatusPaket): string | null {
  const fragmen = status.kuota.flatMap((baris) =>
    baris.batas === null ? [] : [`${baris.batas} ${baris.label}`],
  );
  return fragmen.length > 0 ? fragmen.join(", ") : null;
}

// --- MASA BERLAKU PAKET (PRD 4.D.4) ---------------------------------------

/**
 * Di bawah ambang ini masa berlaku ditandai mendesak. Setara dengan satu
 * minggu: cukup lama untuk menghubungi admin, cukup pendek untuk tidak berubah
 * menjadi spanduk yang menyala terus di halaman paket.
 */
export const AMBANG_MASA_BERLAKU_MENDESAK = 7;

export type MasaBerlakuPaket = {
  expiresAt: Date;
  /** `true` bila masanya sudah lewat — paket yang dibeli masih PRO, aksesnya FREE. */
  kedaluwarsa: boolean;
  /**
   * Hari kalender antara hari ini dan tanggal berakhir: 0 berarti berakhir hari
   * ini, positif berarti masih ada sisa, negatif berarti sudah lewat berapa hari.
   */
  sisaHari: number;
  /** Perlu ditonjolkan (sisa <= 7 hari, atau sudah lewat). */
  mendesak: boolean;
  /** Kalimat pendek tanpa tanggal, mis. "sisa 4 hari" atau "sudah lewat 2 hari". */
  pesan: string;
  /** Kalimat lengkap untuk satu baris UI, mis. "berlaku sampai 30 Sep 2026 · sisa 4 hari". */
  kalimat: string;
};

/**
 * Bahan kalimat masa berlaku. Sengaja menerima `plan` yang TERSIMPAN di database
 * (paket yang dibeli), bukan paket efektif: setelah tanggalnya lewat, paket
 * efektif menjadi FREE justru karena masa berlakunya habis — memakai nilai itu
 * di sini akan menyembunyikan pesan yang paling perlu dilihat penyewanya.
 *
 * `null` bila tidak ada yang perlu dikatakan: FREE tidak punya masa berlaku,
 * dan PRO tanpa tanggal berjalan terus.
 */
export function susunMasaBerlaku(
  plan: PlanType,
  planExpiresAt: Date | null | undefined,
  sekarang: Date = new Date(),
): MasaBerlakuPaket | null {
  if (plan !== "PRO") return null;
  if (!planExpiresAt) return null;

  // Kedaluwarsa dinilai oleh fungsi yang sama dengan penegak akses, supaya dua
  // permukaan ini tidak bisa berdua berbeda pendapat soal tanggal yang sama.
  const kedaluwarsa =
    tanggalKedaluwarsaPlan(plan, planExpiresAt, sekarang) !== null;
  const sisaHari = jarakHariKe(planExpiresAt, sekarang);
  const pesan = kedaluwarsa
    ? `sudah lewat ${Math.abs(sisaHari)} hari`
    : sisaHari === 0
      ? "berakhir hari ini"
      : `sisa ${sisaHari} hari`;

  return {
    expiresAt: planExpiresAt,
    kedaluwarsa,
    sisaHari,
    mendesak: kedaluwarsa || sisaHari <= AMBANG_MASA_BERLAKU_MENDESAK,
    pesan,
    // Tanggalnya ikut di sini supaya tabel Super Admin dan halaman paket tenant
    // menyebut tanggal yang sama dengan kata yang sama.
    kalimat: `${kedaluwarsa ? "kedaluwarsa" : "berlaku sampai"} ${formatTanggal(planExpiresAt)} · ${pesan}`,
  };
}
