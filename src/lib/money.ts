// Helper nominal multi-mata-uang (Fase 0.2).
//
// `formatRupiah` di src/lib/format.ts tetap dipakai di banyak tempat dan sengaja
// TIDAK diubah:zensinya sudah jadi bahasa halaman di seluruh aplikasi. Berkas ini
// ada untuk jalur yang butuh mata uang tenant, dan pada Fase 7 semua pemanggilan
// `formatRupiah` dialihkan ke sini supaya迁 tidak ada lagi nominal yang ditulis
// dengan asumsi rupiah.
//
// Prinsip: presisi desimal ikut mata uang, bukan ikut kebiasaan. IDR tidak punya
// subunit yang dipakai sehari-hari sehingga tampil tanpa desimal; USD/Euro
// menampilkan dua; tuple beberapa negara Timur Tengah dapat tiga. Format fixes
// dua desimal untuk semua orang akan membulatkan-nol nominal yang tidak nol di
// negara lain — dan pembulatan pada pembukuan adalah kebohongan.

// Kode ISO 4217 selalu tiga huruf. Daftar ini hanya untuk menentukan
// `maximumFractionDigits`; mata uang lain di luar daftar memakai default Intl.
const DESIMAL_MATA_UANG: Record<string, number> = {
  // Tanpa subunit lazim: tampil bulat, jauh lebih mudah dibaca di kartu metrik.
  IDR: 0,
  JPY: 0,
  KRW: 0,
  VND: 0,
  // Dua desimal.
  USD: 2,
  EUR: 2,
  GBP: 2,
  AUD: 2,
  SGD: 2,
  MYR: 2,
  // Tiga desimal — lazim dipakai di negara GCC.
  BHD: 3,
  KWD: 3,
  OMR: 3,
  JOD: 3,
  TND: 3,
};

export const MATA_UANG_DEFAULT = "IDR";

/**
 * Berapa desimal yang boleh ditampilkan untuk mata uang tertentu.
 *
 * Nilai desimal yang tersimpan di database bisa lebih tinggi dari yang
 * ditampilkan — `maximumFractionDigits` untuk tampilan, bukan untuk data. Jadi
 * membulatkan di sini tidak menghilangkan presisi apa pun dari pembukuan.
 */
export function desimalMataUang(currency: string): number {
  return DESIMAL_MATA_UANG[currency.toUpperCase()] ?? 2;
}

/** Localitas yang mengikuti mata uang, supaya pemisah ribuan benar. */
function lokalitas(currency: string): string {
  const kode = currency.toUpperCase();
  if (kode === "IDR" || kode === "VND") return "id-ID";
  // Bahasa Arab untuk negara fala Arab — bukan default en-US yang bikin
  // angka terbalik arah baca di UI RTL.
  if (["BHD", "KWD", "OMR", "JOD", "TND", "SAR", "AED", "QAR"].includes(kode)) {
    return "ar-SA";
  }
  return "en-US";
}

/**
 * Format nominal sesuai mata uang tenant.
 *
 * Nilai bukan-finite dikembalikan sebagai tanda hubung, bukan "Rp 0" — nominal
 * yang belum diketahui tidak boleh terlihat seperti nol, karena nol di
 * pembukuan berarti "memang nol".
 */
export function formatUang(
  value: string | number,
  currency: string = MATA_UANG_DEFAULT,
): string {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return new Intl.NumberFormat(lokalitas(currency), {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: desimalMataUang(currency),
  }).format(numeric);
}

/**
 * Format nominal tanpa simbol mata uang — untuk kolom tabel yang headernya sudah
 * menyebut mata uangnya, atau teks yang butuh muat lebih banyak.
 */
export function formatAngka(
  value: string | number,
  currency: string = MATA_UANG_DEFAULT,
): string {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return new Intl.NumberFormat(lokalitas(currency), {
    minimumFractionDigits: 0,
    maximumFractionDigits: desimalMataUang(currency),
  }).format(numeric);
}
