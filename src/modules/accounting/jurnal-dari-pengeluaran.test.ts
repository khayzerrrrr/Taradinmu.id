import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  lewatBankDari,
  perluJurnalBeban,
  type KategoriPengeluaran,
} from "./jurnal-dari-pengeluaran";

/**
 * Test KEPUTUSAN jurnal pengeluaran. Tanpa database.
 *
 * Yang diuji hanya keputusan murni: kategori mana yang menghasilkan jurnal
 * beban, dan pengeluaran mana yang lewat bank. Siklus buat/ubah/hapus diuji
 * terhadap PostgreSQL asli lewat `scripts/bukti-pengeluaran.ts`.
 */

describe("perluJurnalBeban", () => {
  it("semua kategori selain PURCHASE menghasilkan jurnal beban", () => {
    const beban: KategoriPengeluaran[] = [
      "OPERATIONAL",
      "SALARY",
      "RENT",
      "UTILITIES",
      "MARKETING",
      "TAX",
      "OTHER",
    ];
    for (const kategori of beban) {
      assert.equal(perluJurnalBeban(kategori), true, `${kategori} harus dijurnal`);
    }
  });

  it("PURCHASE TIDAK dijurnal sebagai beban (barang belum tentu terjual)", () => {
    // Kalau pembelian stok dijurnal sebagai beban, laba terpotong dua kali:
    // sekali saat membeli, sekali lagi lewat HPP saat terjual.
    assert.equal(perluJurnalBeban("PURCHASE"), false);
  });
});

describe("lewatBankDari", () => {
  it("TRANSFER (huruf besar) menandakan bank", () => {
    assert.equal(lewatBankDari("TRANSFER"), true);
  });

  it("nilai tidak baku tetap dikenali: spasi dan huruf kecil", () => {
    assert.equal(lewatBankDari(" transfer "), true);
  });

  it("CASH adalah kas, bukan bank", () => {
    assert.equal(lewatBankDari("CASH"), false);
  });

  it("null/undefined/kosong dianggap kas", () => {
    // Pengeluaran lama yang metode bayarnya belum diisi paling aman dianggap
    // tunai: sisi kas selalu ada, sementara saldo bank bisa jadi tidak.
    assert.equal(lewatBankDari(null), false);
    assert.equal(lewatBankDari(undefined), false);
    assert.equal(lewatBankDari(""), false);
    assert.equal(lewatBankDari("   "), false);
  });
});
