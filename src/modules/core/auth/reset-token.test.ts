import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PREFIX_TOKEN_RESET, hashTokenReset, identifierReset } from "./reset-token";

// Baris VerificationToken di database sudah berisi hash buatan fungsi ini.
// Mengganti algoritma atau prefix membuat tautan reset yang sedang hidup berhenti
// dikenali — dan itu baru ketahuan saat ada orang yang sedang tidak bisa masuk
// ke akunnya sendiri. Maka bentuknya dikunci di sini.

describe("hashTokenReset", () => {
  it("tetap SHA-256 dalam hex, seperti nilai yang sudah tersimpan di database", () => {
    // Vektor baku, dihitung ulang langsung dengan node:crypto.
    assert.equal(
      hashTokenReset("abc"),
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("memakai prefix sebagai bagian dari identifier, bukan dari yang di-hash", () => {
    // Yang di-hash hanya token mentahnya; identifier memisahkan baris ini dari
    // token Auth.js lain. Tukar keduanya dan pencocokan akan gagal.
    assert.equal(identifierReset("u_abc"), "reset-sandi:u_abc");
    assert.equal(
      hashTokenReset(identifierReset("u_abc")).length,
      64,
      "hex SHA-256 selalu 64 karakter",
    );
  });

  it("berbeda untuk token yang berbeda", () => {
    assert.notEqual(hashTokenReset("token-satu"), hashTokenReset("token-dua"));
  });
});

describe("PREFIX_TOKEN_RESET", () => {
  it("nilainya tidak berubah dari yang sudah tertulis di baris database", () => {
    assert.equal(PREFIX_TOKEN_RESET, "reset-sandi:");
  });
});
