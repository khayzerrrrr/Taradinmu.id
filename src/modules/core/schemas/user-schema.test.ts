import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resetSandiAkunSchema } from "./user-schema";

// Aturan validasi jalur pemulihan akun (PRD 4.B). Sengaja diuji terpisah dari
// aksi-nya: fungsi ini satu-satunya pagar antara input bebas dari form Super
// Admin dan kolom User.password di database produksi.

describe("resetSandiAkunSchema", () => {
  const sah = {
    email: "pemilik@toko.id",
    password: "SandiBaru123",
    konfirmasi: "SandiBaru123",
  };

  it("menerima isian lengkap yang cocok", () => {
    assert.equal(resetSandiAkunSchema.safeParse(sah).success, true);
  });

  it("memangkas spasi di sekeliling email", () => {
    const hasil = resetSandiAkunSchema.safeParse({ ...sah, email: "  pemilik@toko.id  " });
    assert.equal(hasil.success, true);
    if (hasil.success) assert.equal(hasil.data.email, "pemilik@toko.id");
  });

  it("menolak email yang bukan email", () => {
    assert.equal(resetSandiAkunSchema.safeParse({ ...sah, email: "pemilik@" }).success, false);
  });

  it("menolak sandi di bawah 8 karakter", () => {
    assert.equal(
      resetSandiAkunSchema.safeParse({ ...sah, password: "abc1234", konfirmasi: "abc1234" })
        .success,
      false,
    );
  });

  it("menerima tepat 72 karakter dan menolak lebih — batas bcrypt", () => {
    for (const [panjang, diharapkan] of [
      [72, true],
      [73, false],
    ] as const) {
      const sandi = "a".repeat(panjang);
      assert.equal(
        resetSandiAkunSchema.safeParse({ ...sah, password: sandi, konfirmasi: sandi }).success,
        diharapkan,
        `sandi ${panjang} karakter`,
      );
    }
  });

  it("menolak konfirmasi yang berbeda, dan menandai fieldnya", () => {
    const hasil = resetSandiAkunSchema.safeParse({ ...sah, konfirmasi: "TersalahKetik" });
    assert.equal(hasil.success, false);
    if (hasil.success) assert.fail("seharusnya ditolak");
    assert.deepEqual(hasil.error.issues[0].path, ["konfirmasi"]);
  });

  it("tidak bisa dilewati dengan mengosongkan konfirmasi", () => {
    assert.equal(
      resetSandiAkunSchema.safeParse({ ...sah, konfirmasi: "" }).success,
      false,
    );
  });
});
