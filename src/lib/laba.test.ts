import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BEBAN_NOL,
  hitungArusKas,
  hitungLaba,
  KATEGORI_PEMBELIAN_STOK,
  pilahBeban,
  type BarisPengeluaran,
} from "./laba";

const baris = (
  category: BarisPengeluaran["category"],
  amount: number,
  jumlah = 1,
): BarisPengeluaran => ({ category, amount, jumlah });

describe("pilahBeban", () => {
  it("memisahkan pembelian stok dari beban usaha", () => {
    const beban = pilahBeban([
      baris("SALARY", 2_000_000),
      baris("PURCHASE", 5_000_000, 3),
      baris("OPERATIONAL", 500_000),
    ]);

    assert.deepEqual(beban, {
      operasional: 2_500_000,
      pembelian: 5_000_000,
      total: 7_500_000,
      jumlah: 5,
    });
  });

  it("tanpa pengeluaran semuanya nol", () => {
    assert.deepEqual(pilahBeban([]), BEBAN_NOL);
  });

  it("hanya PURCHASE: kas keluar tapi tidak ada beban laba", () => {
    const beban = pilahBeban([baris("PURCHASE", 3_000_000)]);
    assert.equal(beban.operasional, 0);
    assert.equal(beban.pembelian, 3_000_000);
  });

  it("kategori lain tetap beban, termasuk OTHER dan TAX", () => {
    const beban = pilahBeban([
      baris("OTHER", 100),
      baris("TAX", 200),
      baris("RENT", 300),
      baris("UTILITIES", 400),
      baris("MARKETING", 500),
    ]);
    assert.equal(beban.operasional, 1500);
    assert.equal(beban.pembelian, 0);
  });

  it("nilai non-angka tidak meracuni total", () => {
    const beban = pilahBeban([baris("PURCHASE", Number.NaN), baris("SALARY", 10)]);
    assert.equal(beban.total, 10);
  });

  it("hanya PURCHASE yang dikeluarkan dari beban laba", () => {
    assert.deepEqual([...KATEGORI_PEMBELIAN_STOK], ["PURCHASE"]);
  });
});

describe("hitungArusKas vs hitungLaba", () => {
  const beban = pilahBeban([
    baris("SALARY", 1_000_000),
    baris("PURCHASE", 4_000_000),
  ]);

  it("arus kas menghitung seluruh kas keluar, termasuk beli stok", () => {
    assert.equal(hitungArusKas(10_000_000, beban), 5_000_000);
  });

  it("laba tidak dikurangi pembelian stok", () => {
    assert.equal(hitungLaba(10_000_000, beban), 9_000_000);
  });

  // Inti perbaikan PRD 4.G.1: bulan belanja besar tidak lagi tampak merugi.
  it("belanja stok lebih besar dari pendapatan tidak membuat laba negatif", () => {
    const belanja = pilahBeban([baris("PURCHASE", 50_000_000)]);
    assert.equal(hitungLaba(10_000_000, belanja), 10_000_000);
    assert.equal(hitungArusKas(10_000_000, belanja), -40_000_000);
  });

  it("selisih keduanya persis sama dengan pembelian stok", () => {
    assert.equal(
      hitungArusKas(7_000_000, beban) - hitungLaba(7_000_000, beban),
      -beban.pembelian,
    );
  });
});

describe("hitungLaba dengan HPP", () => {
  const beban = pilahBeban([
    baris("SALARY", 1_000_000),
    baris("PURCHASE", 4_000_000),
  ]);

  it("HPP mengurangi laba meski pembelian stoknya tidak", () => {
    // 4 juta keluar untuk belanja barang, 3 juta di antaranya sudah terjual:
    // hanya 3 juta yang menjadi rugi bulan ini.
    assert.equal(hitungLaba(10_000_000, beban, 3_000_000), 6_000_000);
  });

  it("argumen HPP boleh dihilangkan dan tidak mengubah hasil lama", () => {
    assert.equal(hitungLaba(10_000_000, beban), hitungLaba(10_000_000, beban, 0));
  });

  it("menggadaikan stok yang belum terjual tidak membuat laba negatif", () => {
    // Kas benar-benar minus, tapi laba usaha baru ikut minus bila barangnya
    // memang keluar dari rak.
    const belanja = pilahBeban([baris("PURCHASE", 50_000_000)]);
    assert.equal(hitungLaba(10_000_000, belanja, 0), 10_000_000);
    assert.equal(hitungLaba(10_000_000, belanja, 12_000_000), -2_000_000);
  });
});
