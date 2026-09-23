import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HEX_COLOR_PATTERN,
  rasioKontras,
  resolveBranding,
  warnaSolid,
} from "./branding";

// Aturan kontras di sini pernah menjadi masalah nyata: #059669 hanya 3.77:1 di
// atas putih dan gagal WCAG AA, sehingga lahirlah --primary-solid. Tes ini
// menjaga agar "zona mati" itu tidak kembali.

describe("warnaSolid", () => {
  it("warna di zona mati WCAG digelapkan sampai lolos AA", () => {
    const hasil = warnaSolid("#059669");
    assert.ok(
      rasioKontras(hasil, "#ffffff") >= 4.5,
      `kontras ${rasioKontras(hasil, "#ffffff")} belum mencapai 4.5`,
    );
  });

  it("warna yang sudah lolos tidak diubah", () => {
    assert.equal(warnaSolid("#0f172a"), "#0f172a");
  });

  it("warna terang dibiarkan (teksnya yang digelapkan)", () => {
    assert.equal(warnaSolid("#fef3c7"), "#fef3c7");
  });
});

describe("pola warna heksadesimal", () => {
  it("menerima enam digit", () => {
    assert.equal(HEX_COLOR_PATTERN.test("#078360"), true);
    assert.equal(HEX_COLOR_PATTERN.test("#ABCDEF"), true);
  });

  it("menolak bentuk lain", () => {
    assert.equal(HEX_COLOR_PATTERN.test("078360"), false);
    assert.equal(HEX_COLOR_PATTERN.test("#abc"), false);
    assert.equal(HEX_COLOR_PATTERN.test("merah"), false);
  });
});

describe("resolveBranding", () => {
  it("mengabaikan warna & logo kustom pada paket FREE", () => {
    const branding = resolveBranding({
      plan: "FREE",
      primaryColor: "#123456",
      customLogoUrl: "data:image/png;base64,AAA",
    });
    assert.notEqual(branding.accentColor, "#123456");
    assert.equal(branding.logoUrl, null);
    assert.equal(branding.isCustomLogo, false);
    assert.equal(branding.isPro, false);
  });

  it("menerapkan warna & logo kustom pada PRO", () => {
    const branding = resolveBranding({
      plan: "PRO",
      primaryColor: "#123456",
      customLogoUrl: "data:image/png;base64,AAA",
    });
    assert.equal(branding.accentColor, "#123456");
    assert.equal(branding.logoUrl, "data:image/png;base64,AAA");
    assert.equal(branding.isCustomLogo, true);
  });

  it("mengabaikan warna kustom yang tidak valid", () => {
    const branding = resolveBranding({
      plan: "PRO",
      primaryColor: "merah",
      customLogoUrl: null,
    });
    assert.notEqual(branding.accentColor, "merah");
  });
});
