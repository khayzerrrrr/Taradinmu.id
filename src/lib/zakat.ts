// Perhitungan zakat (murni, tanpa dependensi server) — aman dipakai client.

/** Kadar zakat mal/penghasilan: 2,5%. */
export const ZAKAT_RATE = 0.025;

/** Nisab zakat dinyatakan dalam gram emas (85 gram). */
export const ZAKAT_GRAM_EMAS = 85;

export function round2(nilai: number): number {
  return Math.round(nilai * 100) / 100;
}

export type HasilZakat = {
  /** 2,5% dari harta/laba bersih — selalu dihitung agar bisa ditampilkan. */
  estimasi: number;
  /** Harta/laba bersih sudah mencapai nisab? */
  mencapaiNisab: boolean;
  /** Jumlah yang benar-benar terutang (0 bila belum mencapai nisab). */
  terutang: number;
};

// Hitung zakat dari harta/laba bersih. Neto nol/negatif dianggap tidak ada zakat.
export function hitungZakat(
  neto: number,
  nisab: number,
  rate: number = ZAKAT_RATE,
): HasilZakat {
  const dasar = Number.isFinite(neto) && neto > 0 ? round2(neto) : 0;
  const estimasi = round2(dasar * rate);
  const mencapaiNisab = nisab > 0 ? dasar >= nisab : dasar > 0;
  return { estimasi, mencapaiNisab, terutang: mencapaiNisab ? estimasi : 0 };
}
