// Zona waktu usaha (Fase 0.3).
//
// Semua perhitungan bisnis harus menanyakan "hari berapa, menurut zona usaha ini",
// bukan "hari berapa menurut server". Selisih satu hari sudah terbukti berbahaya:
// pada server UTC, pukul 07:00-13:59 WIB adalah masih "kemarin", sehingga
// "sisa 4 hari" terbaca "sisa 5 hari" setiap pagi -- dan angka itu dipakai Super
// Admin memutuskan kapan menagih perpanjangan.
//
// Fungsi-fungsi di sini MURNI (tanpa Prisma, tanpa Date.now()) supaya bisa diuji
// pada titik waktu yang ditentukan, termasuk titik yang persis di batas tengah
// malam pada zona berbeda.

/**
 * Zona bawaan untuk tenant yang belum punya `timezone` terisi.
 *
 * Pilihan ini jatuh ke WIB karena seluruh pengguna yang ada saat kolom ini
 * diperkenalkan berada di Indonesia -- dan karena zona tanpa musim panas, sehingga
 * offset tetap +7 sepanjang tahun. Jangan dipakai sebagai default "universal".
 */
export const ZONA_DEFAULT = "Asia/Jakarta";

export const SATU_HARI_MS = 24 * 60 * 60 * 1000;

/**
 * Cache offset per (zona, bulan UTC).
 *
 * Kuncinya WAJIB memuat bulan: offset zona yang punya daylight saving berubah
 * beberapa kali setahun, jadi cache per zona saja mengembalikan offset musim
 * dingin untuk bulan musim panas -- dan itu persis kelas bug yang harus dihindari
 * fungsi ini. Bulanan cukup kasar untuk kebutuhan ini, karena perubahan DST
 * selalu terjadi di pergantian bulan.
 */
const cacheOffset = new Map<string, number>();

/**
 * Offset zona dalam milidetik dari UTC, pada titik waktu tertentu.
 *
 * Memakai `Intl` dengan `timeZone` alih-alih tabel offset manual, karena offset
 * tetap (+7) benar untuk Jakarta tapi salah untuk London pada Musim Panas dan
 * salah untuk Riyadh yang tidak punya DST sama sekali. Beberapa jam sudah cukup
 * untuk menggeser nomor hari.
 *
 * Zona yang tidak dikenal `Intl` kembali ke offset 0. Melempar error di halaman
 * yang sedang dibuka pengguna tidak sebanding dengan satu hari yang mungkin
 * meleset pada data yang jarang dibaca.
 */
export function offsetZonaMs(titik: Date, timeZone: string): number {
  const kunci = `${timeZone}|${titik.getUTCFullYear()}-${titik.getUTCMonth()}`;
  const adaDiCache = cacheOffset.get(kunci);
  if (adaDiCache !== undefined) return adaDiCache;

  let offset: number;
  try {
    offset = hitungOffset(titik, timeZone);
  } catch {
    offset = 0;
  }
  cacheOffset.set(kunci, offset);
  return offset;
}

/**
 * Menghitung offset dengan membaca tanggal di zona itu lalu membandingkannya
 * dengan bacaan UTC pada titik yang sama.
 *
 * Hasilnya offset yang benar untuk zona itu PADA TITIK ITU -- termasuk saat DST
 * sedang berlaku.
 */
function hitungOffset(titik: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const bagian = dtf.formatToParts(titik);
  const ambil = (jenis: string): number =>
    Number(bagian.find((b) => b.type === jenis)?.value ?? "0");
  // hourCycle bisa menulis "24" untuk tengah malam; normalkan ke 0 supaya
  // tengah malam tidak terhitung sebagai hari berikutnya.
  const jam = ambil("hour") % 24;
  return (
    Date.UTC(
      ambil("year"),
      ambil("month") - 1,
      ambil("day"),
      jam,
      ambil("minute"),
      ambil("second"),
    ) -
    // Milidetik dibuang: formatToParts hanya sampai detik, sementara `titik`
    // bisa punya milidetik -- selisihnya akan terbaca sebagai bagian offset.
    (titik.getTime() - titik.getMilliseconds())
  );
}

/** Bagian tanggal (tahun/bulan/hari) yang dibaca di zona tertentu. */
function tanggalDiZona(
  titik: Date,
  timeZone: string,
): { tahun: number; bulan: number; hari: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const bagian = dtf.formatToParts(titik);
  const ambil = (jenis: string): number =>
    Number(bagian.find((b) => b.type === jenis)?.value ?? "0");
  return {
    tahun: ambil("year"),
    bulan: ambil("month"),
    hari: ambil("day"),
  };
}

/**
 * Nomor hari kalender menurut zona usaha, sebagai epoch UTC tengah malam.
 *
 * Mengembalikan angka (bukan Date) karena yang dibutuhkan adalah perbandingan
 * hari. Dua titik di zona berbeda bisa jatuh pada nomor hari yang berbeda meski
 * jaraknya belasan jam -- itulah yang membuat hitungan berbasis "hari UTC" salah.
 */
export function nomorHari(
  titik: Date,
  timeZone: string = ZONA_DEFAULT,
): number {
  const { tahun, bulan, hari } = tanggalDiZona(titik, timeZone);
  return Date.UTC(tahun, bulan - 1, hari);
}

/** Awal hari menurut zona usaha, sebagai epoch UTC -- untuk filter database. */
export function awalHariZona(
  titik: Date,
  timeZone: string = ZONA_DEFAULT,
): Date {
  return new Date(nomorHari(titik, timeZone));
}

/**
 * Akhir hari secara INKLUSIF: "berlaku sampai 5 Okt" melayani sampai 5 Okt
 * 23:59:59.999 menurut zona usaha.
 *
 * `hariUtcTengahMalam` adalah KALENDER, bukan momen: admin mengetik "9 Okt" dan
 * sistem menyimpannya sebagai 9 Okt 00:00 UTC. Batas akhirnya dihitung dengan
 * mundur sebesar offset zona, sebab tengah malam UTC untuk tanggal yang sama
 * berada SEBELUM tengah malam lokal.
 *
 * Dikembalikan sebagai epoch ms satu milidetik sebelum tengah malam lokal hari
 * berikutnya. Perbandingan "belum lewat" memakai `>=` terhadap nilai ini.
 *
 * Batas yang diterima: offset dihitung pada tengah malam UTC tanggal itu, bukan
 * pada tengah malam lokal. Pada hari pergantian DST perbedaannya satu jam. Ini
 * belum pernah terjadi di zona tanpa DST (Indonesia, Arab Saudi), dan pengaruhnya
 * hanya satu hari dalam setahun -- jauh lebih kecil daripada kesalahan memakai
 * offset tetap, yang salah sepanjang setengah tahun.
 */
export function akhirHariZona(
  hariUtcTengahMalam: Date,
  timeZone: string = ZONA_DEFAULT,
): number {
  return (
    nomorHariUTC(hariUtcTengahMalam) +
    SATU_HARI_MS -
    offsetZonaMs(hariUtcTengahMalam, timeZone) -
    1
  );
}

/** Epoch UTC tengah malam dari bagian tanggal UTC -- dipakai "hari" apa adanya. */
function nomorHariUTC(tanggal: Date): number {
  return Date.UTC(
    tanggal.getUTCFullYear(),
    tanggal.getUTCMonth(),
    tanggal.getUTCDate(),
  );
}

/** Apakah `zona` dikenal oleh runtime. Berguna untuk validasi input form. */
export function zonaValid(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}
