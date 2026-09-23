import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isExpired, isExpiringSoon, ringkasStok } from "./stock";

const SEKARANG = new Date("2026-09-23T00:00:00.000Z");

describe("isExpired", () => {
  it("batch yang kedaluwarsa HARI INI masih layak", () => {
    assert.equal(isExpired("2026-09-23", SEKARANG), false);
  });

  it("sehari sebelumnya sudah kedaluwarsa", () => {
    assert.equal(isExpired("2026-09-22", SEKARANG), true);
  });

  it("tanggal kosong atau tidak valid dianggap tidak kedaluwarsa", () => {
    assert.equal(isExpired(null, SEKARANG), false);
    assert.equal(isExpired("bukan-tanggal", SEKARANG), false);
  });
});

describe("isExpiringSoon", () => {
  it("dalam 30 hari dianggap segera kedaluwarsa", () => {
    assert.equal(isExpiringSoon("2026-10-10", SEKARANG), true);
  });

  it("di luar 30 hari tidak dianggap", () => {
    assert.equal(isExpiringSoon("2027-05-01", SEKARANG), false);
  });
});

describe("ringkasStok", () => {
  it("memisahkan jumlah layak dan kedaluwarsa", () => {
    const ringkasan = ringkasStok(
      [
        { quantity: 5, expiredDate: "2026-08-01" },
        { quantity: 7, expiredDate: "2027-01-01" },
      ],
      SEKARANG,
    );
    assert.equal(ringkasan.total, 12);
    assert.equal(ringkasan.kedaluwarsa, 5);
    assert.equal(ringkasan.layak, 7);
  });

  it("batch tanpa tanggal kedaluwarsa tetap layak", () => {
    const ringkasan = ringkasStok([{ quantity: 3, expiredDate: null }], SEKARANG);
    assert.equal(ringkasan.layak, 3);
    assert.equal(ringkasan.expiryTerdekat, null);
  });

  it("mengambil tanggal kedaluwarsa terdekat dari batch bersisa", () => {
    const ringkasan = ringkasStok(
      [
        { quantity: 1, expiredDate: "2026-10-10" },
        { quantity: 1, expiredDate: "2027-05-01" },
        { quantity: 0, expiredDate: "2026-09-30" },
      ],
      SEKARANG,
    );
    assert.equal(ringkasan.expiryTerdekat?.toISOString().slice(0, 10), "2026-10-10");
    assert.equal(ringkasan.segeraKedaluwarsa, true);
  });
});
