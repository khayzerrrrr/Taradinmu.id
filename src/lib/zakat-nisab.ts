import { ZAKAT_GRAM_EMAS } from "./zakat";

// Nisab = 85 gram emas. Harga emas TIDAK diambil otomatis (belum ada sumber
// harga pada fase ini), sehingga nilainya dapat diatur lewat env
// HARGA_EMAS_PER_GRAM. File ini hanya dipakai di sisi server — UI menerima
// angka nisab lewat response Server Action / prop halaman.

export const HARGA_EMAS_PER_GRAM = Number(
  process.env.HARGA_EMAS_PER_GRAM ?? 1_500_000,
);

/** Nisab zakat perniagaan (harta dagang): 85 gram emas. */
export const NISAB_PERDAGANGAN = Math.round(
  ZAKAT_GRAM_EMAS * HARGA_EMAS_PER_GRAM,
);

/** Nisab zakat penghasilan dihitung bulanan = nisab tahunan dibagi 12. */
export const NISAB_PENGHASILAN = Math.round(NISAB_PERDAGANGAN / 12);
