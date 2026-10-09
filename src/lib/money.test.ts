import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  desimalMataUang,
  formatAngka,
  formatUang,
  MATA_UANG_DEFAULT,
} from "./money";

describe("desimalMataUang", () => {
  it("IDR dan JPY tampil tanpa desimal", () => {
    // Subunit IDR (sen) tidak dipakai sehari-hari. Menampilkan "Rp 1.000,00"
    // hanya menambah noise di kartu metrik.
    assert.equal(desimalMataUang("IDR"), 0);
    assert.equal(desimalMataUang("JPY"), 0);
  });

  it("mata uang umum tampil dua desimal", () => {
    assert.equal(desimalMataUang("USD"), 2);
    assert.equal(desimalMataUang("EUR"), 2);
    assert.equal(desimalMataUang("MYR"), 2);
  });

  it("mata uang teluk tiga desimal", () => {
    // Dinar punya subunit yang benar-benar dipakai, jadi dua desimal akan
    // membulatkan-nol nominal yang tidak nol.
    assert.equal(desimalMataUang("BHD"), 3);
    assert.equal(desimalMataUang("KWD"), 3);
  });

  it("huruf kecil tetap dikenali", () => {
    assert.equal(desimalMataUang("usd"), 2);
    assert.equal(desimalMataUang("idr"), 0);
  });

  it("mata uang tak dikenal jatuh ke default, tidak melempar", () => {
    // Migrasi data bisa membawa kode yang tidak kita kenal. Menampilkan dengan
    // default lebih baik daripada membiarkan halaman gagal render.
    assert.equal(desimalMataUang("XYZ"), 2);
  });

  it("default aplikasi adalah rupiah", () => {
    assert.equal(MATA_UANG_DEFAULT, "IDR");
    assert.equal(desimalMataUang(MATA_UANG_DEFAULT), 0);
  });
});

describe("formatUang", () => {
  it("memakai simbol mata uang yang diminta", () => {
    assert.match(formatUang(1000, "IDR"), /Rp/);
    assert.match(formatUang(1000, "USD"), /\$|US\$/);
  });

  it("nominal tak diketahui bukan nol", () => {
    // NaN yang ditampilkan sebagai "Rp 0" berarti pembukuan menyatakan "memang
    // nol". Itu klaim berbeda dari "belum dihitung".
    assert.equal(formatUang(NaN, "IDR"), "—");
    assert.equal(formatUang(Infinity, "IDR"), "—");
    assert.equal(formatUang("bukan angka", "IDR"), "—");
  });

  it("menerima string Decimal dari database", () => {
    assert.match(formatUang("56000000", "IDR"), /56/);
  });

  it("IDR bulat, USD bisa berdesimal", () => {
    // Desimal yang ditampilkan boleh lebih sedikit dari yang tersimpan:
    // maximumFractionDigits mengatur tampilan, bukan data.
    const idr = formatUang(1234.5, "IDR");
    assert.ok(!idr.includes("50"), `IDR tidak boleh menampilkan sen: ${idr}`);
    assert.match(formatUang(1234.5, "USD"), /4?5|4,50|\.50/);
  });

  it("tanpa argumen memakai default, tidak melempar", () => {
    assert.match(formatUang(1000), /Rp/);
  });
});

describe("formatAngka", () => {
  it("tanpa simbol mata uang", () => {
    const hasil = formatAngka(1234567, "IDR");
    assert.ok(!hasil.includes("Rp"), `tidak boleh ada simbol: ${hasil}`);
    assert.match(hasil, /1/);
  });

  it("tak diketahui tetap tanda hubung", () => {
    assert.equal(formatAngka(NaN, "IDR"), "—");
  });
});
