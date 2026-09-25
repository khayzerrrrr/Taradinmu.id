import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  rencanaAlokasiFefo,
  StokTidakCukupError,
  type CalonBatch,
} from "./stock-allocation";

const SEKARANG = new Date("2026-09-24T12:00:00.000Z");

const batch = (
  id: string,
  quantity: number,
  expiredDate: string | null,
  costPrice: number | null = null,
): CalonBatch => ({
  id,
  batchNumber: `B-${id}`,
  quantity,
  expiredDate: expiredDate ? new Date(expiredDate) : null,
  costPrice,
});

describe("rencanaAlokasiFefo", () => {
  it("memakai batch berurut FEFO sampai jumlah terpenuhi", () => {
    const rencana = rencanaAlokasiFefo(
      [
        batch("a", 3, "2026-10-01"),
        batch("b", 5, "2026-11-01"),
        batch("c", 9, null),
      ],
      6,
      SEKARANG,
    );

    assert.deepEqual(
      rencana.map((item) => [item.batchId, item.quantity]),
      [
        ["a", 3],
        ["b", 3],
      ],
    );
  });

  it("tidak menyentuh batch setelah jumlah tercukupi", () => {
    const rencana = rencanaAlokasiFefo(
      [batch("a", 10, "2026-10-01", 1000), batch("b", 10, "2026-11-01", 1200)],
      4,
      SEKARANG,
    );
    assert.equal(rencana.length, 1);
    assert.equal(rencana[0]?.quantity, 4);
  });

  it("melewati batch kedaluwarsa walau stok totalnya cukup", () => {
    const rencana = rencanaAlokasiFefo(
      [
        batch("busuk", 50, "2026-09-01"),
        batch("baik", 5, "2026-10-01"),
      ],
      5,
      SEKARANG,
    );
    assert.deepEqual(
      rencana.map((item) => item.batchId),
      ["baik"],
    );
  });

  it("batch yang kedaluwarsa hari ini masih layak dipakai", () => {
    const rencana = rencanaAlokasiFefo(
      [batch("a", 2, "2026-09-24", 500)],
      2,
      SEKARANG,
    );
    assert.equal(rencana.length, 1);
  });

  it("kekurangan dilaporkan terpisah dari stok kedaluwarsa", () => {
    assert.throws(
      () =>
        rencanaAlokasiFefo(
          [batch("busuk", 7, "2026-09-01"), batch("baik", 2, "2026-10-01")],
          5,
          SEKARANG,
        ),
      (error: unknown) => {
        assert.ok(error instanceof StokTidakCukupError);
        assert.equal(error.stokLayak, 2);
        assert.equal(error.stokKedaluwarsa, 7);
        // Stok busuk tidak boleh membuat pesannya seolah-olah stok tersedia.
        assert.match(error.message, /2 unit/);
        assert.match(error.message, /7 unit lain sudah kedaluwarsa/);
        return true;
      },
    );
  });

  it("jumlah nol tidak mengambil batch apa pun", () => {
    assert.deepEqual(rencanaAlokasiFefo([batch("a", 5, null)], 0, SEKARANG), []);
  });

  // Inti PRD 4.G.3: modal yang keluar adalah potret harga batch saat itu.
  it("mencatat unitCost batch asal untuk tiap potongan", () => {
    const rencana = rencanaAlokasiFefo(
      [
        batch("a", 3, "2026-10-01", 1000),
        batch("b", 3, "2026-11-01", 1500),
      ],
      5,
      SEKARANG,
    );

    assert.deepEqual(
      rencana.map((item) => [item.batchId, item.quantity, item.unitCost]),
      [
        ["a", 3, 1000],
        ["b", 2, 1500],
      ],
    );
  });

  it("batch tanpa harga modal menghasilkan unitCost null, bukan 0", () => {
    const rencana = rencanaAlokasiFefo([batch("a", 3, null)], 2, SEKARANG);
    assert.equal(rencana[0]?.unitCost, null);
  });

  it("memakai batch tanpa tanggal kedaluwarsa bila itulah yang tersisa", () => {
    const rencana = rencanaAlokasiFefo(
      [batch("ada-tanggal", 1, "2026-10-01", 900), batch("tanpa", 4, null, 800)],
      4,
      SEKARANG,
    );
    assert.deepEqual(
      rencana.map((item) => [item.batchId, item.quantity]),
      [
        ["ada-tanggal", 1],
        ["tanpa", 3],
      ],
    );
  });
});
