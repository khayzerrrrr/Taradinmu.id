import type { PlanType } from "@/generated/prisma/client";
import { awalBulan } from "@/lib/periode";
import {
  ambilBatasFitur,
  ambilBatasJumlah,
  HARGA_PRO_BULAN,
  labelBatasJumlah,
  LIMIT_LABELS,
  planEfektif,
  type LimitFiturKey,
  type LimitJumlahKey,
  type LimitKey,
} from "@/lib/plan-limits";
import { formatRupiah } from "@/lib/format";
import { prisma } from "@/lib/prisma";

// Penjaga batas paket. Server-only (menyentuh database).
// Dipanggil Server Action SEBELUM membuat data, supaya tenant paket FREE tidak
// bisa melewati kuotanya lewat API.

type DasarLimit = {
  plan: PlanType;
  /** Jumlah data yang sudah ada (null untuk batas berbasis fitur). */
  used: number | null;
  /** Batas paket (null = tanpa batas / tidak berlaku). */
  limit: number | null;
};

export type LimitCheck =
  | ({ allowed: true } & DasarLimit)
  | ({
      allowed: false;
      /** Kode mesin agar UI bisa menampilkan ajakan upgrade. */
      code: "UPGRADE_REQUIRED";
      message: string;
    } & DasarLimit);

// Batas berbasis fitur dan berbasis jumlah memakai satu pola pesan: sebut apa
// yang OPEN setelah upgrade, bukan hanya bahwa aksesnya ditutup (PRD 4.D.3).
// Angka used/limit tetap ada agar UI bisa memakainya untuk hitungan.

/** Manfaat yang terbuka per kunci, untuk pesan penolakan server. */
const MANFAAT_LIMIT: Record<LimitKey, string> = {
  INVOICE:
    "invoice tanpa batas 50 per bulan, nomor tetap berurut, dan piutang terlacak untuk semua pelanggan",
  PRODUCT:
    "katalog lebih dari 100 item beserta varian, SKU, dan stok per varian",
  USERS:
    "tambah kasir/admin dengan akun sendiri supaya toko tetap jalan tanpa Anda berdiri di kasir",
  BATCH:
    "nomor batch & tanggal kedaluwarsa per pembelian, plus pengeluaran barang mengikuti FEFO",
  ZAKAT:
    "zakat ditarik otomatis dari invoice lunas dan riwayat pembayarannya tersimpan per periode",
  PROGRAM:
    "laporan biaya, tagihan, dan laba per kloter/proyek/tahun ajaran",
  HPP: "margin kotor dan laporan HPP per invoice",
  BRANDING:
    "logo dan warna tema toko Anda di seluruh aplikasi, termasuk pada invoice yang Anda kirim",
  // Sengaja tidak menjanjikan akses ke data tenant: PRD 4.D.2a masih menandai
  // AI sebagai SEBAGIAN, dan pesan server tidak boleh lebih berani dari modal.
  AI: "asisten chat khusus PRO di dalam aplikasi, untuk bertanya soal fitur dan alur kerja",
};

/** Kalimat penutup yang sama untuk semua kunci. Harga dari plan-limits, bukan diketik ulang. */
const AJAKAN_PRO = `Upgrade ke PRO (${formatRupiah(
  HARGA_PRO_BULAN,
)} per bulan) untuk membukanya.`;

// Pesan untuk batas berbasis jumlah: kuota saat ini disebut lebih dulu.
function pesanBatasJumlah(
  type: LimitJumlahKey,
  limit: number,
  used: number,
): string {
  return `Kuota paket Anda sudah terpakai ${used} dari ${limit} ${labelBatasJumlah(
    type,
  )}. Yang terbuka di PRO: ${MANFAAT_LIMIT[type]}. ${AJAKAN_PRO}`;
}

// Jumlah baris yang terpakai untuk batas berbasis jumlah. Dipisah dari
// checkLimit() supaya tinggal satu tempat yang tahu tabel mana yang dihitung.
async function terpakaiUntuk(
  tenantId: string,
  type: LimitJumlahKey,
): Promise<number> {
  switch (type) {
    case "INVOICE":
      // PRD 4.D: batas FREE adalah 50 invoice PER BULAN, bukan sepanjang waktu.
      // Dibatasi pada bulan berjalan supaya kuota bulan lalu tidak ikut terpakai.
      return prisma.invoice.count({
        where: { tenantId, createdAt: { gte: awalBulan() } },
      });
    case "PRODUCT":
      return prisma.product.count({ where: { tenantId } });
    case "USERS":
      return prisma.user.count({ where: { tenantId } });
  }
}

// Periksa apakah tenant masih boleh memakai sebuah fitur/data.
export async function checkLimit(
  tenantId: string,
  type: LimitKey,
): Promise<LimitCheck> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true, planExpiresAt: true, timezone: true },
  });
  if (!tenant) {
    // Pemanggil selalu memverifikasi tenant lebih dulu, jadi ini kondisi mustahil.
    throw new Error("Tenant tidak ditemukan saat memeriksa batas paket.");
  }

  // Yang ditegakkan adalah paket yang masih berlaku (PRD 4.D.4): masa PRO yang
  // sudah lewat membatasi penulisan data juga, bukan hanya tampilan menunya.
  // Satu-satunya tempat perhitungan itu dibuat adalah `planEfektif`.
  //
  // `timezone` ikut diteruskan (Fase 0.3): "sudah lewat atau belum" adalah
  // pertanyaan tentang hari penyewa, bukan hari server. Tanpa ini, tenant di
  // Riyadh akan kehilangan paketnya pada pagi yang masih menurut server UTC.
  const plan = planEfektif(
    tenant.plan,
    tenant.planExpiresAt,
    new Date(),
    tenant.timezone,
  );

  // --- Batas berbasis jumlah (invoice, produk, pengguna) ---
  if (type === "INVOICE" || type === "PRODUCT" || type === "USERS") {
    const limit = ambilBatasJumlah(plan, type);
    const used = await terpakaiUntuk(tenantId, type);

    if (limit === null || used < limit) {
      return { allowed: true, plan, used, limit };
    }
    return {
      allowed: false,
      plan,
      used,
      limit,
      code: "UPGRADE_REQUIRED",
      message: pesanBatasJumlah(type, limit, used),
    };
  }

  // --- Batas berbasis fitur ---
  // Baris di bawah ini yang menjaga kelengkapan daftar: sisa LimitKey setelah
  // tiga kunci jumlah di atas harus persis LimitFiturKey. Kalau ada kunci baru
  // masuk ke salah satu daftar tanpa ditangani cabangnya, yang gagal adalah
  // kompilasi — bukan angka yang salah dihitung diam-diam.
  const kunciFitur: LimitFiturKey = type;

  if (ambilBatasFitur(plan, kunciFitur)) {
    return { allowed: true, plan, used: null, limit: null };
  }
  return {
    allowed: false,
    plan,
    used: null,
    limit: null,
    code: "UPGRADE_REQUIRED",
    message: `${LIMIT_LABELS[kunciFitur]} tersedia pada paket PRO. Yang terbuka: ${
      MANFAAT_LIMIT[kunciFitur]
    }. ${AJAKAN_PRO}`,
  };
}
