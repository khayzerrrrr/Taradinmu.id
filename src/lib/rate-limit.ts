import { prisma } from "@/lib/prisma";

// Rate limit "fixed window" berbasis database (lihat model RateLimit).
//
// Dipakai untuk dua hal: menahan percobaan login berulang dan membatasi
// penyalahgunaan /api/chat. Sengaja tanpa dependensi baru — proyek ini belum
// punya Redis, dan penjaga di memori proses tidak berlaku di produksi yang
// berjalan di beberapa instance.

export type OpsiBatas = {
  /** Jumlah maksimum percobaan dalam satu jendela. */
  max: number;
  /** Panjang jendela dalam milidetik. */
  windowMs: number;
};

export type HasilBatas = {
  allowed: boolean;
  /** Sisa percobaan pada jendela berjalan (tidak pernah negatif). */
  remaining: number;
  /** Kapan hitungan direset (awal jendela berikutnya). */
  resetAt: Date;
};

// Ambang batas semua pemakaian, dikumpulkan di sini supaya mudah disetel ulang
// dan tidak ada dua angka berbeda untuk hal yang sama.
//
// Login dibatasi dua kali: per alamat email (menahan tebak-tebakan pada satu
// akun meskipun header IP dipalsukan) dan per IP (menahan percobaan menyebar).
export const BATAS_LOGIN_EMAIL: OpsiBatas = { max: 10, windowMs: 15 * 60 * 1000 };
export const BATAS_LOGIN_IP: OpsiBatas = { max: 30, windowMs: 15 * 60 * 1000 };
export const BATAS_CHAT: OpsiBatas = { max: 20, windowMs: 5 * 60 * 1000 };
/** Permintaan tautan reset sandi — dibatasi agar tidak dipakai membanjiri email. */
export const BATAS_RESET: OpsiBatas = { max: 3, windowMs: 15 * 60 * 1000 };

const RETENSI_MS = 24 * 60 * 60 * 1000; // baris lebih tua dari ini sudah tidak berguna
const PELUANG_BERSIH = 0.02; // 1 dari ~50 pemanggilan, agar tidak menambah query tiap request

function hitungJendela(windowMs: number, sekarang: number) {
  const windowStart = new Date(Math.floor(sekarang / windowMs) * windowMs);
  return { windowStart, resetAt: new Date(windowStart.getTime() + windowMs) };
}

/**
 * Bersihkan baris kedaluwarsa sesekali. Proyek ini tidak punya penjadwal, jadi
 * pembersihan dititipkan pada pemanggilan biasa dengan peluang kecil supaya
 * tabel tidak tumbuh tanpa batas tanpa membebani setiap request.
 */
async function bersihkanSesekali(sekarang: number): Promise<void> {
  if (Math.random() >= PELUANG_BERSIH) return;
  try {
    await prisma.rateLimit.deleteMany({
      where: { windowStart: { lt: new Date(sekarang - RETENSI_MS) } },
    });
  } catch {
    // Pembersihan bersifat optimisasi; kegagalannya tidak boleh mengganggu login.
  }
}

/**
 * Menambah hitungan lalu mengembalikan status batas. Ini yang dipakai untuk
 * penegakan, dan sengaja dibiarkan di satu tempat agar tidak ada dua aturan.
 */
export async function periksaBatas(
  key: string,
  opsi: OpsiBatas,
): Promise<HasilBatas> {
  const sekarang = Date.now();
  const { windowStart, resetAt } = hitungJendela(opsi.windowMs, sekarang);

  let terpakai: number;
  try {
    const baris = await prisma.rateLimit.upsert({
      where: { key_windowStart: { key, windowStart } },
      create: { key, windowStart, count: 1 },
      update: { count: { increment: 1 } },
      select: { count: true },
    });
    terpakai = baris.count;
  } catch {
    // Gagal-terbuka disengaja: satu-satunya cara blokir ini berguna adalah bila
    // database hidup, dan pada kondisi itu `authorize()` juga sedang membaca
    // tabel User. Bila database mati, login sudah pasti gagal tanpa kita,
    // sehingga menolak di sini hanya akan menyulitkan pengguna sah.
    return { allowed: true, remaining: opsi.max, resetAt };
  }

  await bersihkanSesekali(sekarang);

  return {
    allowed: terpakai <= opsi.max,
    remaining: Math.max(0, opsi.max - terpakai),
    resetAt,
  };
}

/**
 * Hanya membaca hitungan tanpa menambah. Dipakai UI untuk memberi pesan yang
 * ramah ("tunggu beberapa saat") tanpa ikut memakan kuota percobaan.
 */
export async function lihatBatas(
  key: string,
  opsi: OpsiBatas,
): Promise<HasilBatas> {
  const sekarang = Date.now();
  const { windowStart, resetAt } = hitungJendela(opsi.windowMs, sekarang);

  try {
    const baris = await prisma.rateLimit.findUnique({
      where: { key_windowStart: { key, windowStart } },
      select: { count: true },
    });
    const terpakai = baris?.count ?? 0;
    return {
      allowed: terpakai < opsi.max,
      remaining: Math.max(0, opsi.max - terpakai),
      resetAt,
    };
  } catch {
    return { allowed: true, remaining: opsi.max, resetAt };
  }
}

/**
 * Alamat IP pemanggil dari header proxy.
 *
 * Catatan penting: `x-forwarded-for` hanya dapat dipercaya bila diisi oleh proxy
 * tepercaya (di Vercel, platform yang mengisinya dan menimpa nilai dari klien).
 * Karena itu pembatasan login TIDAK hanya bergantung pada IP — lihat
 * pemakaiannya di auth.config.ts yang juga membatasi per alamat email.
 */
export function ipPemanggil(request: Request): string {
  const diteruskan = request.headers.get("x-forwarded-for");
  const pertama = diteruskan?.split(",")[0]?.trim();
  if (pertama) return pertama;
  return request.headers.get("x-real-ip")?.trim() || "tidak-diketahui";
}
