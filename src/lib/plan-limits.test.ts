import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ambilBatasFitur,
  ambilBatasJumlah,
  labelBatasJumlah,
  PLAN_LIMITS,
} from "./plan-limits";

// Matriks paket: perubahan yang tidak sengaja di sini langsung memengaruhi
// janji PRD 4.D, jadi dikunci dengan tes.

describe("batas jumlah", () => {
  it("FREE dibatasi, PRO tanpa batas", () => {
    assert.equal(ambilBatasJumlah("FREE", "INVOICE"), 50);
    assert.equal(ambilBatasJumlah("FREE", "PRODUCT"), 100);
    assert.equal(ambilBatasJumlah("FREE", "USERS"), 1);

    assert.equal(ambilBatasJumlah("PRO", "INVOICE"), null);
    assert.equal(ambilBatasJumlah("PRO", "PRODUCT"), null);
    assert.equal(ambilBatasJumlah("PRO", "USERS"), null);
  });

  it("invoice dihitung per bulan, produk tidak", () => {
    assert.equal(labelBatasJumlah("INVOICE"), "invoice per bulan");
    assert.equal(labelBatasJumlah("PRODUCT"), "produk");
    assert.equal(labelBatasJumlah("USERS"), "pengguna");
  });
});

describe("batas fitur", () => {
  it("batch dan zakat otomatis hanya untuk PRO", () => {
    assert.equal(ambilBatasFitur("FREE", "BATCH"), false);
    assert.equal(ambilBatasFitur("FREE", "ZAKAT"), false);
    assert.equal(ambilBatasFitur("PRO", "BATCH"), true);
    assert.equal(ambilBatasFitur("PRO", "ZAKAT"), true);
  });

  it("hanya PRO yang tanpa batas jumlah", () => {
    assert.equal(PLAN_LIMITS.PRO.invoice, null);
    assert.equal(PLAN_LIMITS.FREE.batch, false);
  });
});
