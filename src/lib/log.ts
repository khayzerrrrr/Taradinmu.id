// Pencatatan error terpusat (PRD tidak menyebutnya; ROADMAP §4 P4 mencantumkannya
// sebagai syarat rilis: "Belum ada error tracking / logging terpusat").
//
// Sengaja sangat kecil dan TANPA dependensi baru. Setiap kejadian ditulis sebagai
// satu baris JSON ke stdout, yang sudah ditangkap PM2 di server (`pm2 logs`),
// sehingga bisa dibaca manusia dan mesin sekaligus. Bila kelak dipakai Sentry /
// Datadog / Loki, cukup ganti isi fungsi ini — 44 tempat pemanggil tidak ikut
// berubah. Pola "satu titik tukar" ini sama dengan src/lib/email.ts.
//
// BATAS YANG DISANGAJA: `error.message` dari Prisma/Postgres bisa memuat nilai
// kolom, karena itu pesan dipotong dan nilai bertanda rahasia disamarkan sebelum
// keluar. Jangan pernah menambahkan field `password`, token, atau isi sesi ke log.
//
// Batas yang perlu diketahui (diverifikasi di server produksi, bukan asumsi):
// penyamaran HANYA berlaku untuk baris yang ditulis modul ini. Next.js juga
// mencetak error mentah ke stdout dengan gaya `⨯ Error: ...` lewat logger-nya
// sendiri, dan itu tidak bisa disaring dari sini. Jadi log server memang masih
// bisa memuat nilai sensitif dari jalur Next — perlakukan berkas log (`pm2 logs`,
// `~/.pm2/logs`) sebagai data rahasia, dan jangan menyalinnya ke tiket/obrolan.

const PANJANG_MAX_PESAN = 500;
const PANJANG_MAX_STACK = 2000;

// Pola yang menandai nilai sensitif. Disamarkan di pesan MAUPUN stack, karena
// pesan Prisma/Postgres kerap menyisipkan nilai kolom ke dalam teks error.
//
// Batas yang disengaja: pola butuh pemisah `:` atau `=`, karena itulah bentuk
// keluaran driver ("password: abc", "api_key=abc"). Prosa bebas seperti
// "sandi salah" tidak ikut tersamar — jangan menaruh nilai rahasia dalam
// kalimat bebas saat membentuk error.
//
// Kata skema (`Bearer`/`Basic`) ikut dimakan: tanpa bagian itu,
// "Authorization: Bearer abc.def" hanya menyamarkan kata "Bearer" dan
// tokennya tetap terbaca di log.
const POLA_RAHASIA =
  /(password|passwd|sandi|secret|token|authorization|cookie|api[_-]?key)\s*[:=]\s*(?:(?:bearer|basic|token)\s+)?\S+/gi;

function samarkan(teks: string): string {
  return teks.replace(POLA_RAHASIA, "$1=[tersamar]");
}

function potong(teks: string, batas: number): string {
  const bersih = samarkan(teks).replace(/\s+/g, " ").trim();
  return bersih.length > batas ? `${bersih.slice(0, batas)}…` : bersih;
}

// Konteks tambahan yang boleh ikut tercatat. Sengaja sempit: tidak ada ruang
// untuk menyisipkan objek sembarang ke log.
export type KonteksLog = {
  /** Nama aksi atau rute, mis. "createInvoice". */
  aksi?: string;
  /** Id tenant bila sudah diketahui. BUKAN nama atau data usaha. */
  tenantId?: string;
  /**
   * `error.digest` dari Next.js: kunci korelasi antara pesan yang dilihat
   * pengguna dan baris di log server. Tanpa ini, laporan "halaman saya error"
   * tidak bisa ditelusuri ke baris log mana pun.
   */
  digest?: string;
  /**
   * Pelaku aksi, untuk jejak audit (mis. id Super Admin yang mereset kata sandi
   * orang lain). Id, bukan nama atau email.
   */
  aktorId?: string;
  /** Sasaran aksi, sepasang dengan `aktorId` (mis. id akun yang direset sandinya). */
  targetId?: string;
};

function baris(level: "error" | "warn", payload: Record<string, unknown>): void {
  const teks = JSON.stringify({ waktu: new Date().toISOString(), level, ...payload });
  if (level === "warn") console.warn(teks);
  else console.error(teks);
}

// Catat satu kegagalan. Dipanggil dari `pesanErrorUmum()` sehingga setiap
// catch block di Server Action otomatis tercakup tanpa mengubah call site-nya.
export function catatError(error: unknown, konteks?: KonteksLog): void {
  const dasar: Record<string, unknown> = { evt: "error", ...konteks };

  if (error instanceof Error) {
    baris("error", {
      ...dasar,
      nama: error.name,
      pesan: potong(error.message, PANJANG_MAX_PESAN),
      // Stack dipotong: yang panjang tidak berguna di log dan bisa memuat nilai.
      stack: error.stack ? potong(error.stack, PANJANG_MAX_STACK) : undefined,
    });
    return;
  }

  baris("error", {
    ...dasar,
    nama: "NonError",
    pesan: potong(String(error), PANJANG_MAX_PESAN),
  });
}

// Untuk kegagalan yang perlu ditangani tetapi tidak melempar Error,
// mis. penyedia email menolak permintaan atau kuota penuh.
export function catatPeringatan(pesan: string, konteks?: KonteksLog): void {
  baris("warn", { evt: "peringatan", pesan: potong(pesan, PANJANG_MAX_PESAN), ...konteks });
}
