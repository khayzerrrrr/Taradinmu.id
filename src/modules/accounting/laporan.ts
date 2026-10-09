// Penyusun laporan keuangan dari journal (Fase 1, PRD 4 butir F1.11).
//
// SEMUA angka di sini dibaca dari `Posting`. Tidak ada satu pun agregat dari
// Invoice atau Expense -- di situlah akhir dari dual-write, dan sumber kebenaran
// berpindah ke sini.
//
// Aritmetikanya ada di `laporan-murni.ts`, bukan di sini. Alasannya: bagian
// aritmetika bisa diuji dengan angka yang diketahui tanpa menyiapkan journal di
// database, sedangkan bagian query diuji dengan journal sungguhan. Kalau keduanya
// bercampur, tes database yang salah bisa menutupi kesalahan aritmetika.
//
// CATATAN PAJAK YANG HARUS DIJAWAB: laporan ini TIDAK memisahkan pajak dari
// pendapatan. `Invoice.taxAmount` ikut terhitung sebagai pendapatan sampai modul
// pajak (Fase 4) memecahnya jadi Utang Pajak. Untuk perhitungan pajak resmi,
// angka pada laporan ini belum boleh dipakai.

import { prisma } from "@/lib/prisma";
import { KODE_AKUN } from "./coa";
import {
  ambil,
  batasPeriode,
  bulat,
  hitungArusKas,
  hitungLabaRugi,
  hitungNeraca,
  periodeLaporan,
  type LabaRugi,
  type Neraca,
  type PeriodeLaporan,
  type Saldo,
} from "./laporan-murni";

export {
  batasPeriode,
  bulat,
  hitungArusKas,
  hitungLabaRugi,
  hitungNeraca,
} from "./laporan-murni";
export type { PeriodeLaporan } from "./laporan-murni";

export type NamaLaporan =
  | "NERACA"
  | "LABA_RUGI"
  | "ARUS_KAS"
  | "BUKU_BESAR"
  | "PERCOBAAN_BALANCE";

export const LAPORAN_TERSEDIA: readonly NamaLaporan[] = [
  "NERACA",
  "LABA_RUGI",
  "ARUS_KAS",
  "BUKU_BESAR",
  "PERCOBAAN_BALANCE",
];

export type BarisLaporan = { label: string; nilai: number; tebal?: boolean };
export type Laporan = {
  periode: PeriodeLaporan;
  baris: BarisLaporan[];
  total: { label: string; nilai: number } | null;
};

/**
 * Saldo seluruh akun dalam satu rentang tanggal, bentuk BERSIH:
 * positif = debit, negatif = kredit.
 */
async function saldoPeriode(tenantId: string, dari: Date, sampai: Date): Promise<Saldo> {
  const posting = await prisma.posting.findMany({
    where: { journal: { tenantId, businessDate: { gte: dari, lt: sampai } } },
    select: { side: true, amount: true, account: { select: { code: true } } },
  });
  const hasil: Saldo = new Map();
  for (const p of posting) {
    const n = Number(p.amount);
    hasil.set(p.account.code, (hasil.get(p.account.code) ?? 0) + (p.side === "DEBIT" ? n : -n));
  }
  return hasil;
}

/**
 * Saldo kumulatif SEJAK awal sampai satu batas tanggal.
 *
 * Neraca berbeda dari laba rugi: neraca ada di titik waktu, laba rugi untuk satu
 * periode. Menggabungkan keduanya membuat neraca hanya bergerak di bulan yang
 * sedang berjalan, dan aset yang dibeli tahun lalu menghilang dari laporan.
 */
async function saldoKumulatif(tenantId: string, sampai: Date): Promise<Saldo> {
  const posting = await prisma.posting.findMany({
    where: { journal: { tenantId, businessDate: { lt: sampai } } },
    select: { side: true, amount: true, account: { select: { code: true } } },
  });
  const hasil: Saldo = new Map();
  for (const p of posting) {
    const n = Number(p.amount);
    hasil.set(p.account.code, (hasil.get(p.account.code) ?? 0) + (p.side === "DEBIT" ? n : -n));
  }
  return hasil;
}

/**
 * GERAKAN kas: berapa masuk, berapa keluar, dari sisi posting.
 *
 * Saldo bersih tidak bisa dipakai untuk arus kas: satu angka tidak tahu apakah
 * uang masuk atau uang keluar. Lihat `hitungArusKas` di `laporan-murni.ts`.
 */
async function gerakKas(tenantId: string, dari: Date, sampai: Date) {
  const posting = await prisma.posting.findMany({
    where: {
      journal: { tenantId, businessDate: { gte: dari, lt: sampai } },
      account: { code: { in: [KODE_AKUN.kas, KODE_AKUN.bank] } },
    },
    select: { side: true, amount: true },
  });
  let masuk = 0;
  let keluar = 0;
  for (const p of posting) {
    const n = Number(p.amount);
    if (p.side === "DEBIT") masuk += n;
    else keluar += n;
  }
  return { masuk, keluar };
}

const SPASI: BarisLaporan = { label: "", nilai: 0 };

/** Baris opsional: disembunyikan bila nol, kecuali ditandai wajib. */
function baris(
  label: string,
  nilai: number,
  { wajib = false, tebal = false } = {},
): BarisLaporan | null {
  if (nilai === 0 && !wajib) return null;
  return { label, nilai: bulat(nilai), tebal };
}

/** Baris wajib: selalu tampil walau nol. Judul dan subtotal tidak boleh hilang. */
function wajib(label: string, nilai: number, tebal = false): BarisLaporan {
  return { label, nilai: bulat(nilai), tebal };
}

/** Tampilkan opsional, atau baris wajib dengan nilai 0. */
function atauKosong(b: BarisLaporan | null, label: string): BarisLaporan {
  return b ?? wajib(label, 0);
}

function barisLabaRugi(lr: LabaRugi, sal: Saldo): BarisLaporan[] {
  return [
    wajib("PENDAPATAN", lr.pendapatan, true),
    atauKosong(
      baris("Penjualan Barang", -ambil(sal, KODE_AKUN.pendapatanPenjualan)),
      "Penjualan Barang",
    ),
    atauKosong(baris("Pendapatan Jasa", -ambil(sal, KODE_AKUN.pendapatanJasa)), "Pendapatan Jasa"),
    wajib("Harga Pokok Penjualan", -lr.hpp),
    wajib("Laba Kotor", lr.labaKotor, true),
    SPASI,
    wajib("BEBAN OPERASIONAL", -lr.bebanOperasional, true),
    atauKosong(baris("Beban Gaji", -ambil(sal, KODE_AKUN.bebanGaji)), "Beban Gaji"),
    atauKosong(baris("Beban Sewa", -ambil(sal, KODE_AKUN.bebanSewa)), "Beban Sewa"),
    atauKosong(baris("Beban Utilitas", -ambil(sal, KODE_AKUN.bebanUtilitas)), "Beban Utilitas"),
    atauKosong(
      baris("Beban Pemasaran", -ambil(sal, KODE_AKUN.bebanPemasaran)),
      "Beban Pemasaran",
    ),
    atauKosong(baris("Beban Lain-lain", -ambil(sal, KODE_AKUN.bebanLain)), "Beban Lain-lain"),
    SPASI,
    wajib("LABA BERSIH", lr.labaBersih, true),
  ];
}

function barisNeraca(n: Neraca): BarisLaporan[] {
  return [
    wajib("ASET", n.aset, true),
    atauKosong(baris("Kas", n.kas), "Kas"),
    atauKosong(baris("Bank", n.bank), "Bank"),
    atauKosong(baris("Piutang Usaha", n.piutang), "Piutang Usaha"),
    atauKosong(baris("Persediaan", n.persediaan), "Persediaan"),
    wajib("Jumlah Aset", n.aset, true),
    SPASI,
    wajib("LIABILITAS", n.liabilitas, true),
    atauKosong(baris("Utang Usaha", n.utang), "Utang Usaha"),
    // Hampir selalu kosong. Begitu terisi lalu disembunyikan, neraca terlihat
    // rusak tanpa alasan yang bisa ditunjukkan.
    atauKosong(baris("Uang Muka Pelanggan", n.uangMuka), "Uang Muka Pelanggan"),
    wajib("Jumlah Liabilitas", n.liabilitas, true),
    SPASI,
    wajib("MODAL", n.modal, true),
    atauKosong(baris("Modal Disetor", n.modalDisetor), "Modal Disetor"),
    atauKosong(baris("Laba Ditahan", n.labaDitahan), "Laba Ditahan"),
    atauKosong(baris("Laba Berjalan", n.labaBerjalan), "Laba Berjalan"),
    wajib("Jumlah Modal", n.modal, true),
    SPASI,
    wajib("JUMLAH LIABILITAS + MODAL", bulat(n.liabilitas + n.modal), true),
  ];
}

export async function buatLaporan(
  tenantId: string,
  nama: NamaLaporan,
  periode: string,
): Promise<Laporan> {
  const { dari, sampai } = batasPeriode(periode);
  switch (nama) {
    case "NERACA":
      return neraca(tenantId, dari, sampai);
    case "LABA_RUGI":
      return labaRugi(tenantId, dari, sampai);
    case "ARUS_KAS":
      return arusKas(tenantId, dari, sampai);
    case "BUKU_BESAR":
      return bukuBesar(tenantId, dari, sampai);
    case "PERCOBAAN_BALANCE":
      return percobaanBalance(tenantId, dari, sampai);
  }
}

async function neraca(tenantId: string, dari: Date, sampai: Date): Promise<Laporan> {
  const kumulatif = await saldoKumulatif(tenantId, sampai);
  const n = hitungNeraca(kumulatif);
  return {
    periode: periodeLaporan(dari, sampai),
    baris: barisNeraca(n),
    total: { label: "Jumlah Liabilitas + Modal", nilai: bulat(n.liabilitas + n.modal) },
  };
}

async function labaRugi(tenantId: string, dari: Date, sampai: Date): Promise<Laporan> {
  const sal = await saldoPeriode(tenantId, dari, sampai);
  const lr = hitungLabaRugi(sal);
  return {
    periode: periodeLaporan(dari, sampai),
    baris: barisLabaRugi(lr, sal),
    total: { label: "Laba Bersih", nilai: lr.labaBersih },
  };
}

/**
 * Arus Kas, activity langsung: OPERASI / INVESTASI / PENDANAAN.
 *
 * Keterbatasan yang harus jujur: ini BUKAN rekonsiliasi bank. Saldo kas bank
 * yang sebenarnya -- termasuk uang yang belum masuk ke aplikasi -- tidak
 * diketahui oleh sistem ini, dan laporan ini tidak berpura-pura mengetahuinya.
 */
async function arusKas(tenantId: string, dari: Date, sampai: Date): Promise<Laporan> {
  const gerak = await gerakKas(tenantId, dari, sampai);
  const sebelum = await saldoKumulatif(tenantId, dari);
  const akhir = await saldoKumulatif(tenantId, sampai);
  const saldoAwal = bulat(ambil(sebelum, KODE_AKUN.kas) + ambil(sebelum, KODE_AKUN.bank));
  const saldoAkhir = bulat(ambil(akhir, KODE_AKUN.kas) + ambil(akhir, KODE_AKUN.bank));
  const hasil = hitungArusKas(gerak, saldoAwal, saldoAkhir);

  return {
    periode: periodeLaporan(dari, sampai),
    baris: [
      wajib("AKTIVITAS OPERASI", hasil.kenaikanKas, true),
      atauKosong(baris("Kas masuk", hasil.kasMasuk), "Kas masuk"),
      atauKosong(baris("Kas keluar", -hasil.kasKeluar), "Kas keluar"),
      wajib("Kenaikan kas bersih dari operasi", hasil.kenaikanKas, true),
      SPASI,
      wajib("AKTIVITAS INVESTASI", 0, true),
      wajib("Belum ada akun aset tetap atau investasi (Fase 1)", 0),
      SPASI,
      wajib("AKTIVITAS PENDANAAN", 0, true),
      wajib("Belum ada aktivitas pendanaan tercatat", 0),
      SPASI,
      wajib("KENAIKAN KAS BERSIH", hasil.kenaikanKas, true),
      wajib("Saldo kas awal periode", saldoAwal),
      wajib("Saldo kas akhir periode", saldoAkhir, true),
    ],
    total: { label: "Kenaikan Kas Bersih", nilai: hasil.kenaikanKas },
  };
}

/**
 * Percobaan Balance: setiap akun yang bergerak, dengan debit dan kreditnya.
 *
 * Alat verifikasi, bukan laporan untuk dibaca pemilik. Kalau Total Debit tidak
 * sama dengan Total Kredit, ada yang salah di pembukuannya -- dan baris di bawah
 * menunjukkan di mana.
 */
async function percobaanBalance(tenantId: string, dari: Date, sampai: Date): Promise<Laporan> {
  const posting = await prisma.posting.findMany({
    where: { journal: { tenantId, businessDate: { gte: dari, lt: sampai } } },
    select: { side: true, amount: true, account: { select: { code: true, name: true } } },
    orderBy: { account: { code: "asc" } },
  });

  const perAkun = new Map<string, { nama: string; debit: number; kredit: number }>();
  for (const p of posting) {
    const n = Number(p.amount);
    const s = perAkun.get(p.account.code) ?? { nama: p.account.name, debit: 0, kredit: 0 };
    if (p.side === "DEBIT") s.debit += n;
    else s.kredit += n;
    perAkun.set(p.account.code, s);
  }

  let totalDebit = 0;
  let totalKredit = 0;
  const out: BarisLaporan[] = [
    wajib("KODE", 0, true),
    wajib("NAMA AKUN", 0, true),
    wajib("DEBIT", 0, true),
    wajib("KREDIT", 0, true),
    wajib("SALDO", 0, true),
  ];

  for (const kode of [...perAkun.keys()].sort((a, b) => a.localeCompare(b))) {
    const s = perAkun.get(kode)!;
    totalDebit += s.debit;
    totalKredit += s.kredit;
    out.push(
      { label: kode, nilai: 0 },
      { label: `  ${s.nama}`, nilai: bulat(s.debit) },
      { label: "  (kredit)", nilai: bulat(s.kredit) },
      { label: "  (saldo bersih)", nilai: bulat(s.debit - s.kredit) },
    );
  }

  const selisih = bulat(totalDebit - totalKredit);
  out.push(
    SPASI,
    wajib("TOTAL DEBIT", bulat(totalDebit), true),
    wajib("TOTAL KREDIT", bulat(totalKredit), true),
    wajib(selisih === 0 ? "SELISIH (seimbang)" : "SELISIH (tidak seimbang)", selisih, true),
  );

  return {
    periode: periodeLaporan(dari, sampai),
    baris: out,
    total: { label: "Selisih Debit - Kredit", nilai: selisih },
  };
}

/**
 * Buku Besar: mutasi satu akun dari saldo awal sampai saldo akhir.
 *
 * Bukan laporan untuk dibaca, tapi alat bantu menjawab "angka ini datangnya dari
 * mana?". Setiap baris menyebut sumber jurnal, sehingga angka di laporan bisa
 * ditelusuri sampai dokumen asalnya.
 */
async function bukuBesar(
  tenantId: string,
  dari: Date,
  sampai: Date,
  kodeAkun: string = KODE_AKUN.kas,
): Promise<Laporan> {
  const akun = await prisma.ledgerAccount.findFirst({
    where: { tenantId, code: kodeAkun },
    select: { code: true, name: true },
  });
  if (!akun) {
    return {
      periode: periodeLaporan(dari, sampai),
      baris: [{ label: `Akun ${kodeAkun} tidak ada di daftar akun tenant ini.`, nilai: 0 }],
      total: null,
    };
  }

  const sebelum = await saldoKumulatif(tenantId, dari);
  let berjalan = ambil(sebelum, kodeAkun);

  const posting = await prisma.posting.findMany({
    where: {
      journal: { tenantId, businessDate: { gte: dari, lt: sampai } },
      account: { code: kodeAkun },
    },
    select: {
      side: true,
      amount: true,
      journal: {
        select: { refType: true, refId: true, reference: true, businessDate: true },
      },
    },
    orderBy: { journal: { businessDate: "asc" } },
  });

  const out: BarisLaporan[] = [
    wajib(`${akun.code} - ${akun.name}`, 0, true),
    wajib("Saldo awal", berjalan),
  ];

  for (const p of posting) {
    const n = Number(p.amount);
    const delta = p.side === "DEBIT" ? n : -n;
    berjalan = bulat(berjalan + delta);
    const sumber =
      p.journal.reference ??
      (p.journal.refType
        ? `${p.journal.refType}${p.journal.refId ? ` #${p.journal.refId.slice(0, 8)}` : ""}`
        : "jurnal");
    out.push(
      { label: `${p.journal.businessDate.toISOString().slice(0, 10)}  ${p.side}  ${sumber}`, nilai: bulat(delta) },
      { label: "  saldo", nilai: berjalan },
    );
  }

  out.push(SPASI, wajib("Saldo akhir", berjalan, true));

  return {
    periode: periodeLaporan(dari, sampai),
    baris: out,
    total: { label: "Saldo Akhir", nilai: berjalan },
  };
}
