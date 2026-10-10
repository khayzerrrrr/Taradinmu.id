import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { periodSchema } from "./period-schema";

// Skema periode menentukan baris AccountingPeriod mana yang ditulis saat tutup
// buku. Nilai yang lolos tetapi tidak cocok dengan `JournalEntry.period` membuat
// penutupan periode terlihat berhasil tanpa menahan satu pun jurnal.

describe("skema periode akuntansi", () => {
  it("menerima format YYYY-MM dengan bulan 01-12", () => {
    assert.equal(periodSchema.safeParse("2026-10").success, true);
    assert.equal(periodSchema.safeParse("2026-01").success, true);
    assert.equal(periodSchema.safeParse("2026-12").success, true);
  });

  it("menolak bulan di luar 01-12", () => {
    for (const salah of ["2026-13", "2026-00", "2026-99"]) {
      assert.equal(periodSchema.safeParse(salah).success, false, salah);
    }
  });

  it("menolak bentuk yang tidak lengkap atau salah pemisah", () => {
    for (const salah of [
      "2026-1",
      "2026/10",
      "abc",
      "",
      "26-10",
      "2026-10-01",
    ]) {
      assert.equal(periodSchema.safeParse(salah).success, false, salah);
    }
  });
});