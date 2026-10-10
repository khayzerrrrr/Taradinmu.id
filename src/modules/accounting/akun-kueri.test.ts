import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hitungSaldoBerjalan, labelSumberJurnal } from "./akun-kueri";

// Tes MURNI untuk lapisan baca akun. Tanpa database: query diuji terhadap
// PostgreSQL asli lewat skrip pembuktian, sementara label sumber dan aritmetika
// saldo berjalan diuji di sini supaya kesalahan aritmetika tidak bisa lolos
// hanya karena datanya kebetulan benar.

describe("labelSumberJurnal", () => {
  it("menerjemahkan semua sumber jurnal ke bahasa Indonesia", () => {
    assert.equal(labelSumberJurnal("INVOICE"), "Penjualan");
    assert.equal(labelSumberJurnal("PAYMENT"), "Pembayaran");
    assert.equal(labelSumberJurnal("STOCK"), "Stok");
    assert.equal(labelSumberJurnal("EXPENSE"), "Pengeluaran");
    assert.equal(labelSumberJurnal("MANUAL"), "Manual");
    assert.equal(labelSumberJurnal("OPENING"), "Saldo Awal");
    assert.equal(labelSumberJurnal("REVERSAL"), "Pembalik");
    assert.equal(labelSumberJurnal("CLOSING"), "Penutupan");
  });

  it("nilai tak dikenal dikembalikan apa adanya, bukan jadi kosong", () => {
    // Sumber baru dari migrasi mendatang harus tetap terbaca, bukan hilang.
    assert.equal(labelSumberJurnal("FUTURE_SOURCE"), "FUTURE_SOURCE");
  });
});
describe("hitungSaldoBerjalan", () => {
  it("debit menambah dan kredit mengurangi", () => {
    const saldo = hitungSaldoBerjalan([
      { sisi: "DEBIT", nominal: 1_000_000 },
      { sisi: "CREDIT", nominal: 250_000 },
      { sisi: "DEBIT", nominal: 500_000 },
    ]);
    assert.deepEqual(saldo, [1_000_000, 750_000, 1_250_000]);
  });

  it("dimulai dari saldo awal bila diberikan", () => {
    const saldo = hitungSaldoBerjalan(
      [
        { sisi: "DEBIT", nominal: 100_000 },
        { sisi: "CREDIT", nominal: 40_000 },
      ],
      500_000,
    );
    assert.deepEqual(saldo, [600_000, 560_000]);
  });

  it("tanpa baris menghasilkan larik kosong", () => {
    assert.deepEqual(hitungSaldoBerjalan([]), []);
  });

  it("saldo bisa turun di bawah nol (kredit melebihi debit)", () => {
    const saldo = hitungSaldoBerjalan([{ sisi: "CREDIT", nominal: 300_000 }]);
    assert.deepEqual(saldo, [-300_000]);
  });
});
