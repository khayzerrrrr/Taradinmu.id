// Jurnal otomatis dari dokumen operasional (Fase 1, PRD 4 butir F1.8).
//
// SEMUA fungsi di sini IDEMPOTEN: kalau jurnal untuk dokumen yang sama sudah
// ada, fungsi mengembalikan jurnal itu dan tidak membuat yang baru.
//
// Kenapa idempotensi itu wajib, bukan sekadar rapi:
//   Server Action bisa dijalankan dua kali untuk aksi yang sama pengguna klik
// Kenapa idempotensi itu wajib, bukan sekadar rapi:
//   idempotensi, klik ganda membukukan penjualan dua kali — dan karena tabelnya
//   append-only, salahnya tidak bisa dihapus tanpa jurnal pembalik yang menambah
//   kekacauan.
//
//   Idempotensi juga yang membuat "dual-write" aman: F1.8 menulis journal
//   bersamaan dengan invoice, dan F1.10 nanti memindahkan dashboard ke journal.
//   Selama keduanya hidup, angka yang sama dihitung dua kali — dan hasilnya harus
//   sama. Kalau tidak, perpindahan diam-diam mengubah angka pengguna.
//
// CARA KERJA idempotensi: `JournalEntry` punya `refType` + `refId`. Sebelum
// membuat, dicek apakah sudah ada baris untuk (refType, refId, source). Race
// antar dua permintaan yang benar-benar bersamaan tetap mungkin, dan itu
// ditutup oleh constraint unik di level database pada faktor berikutnya.

import { prisma } from "@/lib/prisma";
import {
  jurnalDariInvoice,
  jurnalDariPembayaran,
  jurnalDariPengeluaran,
  jurnalHppTerjual,
  type HasilRacik,
} from "@/modules/accounting/engine-jurnal";
import { jurnalAktifId } from "@/modules/accounting/jurnal-aktif";
import {
  batalkanJurnal,
  simpanJurnal,
  type HasilPosting,
} from "@/modules/accounting/jurnal-actions";

/** Sumber jurnal, mengikuti enum `JournalSource` di database. */
type SumberJurnal = "INVOICE" | "PAYMENT" | "STOCK" | "EXPENSE" | "MANUAL";

/** Kunci unik satu jurnal: dokumen + jenis jurnal. */
function kunciJurnal(
  refType: string,
  refId: string,
  source: SumberJurnal,
): { refType: string; refId: string; source: SumberJurnal } {
  return { refType, refId, source };
}

async function sudahAda(
  tenantId: string,
  kunci: { refType: string; refId: string; source: SumberJurnal },
): Promise<string | null> {
  // "Ada" harus berarti "MASIH AKTIF". Dokumentasi yang boleh dibatalkan lalu
  // dibuat ulang (mis. pengeluaran yang disunting) meninggalkan jurnal LAMA yang
  // sudah dibalik tetapi tetap menyandang kunci (refType, refId, source) yang
  // sama. Kalau yang dibalik dianggap "sudah ada", dokumen yang dibuat ulang
  // tidak akan pernah menghasilkan jurnal — dan pembukuan diam-diam kehilangan
  // satu beban. Logikanya di `jurnal-aktif.ts` supaya bisa dibuktikan tanpa sesi.
  return jurnalAktifId(tenantId, kunci);
}

/**
 * Menyimpan jurnal kalau belum ada.
 *
 * Mengembalikan jurnal yang LAMA kalau sudah ada -- pemanggil tidak perlu tahu
 * mana yang baru; yang penting tidak ada duplikat.
 */
async function simpanJurnalIdempoten(
  tenantId: string,
  kunci: { refType: string; refId: string; source: SumberJurnal },
  racik: () => HasilRacik,
  currency: string,
): Promise<HasilPosting> {
  const lama = await sudahAda(tenantId, kunci);
  if (lama) return { ok: true, journalId: lama };

  const hasil = racik();
  if (!hasil.ok) {
    return { ok: false, alasan: hasil.alasan, code: "JURNAL_GAGAL_RACIK" };
  }
  return simpanJurnal(tenantId, hasil.jurnal, currency);
}

/**
 * Jurnal pengakuan pendapatan saat invoice diterbitkan (tidak lagi DRAFT).
 *
 * Dipanggil saat status berubah menjadi SENT atau PAID. DRAFT tidak menghasilkan
 * jurnal: selama faktur masih bisa diubah, pengakuan pendapatan belum terjadi --
 * recognize revenue on a draft invoice membuat angka berubah-ubah setiap kali
 * pengguna menyunting.
 */
export async function jurnalPendapatanInvoice(input: {
  tenantId: string;
  currency: string;
  invoiceId: string;
  invoiceNumber: string;
  totalAmount: number;
  /** Bagian jasa. Default 0 = semua dianggap barang. */
  subtotal?: number;
  tanggal: Date;
}): Promise<HasilPosting> {
  return simpanJurnalIdempoten(
    input.tenantId,
    kunciJurnal("invoice", input.invoiceId, "INVOICE"),
    () =>
      jurnalDariInvoice({
        businessDate: input.tanggal,
        invoiceNumber: input.invoiceNumber,
        invoiceId: input.invoiceId,
        totalAmount: input.totalAmount,
        ...(input.subtotal === undefined ? {} : { subtotal: input.subtotal }),
      }),
    input.currency,
  );
}

/**
 * Membatalkan jurnal AKTIF milik sebuah dokumen, kalau ada.
 *
 * Dipakai saat dokumen operasional diubah atau dihapus. Jurnal lama tidak
 * diubah dan tidak dihapus — ia dibalik oleh jurnal pembalik, lalu (untuk
 * perubahan) jurnal baru dibuat dari nilai yang baru. Dengan begitu riwayat
 * pembukuan tetap utuh, dan `rekonsiliasi.ts` bisa mendeteksi kalau dokumen
 * operasional berubah tanpa jurnal pasangannya ikut berubah.
 *
 * Mengembalikan `ok: true` tanpa `journalId` kalau memang tidak ada jurnal aktif
 * — itu bukan kegagalan, hanya berarti dokumennya belum pernah dijurnal (mis.
 * kategori PURCHASE, atau jurnal pembuatan yang dulu gagal).
 */
export async function batalkanJurnalDokumen(input: {
  tenantId: string;
  refType: string;
  refId: string;
  source: SumberJurnal;
  tanggal: Date;
}): Promise<HasilPosting> {
  const aktif = await sudahAda(input.tenantId, {
    refType: input.refType,
    refId: input.refId,
    source: input.source,
  });
  if (!aktif) return { ok: true };
  return batalkanJurnal(input.tenantId, aktif, input.tanggal);
}
export async function jurnalPembayaranInvoice(input: {
  tenantId: string;
  currency: string;
  invoiceId: string;
  invoiceNumber: string;
  totalAmount: number;
  lewatBank?: boolean;
  tanggal: Date;
}): Promise<HasilPosting> {
  return simpanJurnalIdempoten(
    input.tenantId,
    kunciJurnal("invoice", input.invoiceId, "PAYMENT"),
    () =>
      jurnalDariPembayaran({
        businessDate: input.tanggal,
        invoiceNumber: input.invoiceNumber,
        invoiceId: input.invoiceId,
        totalAmount: input.totalAmount,
        ...(input.lewatBank ? { lewatBank: true } : {}),
      }),
    input.currency,
  );
}

/**
 * Jurnal HPP saat barang keluar untuk invoice yang SUDAH LUNAS.
 *
 * Hanya untuk invoice PAID. HPP diakui bersama pendapatan (dasar akrual yang
 * sama), bukan saat DRAFT — kalau tidak, satu invoice draft langsung memotong
 * laba sebesar seluruh modalnya (PRD 4.G.3).
 */
export async function jurnalHppInvoice(input: {
  tenantId: string;
  currency: string;
  invoiceId: string;
  invoiceNumber: string;
  hpp: number;
  tanggal: Date;
}): Promise<HasilPosting> {
  // HPP nol TIDAK menghasilkan jurnal sama sekali; `ok: true` tanpa journalId
  // berarti "sengaja tidak ada", yang berbeda dari "gagal". Tanpa itu, jurnal
  // HPP gagal hanya karena barangnya belum punya modal -- dan itu akan ikut
  // menggagalkan pengakuan pendapatan (kasus invoice jasa, dan kasus stok yang
  // modalnya belum diisi).
  if (input.hpp <= 0) return { ok: true };

  return simpanJurnalIdempoten(
    input.tenantId,
    kunciJurnal("invoice", input.invoiceId, "STOCK"),
    () => {
      const hasil = jurnalHppTerjual({
        businessDate: input.tanggal,
        reference: input.invoiceNumber,
        refId: input.invoiceId,
        hpp: input.hpp,
      });
      // `null` berarti HPP nol, dan pemanggil sudah screened itu sebelum
      // sampai sini. Kalau sampai sini berarti callers berubah -- dan itu
      // kegagalan diam yang paling berbahaya, jadi ia dilempar, bukan
      // diteruskan sebagai jurnal kosong.
      if (!hasil) {
        return { ok: false, alasan: "HPP nol seharusnya tidak menghasilkan jurnal." };
      }
      return hasil;
    },
    input.currency,
  );
}

/**
 * Jurnal pengeluaran operasional.
 *
 * Kategori `PURCHASE` DITOLAK di sini, bukan diteruskan: pembelian stok punya
 * jalurnya sendiri (`jurnalPembelianStok`) karena masuk aset, bukan beban.
 */
export async function jurnalPengeluaran(input: {
  tenantId: string;
  currency: string;
  expenseId: string;
  reference: string;
  amount: number;
  kategori:
    | "OPERATIONAL"
    | "PURCHASE"
    | "SALARY"
    | "RENT"
    | "UTILITIES"
    | "MARKETING"
    | "TAX"
    | "OTHER";
  lewatBank?: boolean;
  tanggal: Date;
}): Promise<HasilPosting> {
  return simpanJurnalIdempoten(
    input.tenantId,
    kunciJurnal("expense", input.expenseId, "EXPENSE"),
    () =>
      jurnalDariPengeluaran({
        businessDate: input.tanggal,
        reference: input.reference,
        refId: input.expenseId,
        nominal: input.amount,
        kategori: input.kategori,
        ...(input.lewatBank ? { lewatBank: true } : {}),
      }),
    input.currency,
  );
}
