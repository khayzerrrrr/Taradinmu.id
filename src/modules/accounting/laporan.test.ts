import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { KODE_AKUN } from "./coa";
import {
  batasPeriode,
  bulat,
  hitungArusKas,
  hitungLabaRugi,
  hitungNeraca,
  hitungRingkasanAkuntansi,
  type Saldo,
} from "./laporan-murni";

/**
 * Test ARITMETIKA laporan. Tanpa database.
 *
 * Yang diuji adalah kode yang benar-benar dipakai `laporan.ts`, bukan salinannya.
 * Tes yang menguji salinan sendiri hanya membuktikan bahwa salinan itu cocok
 * dengan dirinya sendiri.
 *
 * Konvensi tanda: saldo positif = debit, negatif = kredit.
 */

function s(pasangan: Record<string, number>): Saldo {
  return new Map(Object.entries(pasangan));
}

/** Cek ledger benar-benar seimbang: total debit = total kredit. */
function ledgerSeimbang(ledger: Saldo): boolean {
  let dr = 0;
  let kr = 0;
  for (const nilai of ledger.values()) {
    if (nilai > 0) dr += nilai;
    else kr -= nilai;
  }
  return bulat(dr) === bulat(kr);
}

describe("bulat", () => {
  it("normalisasi -0 menjadi 0", () => {
    // `Math.round(-0.001 * 100) / 100` menghasilkan -0, dan `assert.equal(-0, 0)`
    // gagal. Angka -0 di laporan juga membingungkan ketika dicetak.
    assert.equal(bulat(-0.001), 0);
    assert.equal(Object.is(bulat(-0.001), -0), false);
  });

  it("membulatkan ke dua desimal", () => {
    assert.equal(bulat(1000.005), 1000.01);
    assert.equal(bulat(1234.567), 1234.57);
  });
});

describe("batasPeriode", () => {
  it("tidak memasukkan jurnal tepat di batas akhir bulan", () => {
    // 1 November 00:00 adalah milik November. Kalau batasnya `lte`, laporan
    // Oktober ikut bergerak setiap kali ada transaksi tanggal 1.
    const { sampai } = batasPeriode("2026-10");
    assert.equal(sampai.toISOString(), "2026-11-01T00:00:00.000Z");
  });

  it("Desember berlanjut ke Januari tahun depan", () => {
    const { dari, sampai } = batasPeriode("2026-12");
    assert.equal(dari.toISOString(), "2026-12-01T00:00:00.000Z");
    assert.equal(sampai.toISOString(), "2027-01-01T00:00:00.000Z");
  });

  it("Februari bukan 30 hari", () => {
    assert.equal(batasPeriode("2026-02").sampai.toISOString(), "2026-03-01T00:00:00.000Z");
  });

  it("tahun kabisat: Februari tetap 28 hari lalu Lompat ke Maret", () => {
    assert.equal(batasPeriode("2028-02").sampai.toISOString(), "2028-03-01T00:00:00.000Z");
  });
});

describe("hitungLabaRugi", () => {
  it("satu siklus sederhana", () => {
    // Jual 1.100.000, HPP 600.000, sewa 100.000.
    const lr = hitungLabaRugi(
      s({
        [KODE_AKUN.pendapatanPenjualan]: -1_100_000,
        [KODE_AKUN.hpp]: 600_000,
        [KODE_AKUN.bebanSewa]: 100_000,
      }),
    );
    assert.equal(lr.pendapatan, 1_100_000, "pendapatan harus positif");
    assert.equal(lr.labaKotor, 500_000);
    assert.equal(lr.bebanOperasional, 100_000);
    assert.equal(lr.labaBersih, 400_000);
  });

  it("memisahkan barang dan jasa", () => {
    const lr = hitungLabaRugi(
      s({
        [KODE_AKUN.pendapatanPenjualan]: -800_000,
        [KODE_AKUN.pendapatanJasa]: -200_000,
      }),
    );
    assert.equal(lr.pendapatan, 1_000_000);
  });

  it("tanpa transaksi: nol, bukan error", () => {
    const lr = hitungLabaRugi(s({}));
    assert.equal(lr.pendapatan, 0);
    assert.equal(lr.labaBersih, 0);
  });

  it("rugi tetap ditampilkan negatif", () => {
    // Menyembunyikan rugi sebagai nol adalah kebohongan paling berbahaya di
    // laporan keuangan: pemilik toko lalu yakin sailedsafe padahal tidak.
    const lr = hitungLabaRugi(
      s({ [KODE_AKUN.pendapatanPenjualan]: -500_000, [KODE_AKUN.hpp]: 800_000 }),
    );
    assert.equal(lr.labaKotor, -300_000);
    assert.equal(lr.labaBersih, -300_000);
  });

  it("pembelian stok TIDAK memotong laba", () => {
    // Kesalahan lama sistem ini (PRD 4.G.1): pembelian stok adalah aset, bukan
    // beban. Kalau dihitung sebagai beban, laba turun pada bulan pembelian dan
    // zakat pun ikut turun.
    const tanpaPembelian = hitungLabaRugi(
      s({ [KODE_AKUN.pendapatanPenjualan]: -1_000_000, [KODE_AKUN.hpp]: 400_000 }),
    );
    const denganPembelian = hitungLabaRugi(
      s({
        [KODE_AKUN.pendapatanPenjualan]: -1_000_000,
        [KODE_AKUN.hpp]: 400_000,
        [KODE_AKUN.persediaan]: 2_000_000,
      }),
    );
    assert.equal(denganPembelian.labaBersih, tanpaPembelian.labaBersih);
  });

  it("HPP nol berarti margin penuh, dan itu dilaporkan apa adanya", () => {
    const lr = hitungLabaRugi(s({ [KODE_AKUN.pendapatanPenjualan]: -1_000_000 }));
    assert.equal(lr.hpp, 0);
    assert.equal(lr.labaKotor, 1_000_000);
  });

  it("memotong semua jenis beban operasional", () => {
    const lr = hitungLabaRugi(
      s({
        [KODE_AKUN.pendapatanPenjualan]: -1_000_000,
        [KODE_AKUN.bebanGaji]: 100_000,
        [KODE_AKUN.bebanSewa]: 50_000,
        [KODE_AKUN.bebanUtilitas]: 25_000,
        [KODE_AKUN.bebanPemasaran]: 15_000,
        [KODE_AKUN.bebanLain]: 10_000,
      }),
    );
    assert.equal(lr.bebanOperasional, 200_000);
    assert.equal(lr.labaBersih, 800_000);
  });
});

describe("hitungNeraca", () => {
  it("seimbang setelah satu siklus lengkap", () => {
    // Modal 10 juta, beli stok 600rb, jual 1.100.000 (lunas), HPP 600.000.
    const kumulatif = s({
      [KODE_AKUN.kas]: 10_500_000, // +10jt modal, +1,1jt masuk, -0,6jt beli
      [KODE_AKUN.persediaan]: 0, // +600rb beli, -600rb terjual
      [KODE_AKUN.piutangUsaha]: 0, // +1,1jt, -1,1jt (lunas)
      [KODE_AKUN.modalDisetor]: -10_000_000,
      [KODE_AKUN.pendapatanPenjualan]: -1_100_000,
      [KODE_AKUN.hpp]: 600_000,
    });
    assert.equal(ledgerSeimbang(kumulatif), true, "data test harus balance");

    const n = hitungNeraca(kumulatif);
    assert.equal(n.aset, 10_500_000);
    assert.equal(n.labaBerjalan, 500_000, "laba = 1.100.000 - 600.000");
    assert.equal(n.modal, 10_500_000, "modal 10jt + laba berjalan 500rb");
    assert.equal(n.seimbang, true, "Aset = Liabilitas + Modal");
  });

  it("piutang bersaldo kredit jadi kewajiban, bukan aset negatif", () => {
    // Pelanggan bayar 50.000 di muka: kas masuk, piutang jadi saldo kredit.
    // Kalau dibuang jadi nol, angka itu hilang dari neraca tanpa jejak.
    const kumulatif = s({
      [KODE_AKUN.kas]: 1_050_000,
      [KODE_AKUN.piutangUsaha]: -50_000,
      [KODE_AKUN.modalDisetor]: -1_000_000,
    });
    assert.equal(ledgerSeimbang(kumulatif), true);

    const n = hitungNeraca(kumulatif);
    assert.equal(n.aset, 1_050_000, "kas saja; piutang negatif bukan aset");
    assert.equal(n.uangMuka, 50_000);
    assert.equal(n.liabilitas, 50_000, "sudah terima di muka = kewajiban");
    assert.equal(n.seimbang, true);
  });

  it("barang dijual kredit: persediaan habis, laba diakui, piutang menggantikannya", () => {
    // Modal 1.000.000, beli stok 100rb, jual 900rb dengan HPP 100rb, belum bayar.
    // Persediaan nol, laba 800rb diakui walau uangnya belum masuk.
    const kumulatif = s({
      [KODE_AKUN.kas]: 900_000,
      [KODE_AKUN.persediaan]: 0,
      [KODE_AKUN.piutangUsaha]: 900_000,
      [KODE_AKUN.modalDisetor]: -1_000_000,
      [KODE_AKUN.pendapatanPenjualan]: -900_000,
      [KODE_AKUN.hpp]: 100_000,
    });
    assert.equal(ledgerSeimbang(kumulatif), true);

    const n = hitungNeraca(kumulatif);
    assert.equal(n.labaBerjalan, 800_000, "pendapatan diakui walau kas belum masuk");
    assert.equal(n.aset, 1_800_000);
    assert.equal(n.seimbang, true);
  });

  it("aset tahun lalu tetap muncul (kumulatif, bukan saldo periode)", () => {
    // Aset dibeli tahun lalu, periode ini tidak ada transaksinya. Kalau neraca
    // memakai saldo periode, aset itu hilang.
    const kumulatif = s({ [KODE_AKUN.kas]: 5_000_000, [KODE_AKUN.modalDisetor]: -5_000_000 });
    assert.equal(ledgerSeimbang(kumulatif), true);

    const n = hitungNeraca(kumulatif);
    assert.equal(n.aset, 5_000_000);
    assert.equal(n.seimbang, true);
  });

  it("rugi mengurangi modal, dan neraca tetap seimbang", () => {
    const kumulatif = s({
      [KODE_AKUN.kas]: 700_000,
      [KODE_AKUN.modalDisetor]: -1_000_000,
      [KODE_AKUN.bebanSewa]: 300_000,
    });
    assert.equal(ledgerSeimbang(kumulatif), true);

    const n = hitungNeraca(kumulatif);
    assert.equal(n.labaBerjalan, -300_000);
    assert.equal(n.modal, 700_000);
    assert.equal(n.seimbang, true);
  });

  it("utang usaha masuk liabilitas", () => {
    const kumulatif = s({
      [KODE_AKUN.persediaan]: 1_000_000,
      [KODE_AKUN.utangUsaha]: -400_000,
      [KODE_AKUN.modalDisetor]: -600_000,
    });
    assert.equal(ledgerSeimbang(kumulatif), true);

    const n = hitungNeraca(kumulatif);
    assert.equal(n.aset, 1_000_000);
    assert.equal(n.liabilitas, 400_000);
    assert.equal(n.modal, 600_000);
    assert.equal(n.seimbang, true);
  });

  it("laba ditahan dan laba berjalan dijumlahkan ke modal", () => {
    // Year's end: laba tahun lalu dipindahkan ke Laba Ditahan lewat jurnal
    //utup. Tahun ini masih berjalan.
    const kumulatif = s({
      [KODE_AKUN.kas]: 2_000_000,
      [KODE_AKUN.modalDisetor]: -1_000_000,
      [KODE_AKUN.labaDitahan]: -300_000, // hasil tahun lalu
      [KODE_AKUN.pendapatanPenjualan]: -700_000, // hasil tahun ini
    });
    assert.equal(ledgerSeimbang(kumulatif), true);

    const n = hitungNeraca(kumulatif);
    assert.equal(n.labaDitahan, 300_000);
    assert.equal(n.labaBerjalan, 700_000);
    assert.equal(n.modal, 2_000_000);
    assert.equal(n.seimbang, true);
  });

  it("menykeptis ledger yang tidak seimbang, bukanikutAdjustment", () => {
    // Kas 1.000.000 tapi modal hanya 900.000: ada 100.000 yang hilang. Neraca
    // harus melaporkan TIDAK seimbang -- bukan diam-diam menyeimbangkan.
    const kumulatif = s({ [KODE_AKUN.kas]: 1_000_000, [KODE_AKUN.modalDisetor]: -900_000 });
    const n = hitungNeraca(kumulatif);
    assert.equal(n.aset, 1_000_000);
    assert.equal(n.modal, 900_000);
    assert.equal(n.seimbang, false, "ledger harus dilaporkan tidak seimbang");
  });
});

describe("hitungArusKas", () => {
  it("kas masuk dari penjualan dan kas keluar operasional", () => {
    const ak = hitungArusKas({ masuk: 1_100_000, keluar: 100_000 }, 0, 1_000_000);
    assert.equal(ak.kasMasuk, 1_100_000);
    assert.equal(ak.kasKeluar, 100_000);
    assert.equal(ak.kenaikanKas, 1_000_000);
    assert.equal(ak.cocokDenganSaldo, true);
  });

  it("kas masuk dan keluar sama besar tetap tercatat, bukan nol", () => {
    // Saldo bersih = 0. Kalau laporan memakai saldo, aktivitas ini hilang dan
    // pemilik toko mengira kasnya tidak pernah bergerak.
    const ak = hitungArusKas({ masuk: 1_000_000, keluar: 1_000_000 }, 500_000, 500_000);
    assert.equal(ak.kasMasuk, 1_000_000);
    assert.equal(ak.kasKeluar, 1_000_000);
    assert.equal(ak.kenaikanKas, 0);
    assert.equal(ak.cocokDenganSaldo, true);
  });

  it("kenaikan kas negatif saat pengeluaran lebih besar", () => {
    // Angka negatif harus tampil. Disembunyikan sebagai nol membuat pemilik
    // toko tidak tahu kasnya habis.
    const ak = hitungArusKas({ masuk: 200_000, keluar: 500_000 }, 1_000_000, 700_000);
    assert.equal(ak.kenaikanKas, -300_000);
    assert.equal(ak.cocokDenganSaldo, true);
  });

  it("mendeteksi posting kas yang hilang", () => {
    // Kenaikan kas tidak sama dengan selisih saldo: ada posting yang hilang di
    // akun kas, atau ada mutasi yang masuk lewat jalur lain. Selisih antara
    // keduanya harus dilaporkan, bukan diasumsikan selalu cocok.
    const ak = hitungArusKas({ masuk: 1_000_000, keluar: 400_000 }, 0, 500_000);
    assert.equal(ak.kenaikanKas, 600_000);
    assert.equal(ak.cocokDenganSaldo, false, "selisih saldo harus terdeteksi");
  });
});

describe("hitungRingkasanAkuntansi", () => {
  it("saldo kosong: nol semua, bukan error", () => {
    const r = hitungRingkasanAkuntansi(s({}));
    assert.equal(r.pendapatan, 0);
    assert.equal(r.hpp, 0);
    assert.equal(r.bebanOperasional, 0);
    assert.equal(r.pembelianStok, 0);
    assert.equal(r.arusKas, 0);
    assert.equal(r.labaKotor, 0);
    assert.equal(r.labaBersih, 0);
  });

  it("satu siklus: pendapatan jurnal, HPP, beban, pembelian stok", () => {
    // Skenario sederhana (konvensi: positif = debit, negatif = kredit):
    //   kas +10.000.000 dari modal (3-1000)
    //   penjualan kredit 1.100.000 -> pendapatan 4-1000 = -1.100.000
    //   HPP 600.000            -> 5-1000 = +600.000
    //   beban gaji 200.000     -> 5-2000 = +200.000
    //   pembelian stok 400.000 -> 1-1200 = +400.000
    // Ekspektasi:
    //   pendapatan       = 1.100.000 (kredit dibalik)
    //   hpp              =   600.000
    //   bebanOperasional =   200.000 (5- selain 5-1000)
    //   pembelianStok    =   400.000
    //   arusKas          = 10.000.000 (kas + bank)
    //   labaKotor        =   500.000 (1.100.000 - 600.000)
    //   labaBersih       =   300.000 (500.000 - 200.000)
    const r = hitungRingkasanAkuntansi(
      s({
        [KODE_AKUN.kas]: 10_000_000,
        [KODE_AKUN.persediaan]: 400_000,
        [KODE_AKUN.modalDisetor]: -10_000_000,
        [KODE_AKUN.pendapatanPenjualan]: -1_100_000,
        [KODE_AKUN.hpp]: 600_000,
        [KODE_AKUN.bebanGaji]: 200_000,
      }),
    );
    assert.equal(r.pendapatan, 1_100_000);
    assert.equal(r.hpp, 600_000);
    assert.equal(r.bebanOperasional, 200_000);
    assert.equal(r.pembelianStok, 400_000);
    assert.equal(r.arusKas, 10_000_000);
    assert.equal(r.labaKotor, 500_000);
    assert.equal(r.labaBersih, 300_000);
  });

  it("arusKas = kas + bank, pendapatan menjumlahkan semua akun 4-", () => {
    // Penjualan 700.000 (4-1000) + jasa 300.000 (4-2000); kas 250.000, bank 750.000.
    const r = hitungRingkasanAkuntansi(
      s({
        [KODE_AKUN.kas]: 250_000,
        [KODE_AKUN.bank]: 750_000,
        [KODE_AKUN.pendapatanPenjualan]: -700_000,
        [KODE_AKUN.pendapatanJasa]: -300_000,
      }),
    );
    assert.equal(r.pendapatan, 1_000_000);
    assert.equal(r.arusKas, 1_000_000);
  });
});
