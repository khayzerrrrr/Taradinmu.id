import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { catatError, catatPeringatan } from "./log";

// Pencatatan error ikut memuat pesan mentah dari Prisma/Postgres, yang kerap
// menyisipkan nilai kolom. Kalau penyamaran ini bocor, log server berisi kata
// sandi dan token pengguna — jauh lebih berbahaya daripada tidak punya log sama
// sekali. Maka dikunci dengan tes.

type Catatan = { level: "error" | "warn"; baris: string };

const hasil: Catatan[] = [];
let errorAsli = console.error;
let warnAsli = console.warn;

beforeEach(() => {
  hasil.length = 0;
  errorAsli = console.error;
  warnAsli = console.warn;
  console.error = (teks: unknown) => {
    hasil.push({ level: "error", baris: String(teks) });
  };
  console.warn = (teks: unknown) => {
    hasil.push({ level: "warn", baris: String(teks) });
  };
});

afterEach(() => {
  console.error = errorAsli;
  console.warn = warnAsli;
});

function satuBaris(): Record<string, string> {
  assert.equal(hasil.length, 1, "tepat satu baris log yang diharapkan");
  return JSON.parse(hasil[0].baris) as Record<string, string>;
}

describe("catatError", () => {
  it("memakai satu baris JSON agar mudah dibaca mesin", () => {
    catatError(new Error("gagal"));
    const baris = hasil[0].baris;
    assert.equal(baris.includes("\n"), false, "satu kejadian tidak boleh berpencar");
    assert.equal(baris.startsWith("{"), true);
  });

  it("mencatat nama, pesan, dan waktu", () => {
    catatError(new TypeError("koneksi database terputus"));
    const log = satuBaris();
    assert.equal(log.level, "error");
    assert.equal(log.nama, "TypeError");
    assert.equal(log.pesan, "koneksi database terputus");
    assert.equal(typeof log.waktu, "string");
    assert.ok(log.waktu.endsWith("Z"));
  });

  it("meratakan newline pada stack supaya tetap satu baris", () => {
    const error = new Error("berjala");
    error.stack = "Error: berjala\n    di a.ts:1:1\n    di b.ts:2:2";
    catatError(error);
    const log = satuBaris();
    assert.equal(log.stack.includes("\n"), false);
    assert.ok(log.stack.length > 0);
  });

  it("menerima error non-Error tanpa membuat JSON rusak", () => {
    catatError("teks mentah");
    const log = satuBaris();
    assert.equal(log.nama, "NonError");
    assert.equal(log.pesan, "teks mentah");
  });

  it("memotong pesan panjang", () => {
    catatError(new Error("x".repeat(5000)));
    const log = satuBaris();
    assert.ok(log.pesan.length <= 600, `pesan tidak terpotong: ${log.pesan.length}`);
    assert.ok(log.pesan.endsWith("…"));
  });
});

describe("penyamaran nilai rahasia", () => {
  // Ragam bentuk yang nyata muncul di pesan Prisma/Postgres dan driver.
  const KASUS: ReadonlyArray<[nama: string, masukan: string, tidakBolehMuncul: string]> =
    [
      ["password asign", "update set password=RahasiaBuatan123", "RahasiaBuatan123"],
      ["password kolom", "duplicate key (password: RahasiaBuatan123)", "RahasiaBuatan123"],
      ["sandi bentuk Indonesia", "sandi: RahasiaBuatan123", "RahasiaBuatan123"],
      [
        "Authorization dengan skema Bearer",
        "Authorization: Bearer abc.def.ghi",
        "abc.def.ghi",
      ],
      ["Authorization tanpa skema", "authorization=abc.def.ghi", "abc.def.ghi"],
      ["api key", "api_key=sk-live-999", "sk-live-999"],
      ["cookie", "Set-Cookie: sesi=12345", "12345"],
      ["huruf besar", "PASSWORD: RahasiaBuatan123", "RahasiaBuatan123"],
    ];

  for (const [nama, masukan, bocor] of KASUS) {
    it(`menyamarkan ${nama}`, () => {
      catatError(new Error(masukan));
      const baris = hasil[0].baris;
      assert.equal(
        baris.includes(bocor),
        false,
        `nilai rahasia bocor ke log (${nama}): "${bocor}"`,
      );
      assert.equal(baris.includes("tersamar"), true);
    });
  }

  it("menyamarkan di stack juga, bukan hanya di pesan", () => {
    const error = new Error("ok");
    error.stack = "Error: ok\n  at simpan password=SangatRahasia42\n  di x.ts:9:9";
    catatError(error);
    assert.equal(hasil[0].baris.includes("SangatRahasia42"), false);
  });

  it("tidak menyamarkan pesan biasa yang kebetulan menyebut kata sensitif", () => {
    // "email sudah terpakai" harus tetap terbaca utuh saat menyelidiki insiden.
    catatError(new Error("Email toko@example.com sudah dipakai tenant lain"));
    const log = satuBaris();
    assert.equal(log.pesan, "Email toko@example.com sudah dipakai tenant lain");
  });
});

describe("konteks", () => {
  it("menyertakan aksi dan tenantId saat diberikan", () => {
    catatError(new Error("gagal"), { aksi: "createInvoice", tenantId: "t_1" });
    const log = satuBaris();
    assert.equal(log.aksi, "createInvoice");
    assert.equal(log.tenantId, "t_1");
  });

  it("menyertakan jejak audit aktorId/targetId", () => {
    // Reset kata sandi oleh Super Admin dicatat lewat jalur ini: tanpa kedua
    // field, log tidak bisa menjawab "siapa mengubah akses siapa".
    catatPeringatan("Kata sandi akun direset oleh Super Admin", {
      aksi: "resetKataSandiAkun",
      aktorId: "u_admin",
      targetId: "u_pemilik",
      tenantId: "t_1",
    });
    const log = satuBaris();
    assert.equal(log.level, "warn");
    assert.equal(log.aktorId, "u_admin");
    assert.equal(log.targetId, "u_pemilik");
    assert.equal(log.tenantId, "t_1");
  });

  it("tetap valid tanpa konteks (44 call site lama tidak berubah)", () => {
    catatError(new Error("gagal"));
    assert.doesNotThrow(() => satuBaris());
  });
});

describe("catatPeringatan", () => {
  it("masuk ke console.warn dengan level warn", () => {
    catatPeringatan("kuota hampir penuh", { tenantId: "t_1" });
    const log = satuBaris();
    assert.equal(log.level, "warn");
    assert.equal(log.pesan, "kuota hampir penuh");
  });
});
