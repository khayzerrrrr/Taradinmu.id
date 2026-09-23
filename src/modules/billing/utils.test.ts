import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bolehkanTransisi, hitungTotal, kodeTenant, transisiBerikutnya } from "./utils";

describe("bolehkanTransisi", () => {
  it("mengizinkan maju dan mundur satu langkah", () => {
    assert.equal(bolehkanTransisi("DRAFT", "SENT"), true);
    assert.equal(bolehkanTransisi("DRAFT", "PAID"), true);
    assert.equal(bolehkanTransisi("SENT", "PAID"), true);
    assert.equal(bolehkanTransisi("SENT", "DRAFT"), true);
    assert.equal(bolehkanTransisi("PAID", "SENT"), true);
  });

  it("menolak lompatan dua langkah ke belakang", () => {
    assert.equal(bolehkanTransisi("PAID", "DRAFT"), false);
  });

  it("menolak status yang tidak pernah disimpan (OVERDUE)", () => {
    assert.equal(bolehkanTransisi("OVERDUE", "PAID"), false);
    assert.equal(bolehkanTransisi("DRAFT", "OVERDUE"), false);
  });

  it("aksi yang ditawarkan UI mengikuti aturan yang sama", () => {
    assert.deepEqual(transisiBerikutnya("DRAFT"), ["SENT", "PAID"]);
    assert.deepEqual(transisiBerikutnya("PAID"), ["SENT"]);
  });
});

describe("hitungTotal", () => {
  it("menjumlahkan subtotal, PPN, dan total", () => {
    const total = hitungTotal(
      [
        { quantity: 2, price: 100_000 },
        { quantity: 1, price: 50_000 },
      ],
      11,
    );
    assert.equal(total.subtotal, 250_000);
    assert.equal(total.taxAmount, 27_500);
    assert.equal(total.totalAmount, 277_500);
  });

  it("tanpa PPN total sama dengan subtotal", () => {
    const total = hitungTotal([{ quantity: 1, price: 99_999 }], 0);
    assert.equal(total.taxAmount, 0);
    assert.equal(total.totalAmount, 99_999);
  });
});

describe("kodeTenant", () => {
  it("mengambil enam karakter alfanumerik huruf besar", () => {
    assert.equal(kodeTenant("toko-berkah"), "TOKOBE");
    assert.equal(kodeTenant("berkah-haramain"), "BERKAH");
  });

  it("memberi kode cadangan bila slug tanpa karakter alfanumerik", () => {
    assert.equal(kodeTenant("---"), "TOKO");
  });
});
