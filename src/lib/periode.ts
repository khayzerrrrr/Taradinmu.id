// Batas periode bulanan (UTC).
//
// Perhitungan "awal bulan" sebelumnya disalin apa adanya di tiga tempat
// (dashboard-summary, zakat-actions, expense-actions). Disatukan di sini supaya
// kuota bulanan, laporan keuangan, dan riwayat zakat selalu memakai batas yang
// sama — selisih satu jam saja bisa membuat angka antar halaman berbeda.
//
// Konvensi proyek: semua cap waktu diperlakukan sebagai UTC, dan awal bulan
// dihitung dengan Date.UTC(tahun, bulan, 1).

/** Awal bulan dari sebuah tanggal (default: sekarang), pada tengah malam UTC. */
export function awalBulan(tanggal: Date = new Date()): Date {
  return new Date(Date.UTC(tanggal.getUTCFullYear(), tanggal.getUTCMonth(), 1));
}

/** Tahun & bulan (1–12) dari sebuah tanggal, dalam UTC. */
export function periodeDari(tanggal: Date = new Date()): {
  tahun: number;
  bulan: number;
} {
  return { tahun: tanggal.getUTCFullYear(), bulan: tanggal.getUTCMonth() + 1 };
}

/** Label periode "YYYY-MM" (UTC) — dipakai untuk penamaan dan pengelompokan. */
export function labelPeriode(tanggal: Date = new Date()): string {
  const { tahun, bulan } = periodeDari(tanggal);
  return `${tahun}-${String(bulan).padStart(2, "0")}`;
}

/** Label periode ramah-baca "MM/YYYY", mis. "09/2026". */
export function labelPeriodeBulanan(tanggal: Date = new Date()): string {
  const { tahun, bulan } = periodeDari(tanggal);
  return `${String(bulan).padStart(2, "0")}/${tahun}`;
}
