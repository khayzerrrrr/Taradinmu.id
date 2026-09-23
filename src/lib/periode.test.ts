import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  awalBulan,
  labelPeriode,
  labelPeriodeBulanan,
  periodeDari,
} from "./periode";

// Batas bulan dipakai oleh kuota invoice, laporan keuangan, dan riwayat zakat —
// selisih satu bulan saja membuat angka antar halaman berbeda.

describe("awalBulan", () => {
  it("memakai tengah malam UTC pada tanggal 1", () => {
    const hasil = awalBulan(new Date("2026-09-23T17:45:00.000Z"));
    assert.equal(hasil.toISOString(), "2026-09-01T00:00:00.000Z");
  });

  it("tidak mundur untuk tanggal 31", () => {
    const hasil = awalBulan(new Date("2026-01-31T23:59:59.000Z"));
    assert.equal(hasil.toISOString(), "2026-01-01T00:00:00.000Z");
  });

  it("tidak bergeser karena zona waktu lokal", () => {
    // 1 Januari 00:30 UTC masih Januari, walau di WIB sudah lewat tengah malam.
    const hasil = awalBulan(new Date("2026-01-01T00:30:00.000Z"));
    assert.equal(hasil.toISOString(), "2026-01-01T00:00:00.000Z");
  });
});

describe("periodeDari", () => {
  it("Desember tetap di tahun yang sama", () => {
    assert.deepEqual(periodeDari(new Date("2026-12-31T23:00:00.000Z")), {
      tahun: 2026,
      bulan: 12,
    });
  });

  it("Januari tidak mundur ke tahun sebelumnya", () => {
    assert.deepEqual(periodeDari(new Date("2027-01-01T00:00:00.000Z")), {
      tahun: 2027,
      bulan: 1,
    });
  });

  it("bulan satu digit ditulis dua digit", () => {
    assert.equal(labelPeriode(new Date("2026-03-05T00:00:00.000Z")), "2026-03");
    assert.equal(
      labelPeriodeBulanan(new Date("2026-03-05T00:00:00.000Z")),
      "03/2026",
    );
  });
});
