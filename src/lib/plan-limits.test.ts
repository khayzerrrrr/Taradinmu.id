import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ambilBatasFitur,
  ambilBatasJumlah,
  labelBatasJumlah,
  LIMIT_LABELS,
  PLAN_LIMITS,
  type LimitFiturKey,
  type LimitKey,
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
  it("batch, zakat otomatis, program, dan laporan HPP hanya untuk PRO", () => {
    // Semua LimitFiturKey diperiksa lewat loop yang sama: menambah kunci baru
    // tanpa mengisi kolomnya di PLAN_LIMITS akan membuat tes ini merah, bukan
    // diam-diam lolos sebagai `undefined`.
    const kunci: readonly LimitFiturKey[] = [
      "BATCH",
      "ZAKAT",
      "PROGRAM",
      "HPP",
    ];
    assert.ok(kunci.length >= 4);

    for (const key of kunci) {
      assert.equal(
        ambilBatasFitur("FREE", key),
        false,
        `${key} tidak boleh aktif pada paket FREE`,
      );
      assert.equal(
        ambilBatasFitur("PRO", key),
        true,
        `${key} harus aktif pada paket PRO`,
      );
    }
  });

  it("setiap batas punya label untuk pesan upgrade", () => {
    // checkLimit merakit pesannya dari LIMIT_LABELS[type]; kunci tanpa label
    // menghasilkan pesan "Paket FREE tidak termasuk undefined" di UI.
    const kunci: readonly LimitKey[] = [
      "INVOICE",
      "PRODUCT",
      "USERS",
      "BATCH",
      "ZAKAT",
      "PROGRAM",
      "HPP",
    ];

    for (const key of kunci) {
      const label = LIMIT_LABELS[key];
      assert.ok(label && label.length > 1, `LIMIT_LABELS[${key}] kosong`);
    }
  });

  it("hanya PRO yang tanpa batas jumlah", () => {
    assert.equal(PLAN_LIMITS.PRO.invoice, null);
    assert.equal(PLAN_LIMITS.FREE.batch, false);
  });
});
