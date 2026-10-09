// Daftar tertutup untuk pencatatan minat upgrade (PRD 4.D.5).
//
// Sengaja murni data + normalisasi, tanpa Prisma dan tanpa React: supaya bisa
// diuji tanpa DB (lihat upgrade-interest.test.ts) dan dipakai dari komponen
// client (upgrade-modal.tsx) maupun Server Action.
//
// KUNCINYA ADALAH KUNCI GEMBOK, BUKAN TEKS BEBAS. Baik `kunci`, `sumber`, maupun
// `tahap` hanya boleh berisi salah satu anggota daftar di berkas ini. Dengan begitu
// tabel UpgradeInterest tidak pernah bisa menampung data usaha, nama pelanggan,
// atau apa pun yang diketik pengguna — dan agregasinya bermakna ("gembok batch
// diklik 12 kali minggu ini"), yang tidak tercapai kalau string bebas diterima.

/** Kunci gembok yang boleh dicatat. `UMUM` untuk ajakan tanpa fitur spesifik. */
export const KUNCI_MINAT = [
  "BATCH",
  "ZAKAT",
  "PROGRAM",
  "HPP",
  "USERS",
  "INVOICE",
  "PRODUCT",
  "BRANDING",
  "AI",
  "UMUM",
] as const;

export type KunciMinat = (typeof KUNCI_MINAT)[number];

/** Peristiwa yang dicatat. Dua-duanya dibutuhkan: lihat penjelasan di skema. */
export const TAHAP_MINAT = ["BUKA", "CTA"] as const;

export type TahapMinat = (typeof TAHAP_MINAT)[number];

/**
 * Tempat gemboknya berada. Dinamai dari permukaan UI, bukan dari URL, supaya
 * nilai yang masuk ke database tidak pernah bergantung pada data tenant.
 */
export const SUMBER_MINAT = [
  "NAVIGASI",
  "DASHBOARD",
  "HALAMAN_INVOICE",
  "HALAMAN_PRODUK",
  "HALAMAN_PENGGUNA",
  "HALAMAN_PAKET",
  "PRATINJAU_FITUR",
  "ASISTEN_AI",
  "PENGATURAN_TAMPILAN",
  "TIDAK_DIKETAHUI",
] as const;

export type SumberMinat = (typeof SUMBER_MINAT)[number];

/** Label ramah untuk daftar nilai di atas; dipakai UI Super Admin. */
const LABEL_MINAT: Record<KunciMinat, string> = {
  BATCH: "batch & kedaluwarsa",
  ZAKAT: "zakat otomatis",
  PROGRAM: "modul Program",
  HPP: "laporan HPP",
  USERS: "kuota pengguna",
  INVOICE: "kuota invoice",
  PRODUCT: "kuota produk",
  BRANDING: "branding kustom",
  AI: "asisten AI",
  UMUM: "ajakan umum",
};

export function labelKunciMinat(kunci: KunciMinat): string {
  return LABEL_MINAT[kunci];
}

/** Nilai aman untuk pemanggil yang tidak menyebut sumbernya. */
export const SUMBER_BAKU: SumberMinat = "TIDAK_DIKETAHUI";

function anggota<T extends string>(daftar: readonly T[], nilai: unknown): T | null {
  return typeof nilai === "string" && (daftar as readonly string[]).includes(nilai)
    ? (nilai as T)
    : null;
}

/** `null` berarti nilai di luar daftar tertutup — penolakan, bukan penebakan. */
export function normalisasiKunci(nilai: unknown): KunciMinat | null {
  return anggota(KUNCI_MINAT, nilai);
}

export function normalisasiTahap(nilai: unknown): TahapMinat | null {
  return anggota(TAHAP_MINAT, nilai);
}

/** Sumber tidak pernah menolak: pemanggil yang salah menyebutnya jadi TIDAK_DIKETAHUI. */
export function normalisasiSumber(nilai: unknown): SumberMinat {
  return anggota(SUMBER_MINAT, nilai) ?? SUMBER_BAKU;
}

/** Baris hasil `groupBy` yang dibutuhkan perangkuman; dipisah agar bisa diuji. */
export type BarisMinat = {
  tenantId: string;
  kunci: string;
  tahap: string;
  jumlah: number;
};

export type MinatUpgradeRingkas = {
  /** Berapa kali modal upgrade dibuka. */
  buka: number;
  /** Berapa kali tombol WhatsApp di dalamnya diklik. */
  cta: number;
  /** Kunci paling sering muncul, maksimal 3, sudah berupa label ramah. */
  kunci: string[];
};

/** Nilai tampilan untuk tenant yang belum pernah mengklik gembok apa pun. */
export const MINAT_KOSONG: MinatUpgradeRingkas = { buka: 0, cta: 0, kunci: [] };

/**
 * Jendela yang dipakai daftar minat Super Admin. 30 hari dipilih karena siklus
 * keputusan upgrade pada warung/toko berjalan per bulan: lebih pendek dari itu
 * satu minggu sepi bisa tampak seperti fitur yang tidak diminati.
 */
export const JENDELA_MINAT_HARI = 30;

/**
 * Rangkum baris minat per tenant.
 *
 * Urutan kunci ditentukan pada jumlah, dengan urutan alphabetis sebagai pembanding
 * kedua: tanpa pembanding, dua query identik bisa mengembalikan urutan berbeda dan
 * daftar di tabel admin tampak bergerak sendiri.
 */
export function rangkumMinat(
  baris: readonly BarisMinat[],
): Map<string, MinatUpgradeRingkas> {
  type Accumulator = {
    buka: number;
    cta: number;
    perKunci: Map<KunciMinat, number>;
  };
  const perTenant = new Map<string, Accumulator>();

  for (const barisnya of baris) {
    const kunci = normalisasiKunci(barisnya.kunci);
    const jumlah = Number(barisnya.jumlah);
    if (!kunci || !Number.isFinite(jumlah) || jumlah <= 0) continue;

    let accumulator = perTenant.get(barisnya.tenantId);
    if (!accumulator) {
      accumulator = { buka: 0, cta: 0, perKunci: new Map() };
      perTenant.set(barisnya.tenantId, accumulator);
    }

    if (barisnya.tahap === "CTA") {
      accumulator.cta += jumlah;
      continue;
    }

    // Peringkat kunci hanya dihitung dari modal yang DIBUKA. Klik CTA selalu
    // menyusul pembukaan, jadi memasukkannya membuat satu klik bernilai dua dan
    // menggeser peringkat ke gembok yang sudah berhasil menutup penjualannya.
    accumulator.buka += jumlah;
    accumulator.perKunci.set(kunci, (accumulator.perKunci.get(kunci) ?? 0) + jumlah);
  }

  const hasil = new Map<string, MinatUpgradeRingkas>();
  for (const [tenantId, accumulator] of perTenant) {
    const kunciTeratas = [...accumulator.perKunci.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 3)
      .map(([kunci]) => labelKunciMinat(kunci));

    hasil.set(tenantId, {
      buka: accumulator.buka,
      cta: accumulator.cta,
      kunci: kunciTeratas,
    });
  }

  return hasil;
}
