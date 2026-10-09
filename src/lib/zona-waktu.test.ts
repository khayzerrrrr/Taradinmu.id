import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  akhirHariZona,
  awalHariZona,
  nomorHari,
  offsetZonaMs,
  zonaValid,
  ZONA_DEFAULT,
} from "./zona-waktu";

const SATU_HARI_MS = 24 * 60 * 60 * 1000;

describe("offsetZonaMs", () => {
  it("WIB +7 sepanjang tahun (tanpa musim panas)", () => {
    assert.equal(offsetZonaMs(new Date("2026-01-15T00:00:00Z"), "Asia/Jakarta"), 7 * 3600000);
    assert.equal(offsetZonaMs(new Date("2026-07-15T00:00:00Z"), "Asia/Jakarta"), 7 * 3600000);
  });

  it("Riyadh +3 sepanjang tahun, dan BUKAN +7 warisan asumsi lama", () => {
    // Ini yang membuat konstanta hardcode tidak bisa dipakai di produk global:
    // Saudi berada di +3, bukan di zona yang dulu jadi satu-satunya acuan.
    assert.equal(offsetZonaMs(new Date("2026-01-15T00:00:00Z"), "Asia/Riyadh"), 3 * 3600000);
    assert.equal(offsetZonaMs(new Date("2026-07-15T00:00:00Z"), "Asia/Riyadh"), 3 * 3600000);
  });

  it("mengikuti aturan daylight saving, bukan offset tetap", () => {
    // London: +1 di musim dingin, +0 di musim panas. Tabel offset manual akan
    // salah enam bulan setahun.
    const musimDingin = offsetZonaMs(new Date("2026-01-15T12:00:00Z"), "Europe/London");
    const musimPanas = offsetZonaMs(new Date("2026-07-15T12:00:00Z"), "Europe/London");
    assert.equal(musimDingin, 0);
    assert.equal(musimPanas, 3600000);
    assert.notEqual(musimDingin, musimPanas);
  });

  it("zona tak dikenal tidak melempar", () => {
    // Data hasil migrasi bisa membawa zona yang tidak dikenal runtime. Halaman
    // yang sedang dibuka pengguna tidak boleh gagal karena itu.
    assert.equal(offsetZonaMs(new Date("2026-10-09T00:00:00Z"), "Bukan/Zona"), 0);
  });

  it("milidetik pada titik tidak menggeser offset", () => {
    const polos = new Date("2026-10-09T12:00:00.000Z");
    const berkeping = new Date("2026-10-09T12:00:00.750Z");
    assert.equal(offsetZonaMs(polos, "Asia/Jakarta"), offsetZonaMs(berkeping, "Asia/Jakarta"));
  });
});

describe("nomorHari", () => {
  it("hari WIB yang berbeda dari hari UTC", () => {
    // 23:30 UTC = 06:30 keesokan hari di WIB. Server yang menghitung dari UTC
    // akan bilang "hari ini" padahal penyewa sudah bangun besok.
    const titik = new Date("2026-10-09T23:30:00Z");
    assert.equal(nomorHari(titik, "UTC") - nomorHari(titik, "Asia/Jakarta"), -SATU_HARI_MS);
  });

  it("sebelum tengah malam WIB masih hari yang sama", () => {
    const titik = new Date("2026-10-09T10:00:00Z"); // 17:00 WIB
    assert.equal(
      nomorHari(titik, "UTC"),
      nomorHari(titik, "Asia/Jakarta"),
    );
  });

  it("Riyadh bergeser +3, bukan +7", () => {
    const titik = new Date("2026-10-09T23:30:00Z"); // 02:30 keesokan hari di Riyadh
    assert.equal(
      nomorHari(titik, "Asia/Riyadh") - nomorHari(titik, "UTC"),
      SATU_HARI_MS,
    );
  });

  it("nomor hari selalu tengah malam UTC yang rapi", () => {
    const hasil = nomorHari(new Date("2026-10-09T05:00:00Z"), "Asia/Jakarta");
    assert.equal(new Date(hasil).getUTCHours(), 0);
    assert.equal(new Date(hasil).getUTCMinutes(), 0);
  });
});

describe("awalHariZona", () => {
  it("mengembalikan Date, bukan angka", () => {
    const hasil = awalHariZona(new Date("2026-10-09T20:00:00Z"), "Asia/Jakarta");
    assert.ok(hasil instanceof Date);
    assert.equal(hasil.getUTCHours(), 0);
  });

  it("memakai zona bawaan tanpa argumen", () => {
    const denganArgumen = awalHariZona(new Date("2026-10-09T20:00:00Z"), ZONA_DEFAULT);
    const tanpaArgumen = awalHariZona(new Date("2026-10-09T20:00:00Z"));
    assert.equal(+denganArgumen, +tanpaArgumen);
  });
});

describe("akhirHariZona", () => {
  it("hari terakhir dilayani sampai 23:59:59.999 zona itu", () => {
    const hari = new Date("2026-10-09T00:00:00Z"); // admin mengetik "9 Okt"
    const akhir = akhirHariZona(hari, "Asia/Jakarta");
    // 9 Okt 23:59:59.999 WIB = 9 Okt 16:59:59.999 UTC
    const batasUtc = new Date("2026-10-09T17:00:00Z").getTime();
    assert.equal(akhir, batasUtc - 1);
  });

  it("satu menit sebelumnya masih sah, satu milidetik sesudahnya sudah lewat", () => {
    const hari = new Date("2026-10-09T00:00:00Z");
    const akhir = akhirHariZona(hari, "Asia/Jakarta");
    assert.ok(new Date(akhir).getTime() <= akhir, "tepat di batas masih sah");
    assert.ok(new Date(akhir + 1).getTime() > akhir, "satu milidetik kemudian sudah lewat");
  });

  it("beda zona menghasilkan batas yang beda, bukan asal memakai +7", () => {
    const hari = new Date("2026-10-09T00:00:00Z");
    assert.notEqual(akhirHariZona(hari, "Asia/Jakarta"), akhirHariZona(hari, "Asia/Riyadh"));
  });
});

describe("zonaValid", () => {
  it("menerima zona IANA yang dikenal", () => {
    assert.equal(zonaValid("Asia/Jakarta"), true);
    assert.equal(zonaValid("Asia/Riyadh"), true);
    assert.equal(zonaValid("Europe/London"), true);
  });

  it("menolak zona yang tidak ada", () => {
    assert.equal(zonaValid("Bukan/Zona"), false);
    assert.equal(zonaValid(""), false);
  });
});
