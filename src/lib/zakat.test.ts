import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hitungZakat, round2, ZAKAT_RATE } from "./zakat";

describe("hitungZakat", () => {
  it("di bawah nisab: estimasi tetap tampil, terutang nol", () => {
    const hasil = hitungZakat(1_000_000, 5_000_000);
    assert.equal(hasil.mencapaiNisab, false);
    assert.equal(hasil.terutang, 0);
    assert.equal(hasil.estimasi, 25_000);
  });

  it("mencapai nisab: 2,5% menjadi terutang", () => {
    const hasil = hitungZakat(10_000_000, 5_000_000);
    assert.equal(hasil.mencapaiNisab, true);
    assert.equal(hasil.terutang, 250_000);
  });

  it("neto nol atau negatif tidak menimbulkan zakat", () => {
    assert.equal(hitungZakat(0, 100).estimasi, 0);
    assert.equal(hitungZakat(-5_000_000, 100).terutang, 0);
    assert.equal(hitungZakat(-5_000_000, 100).mencapaiNisab, false);
  });

  it("nisab nol hanya butuh dasar positif", () => {
    assert.equal(hitungZakat(500, 0).mencapaiNisab, true);
    assert.equal(hitungZakat(0, 0).mencapaiNisab, false);
  });

  it("membulatkan hasil ke dua desimal", () => {
    assert.equal(hitungZakat(333.333, 0).estimasi, 8.33);
    assert.equal(round2(0.005), 0.01);
  });

  it("menghormati kadar kustom", () => {
    assert.equal(hitungZakat(1_000_000, 0, 0.05).terutang, 50_000);
    assert.equal(ZAKAT_RATE, 0.025);
  });
});
