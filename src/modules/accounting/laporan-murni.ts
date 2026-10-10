// Perhitungan laporan keuangan yang MURNI: tidak menyentuh database.
//
// Dipisah dari `laporan.ts` karena dua alasan. Pertama, bentuk tiap laporan bisa
// diuji dengan angka yang diketahui tanpa menyiapkan journal di database -- dan
// tes tanpa database yang salah hanya akan lolos untuk alasan yang salah. Kedua,
// pemisahannya membuat jelas mana bagian yang boleh salah diam-diam (query) dan
// mana yang tidak boleh (aritmetika).

import { KODE_AKUN } from "./coa";

export type Saldo = Map<string, number>;

export type PeriodeLaporan = { dari: string; sampai: string };

/** Normalisasi -0: `Math.round(-0.001 * 100) / 100` menghasilkan -0, dan */
export function bulat(n: number): number {
  return Math.round(n * 100) / 100 + 0;
}

/** Ambil saldo satu kode akun; 0 bila belum pernah dipakai. */
export function ambil(sal: Saldo, kode: string): number {
  return bulat(sal.get(kode) ?? 0);
}

/** Batas periode dari label "YYYY-MM". */
export function batasPeriode(periode: string): { dari: Date; sampai: Date } {
  const [tahun, bulan] = periode.split("-").map((x) => Number(x));
  return {
    dari: new Date(Date.UTC(tahun, bulan - 1, 1)),
    // Hari pertama bulan berikutnya 00:00, supaya jurnal tepat di batas akhir
    // bulan TIDAK ikut terhitung. Tanpa ini, laporan bulan lalu ikut bergerak
    // setiap kali ada transaksi tanggal 1.
    sampai: new Date(Date.UTC(tahun, bulan, 1)),
  };
}

export function periodeLaporan(dari: Date, sampai: Date): PeriodeLaporan {
  return {
    dari: dari.toISOString().slice(0, 7),
    sampai: sampai.toISOString().slice(0, 7),
  };
}

export type LabaRugi = {
  pendapatan: number;
  hpp: number;
  labaKotor: number;
  bebanOperasional: number;
  labaBersih: number;
};

/**
 * Laba Rugi dari satu SALDO periode.
 *
 * Pendapatan berada di sisi KREDIT, jadi tandanya dibalik supaya positif berarti
 * "berapa banyak pendapatan". Tanpa pembalikan ini pendapatan tampil negatif,
 * laba kotor berubah jadi penjumlahan, dan laporan yang seharusnya menunjukkan
 * keuntungan justru terlihat seperti rugi.
 */
export function hitungLabaRugi(sal: Saldo): LabaRugi {
  const pendapatan = bulat(
    -ambil(sal, KODE_AKUN.pendapatanPenjualan) - ambil(sal, KODE_AKUN.pendapatanJasa),
  );
  const hpp = ambil(sal, KODE_AKUN.hpp);
  const labaKotor = bulat(pendapatan - hpp);
  const bebanOperasional = bulat(
    ambil(sal, KODE_AKUN.bebanGaji) +
      ambil(sal, KODE_AKUN.bebanSewa) +
      ambil(sal, KODE_AKUN.bebanUtilitas) +
      ambil(sal, KODE_AKUN.bebanPemasaran) +
      ambil(sal, KODE_AKUN.bebanLain),
  );
  return {
    pendapatan,
    hpp,
    labaKotor,
    bebanOperasional,
    labaBersih: bulat(labaKotor - bebanOperasional),
  };
}

export type Neraca = {
  aset: number;
  liabilitas: number;
  modal: number;
  labaBerjalan: number;
  modalDisetor: number;
  labaDitahan: number;
  utang: number;
  uangMuka: number;
  kas: number;
  bank: number;
  piutang: number;
  persediaan: number;
  seimbang: boolean;
};

/**
 * Neraca dari SALDO KUMULATIF (since awal, bukan satu periode).
 *
 * Modal = modal disetor + laba ditahan + laba berjalan. Laba berjalan diambil
 * dari akun pendapatan dan beban pada kumulatif yang sama, sehingga transaksi
 * tidak dihitung dua kali -- yang membuat aset dan modal tidak pernah sama.
 *
 * Saldo KREDIT pada akun aset berarti pelanggan sudah bayar di muka. Itu
 * kewajiban, bukan aset. Membuangnya dengan `Math.max(0, ...)` membuat angka itu
 * hilang dari neraca tanpa jejak: laporan terlihat rusak dan tidak ada yang bisa
 * menjelaskan kenapa.
 */
export function hitungNeraca(kumulatif: Saldo): Neraca {
  const kas = ambil(kumulatif, KODE_AKUN.kas);
  const bank = ambil(kumulatif, KODE_AKUN.bank);
  const piutang = Math.max(0, ambil(kumulatif, KODE_AKUN.piutangUsaha));
  const persediaan = Math.max(0, ambil(kumulatif, KODE_AKUN.persediaan));
  const aset = bulat(Math.max(0, kas) + Math.max(0, bank) + piutang + persediaan);

  const utang = Math.max(0, -ambil(kumulatif, KODE_AKUN.utangUsaha));
  const uangMuka = Math.max(0, -ambil(kumulatif, KODE_AKUN.piutangUsaha));
  const liabilitas = bulat(utang + uangMuka);

  const labaBerjalan = hitungLabaRugi(kumulatif).labaBersih;
  const modalDisetor = Math.max(0, -ambil(kumulatif, KODE_AKUN.modalDisetor));
  // Laba Ditahan dan Modal Disetor sama-sama akun EQUITY: saldo normalnya
  // KREDIT, jadi tandanya dibalik. Mengambilnya tanpa pembalikan membuat
  // laba ditahan selalu tampil nol di neraca, berapa pun nilainya.
  const labaDitahan = Math.max(0, -ambil(kumulatif, KODE_AKUN.labaDitahan));
  const modal = bulat(modalDisetor + labaDitahan + labaBerjalan);

  return {
    aset,
    liabilitas,
    modal,
    labaBerjalan,
    modalDisetor,
    labaDitahan,
    utang,
    uangMuka,
    kas,
    bank,
    piutang,
    persediaan,
    seimbang: bulat(aset) === bulat(liabilitas + modal),
  };
}

export type ArusKas = {
  kasMasuk: number;
  kasKeluar: number;
  kenaikanKas: number;
};

/**
 * Arus Kas dari GERAKAN kas, bukan dari saldo.
 *
 * Saldo bersih adalah satu angka, dan satu angka tidak bisa tahu apakah uang
 * masuk atau uang keluar. Kalau hanya saldo yang dipakai, kas masuk 1.000.000
 * dengan kas keluar 1.000.000 akan terbaca "tidak ada aktivitas" padahal uangnya
 * berputar -- laporan yang membuat pemilik toko salah memutuskan.
 *
 * `saldoAkhir` dipakai sebagai penutup, dan `kenaikanKas` HARUS sama dengan
 * `saldoAkhir - saldoAwal`. Kalau berbeda, ada posting kas yang hilang.
 */
export function hitungArusKas(
  gerak: { masuk: number; keluar: number },
  saldoAwal: number,
  saldoAkhir: number,
): ArusKas & { cocokDenganSaldo: boolean } {
  const kasMasuk = bulat(gerak.masuk);
  const kasKeluar = bulat(gerak.keluar);
  const kenaikanKas = bulat(kasMasuk - kasKeluar);
  return {
    kasMasuk,
    kasKeluar,
    kenaikanKas,
    cocokDenganSaldo: kenaikanKas === bulat(saldoAkhir - saldoAwal),
  };
}

export type RingkasanAkuntansi = {
  pendapatan: number;
  bebanOperasional: number;
  pembelianStok: number;
  hpp: number;
  arusKas: number;
  labaBersih: number;
  labaKotor: number;
};

/** Jumlahkan seluruh saldo akun yang kodenya berawalan `awalan`. */
function jumlahAwalan(sal: Saldo, awalan: string): number {
  let total = 0;
  for (const [kode, nilai] of sal) {
    if (kode.startsWith(awalan)) total += nilai;
  }
  return total;
}

/**
 * Ringkasan akuntansi untuk dashboard Owner (F1.10), dihitung dari SATU peta
 * saldo periode. Murni: tidak menyentuh database, bisa diuji dengan angka yang
 * diketahui.
 *
 * Definisi (konvensi repo: positif = debit, negatif = kredit):
 * - pendapatan       = -(Σ saldo akun berkode "4-")
 *   Pendapatan bersaldo KREDIT, jadi dibalik agar positif berarti "berapa banyak
 *   pendapatan" — sama seperti `hitungLabaRugi`.
 * - hpp              = Σ saldo akun "5-1000"
 * - bebanOperasional = Σ saldo akun "5-" KECUALI "5-1000"
 * - pembelianStok    = Σ saldo akun "1-1200" + ("1-1201" bila ada)
 * - arusKas          = saldo "1-1001" (kas) + "1-1002" (bank): gerakan kas neto
 *   bulan ini. Ini BUKAN saldo kas (sistem tidak menyimpan saldo awal).
 * - labaKotor        = pendapatan - hpp
 * - labaBersih       = pendapatan - hpp - bebanOperasional
 *
 * Kenapa pendapatan dibalik tetapi beban/aset TIDAK: beban dan aset bersaldo
 * normal DEBIT, jadi nilainya yang wajar sudah positif. Hanya akun pendapatan
 * yang sisi normalnya kredit sehingga wajib dinegatifkan.
 *
 * Pembelian stok sengaja dipisahkan dari beban (PRD 4.G.1): uangnya keluar, tapi
 * barangnya masih jadi aset — ia tidak mengurangi laba.
 */
export function hitungRingkasanAkuntansi(sal: Saldo): RingkasanAkuntansi {
  const pendapatan = bulat(-jumlahAwalan(sal, "4-"));
  const hpp = bulat(ambil(sal, KODE_AKUN.hpp));
  const bebanOperasional = bulat(jumlahAwalan(sal, "5-") - ambil(sal, KODE_AKUN.hpp));
  const pembelianStok = bulat(ambil(sal, KODE_AKUN.persediaan) + ambil(sal, "1-1201"));
  const arusKas = bulat(ambil(sal, KODE_AKUN.kas) + ambil(sal, KODE_AKUN.bank));
  const labaKotor = bulat(pendapatan - hpp);
  const labaBersih = bulat(pendapatan - hpp - bebanOperasional);
  return {
    pendapatan,
    bebanOperasional,
    pembelianStok,
    hpp,
    arusKas,
    labaBersih,
    labaKotor,
  };
}
