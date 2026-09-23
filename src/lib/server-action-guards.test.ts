import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

// Tes penjaga struktur Server Action.
//
// Alasan tes ini ada: aturan "setiap Server Action wajib melewati gerbang tenant"
// selama ini hanya dijaga oleh disiplin manusia. ROADMAP §1 mencatat insiden nyata
// di repo ini — berkas tertimpa dan rute berpindah tanpa disadari. Sebuah refactor
// yang menghapus satu baris `const akses = await aksesTenant()` tidak akan
// menggagalkan tsc, lint, maupun build: halaman tetap tampil, hanya tanpa izin.
//
// Tes ini membaca berkas dari disk dan memeriksa tiga hal:
//   1. setiap fungsi yang diekspor dari `*-actions.ts` memanggil gerbang;
//   2. setiap pembungkus lokal `aksesXxx()` benar-benar memanggil gerbang platform;
//   3. berkas yang dikecualikan (memang publik) benar-benar ada.
// Dengan begitu rantai "action -> pembungkus -> gerbang platform" utuh seluruhnya.

const DIR_INI = dirname(fileURLToPath(import.meta.url));
const AKAR_SRC = resolve(DIR_INI, "..");
const DIR_MODUL = join(AKAR_SRC, "modules");

// Gerbang platform: satu-satunya sumber keputusan izin.
const GERBANG_PLATFORM = [
  /\bassertTenantMember\s*\(/,
  /\bassertTenantOwner\s*\(/,
  /\bassertTenantUserManager\s*\(/,
  /\bassertSuperAdmin\s*\(/,
];

// Pembungkus lokal per modul yang meneruskan ke gerbang platform.
const GERBANG_LOKAL = [
  /\baksesTenant\s*\(\s*\)/,
  /\baksesKeuangan\s*\(\s*\)/,
  /\baksesPengguna\s*\(\s*\)/,
  /\baksesZakat\s*\(\s*\)/,
];

// Berkas Server Action yang memang TIDAK boleh memakai gerbang tenant, karena
// dipanggil justru ketika belum ada sesi. Setiap pengecualian wajib beralasan.
const BERKAS_PUBLIK = new Map<string, string>([
  [
    "core/actions/auth-actions.ts",
    "Masuk dan keluar: belum ada sesi yang bisa diperiksa.",
  ],
  [
    "core/actions/register-actions.ts",
    "Pendaftaran tenant baru: pemanggilnya belum punya akun.",
  ],
  [
    "core/actions/password-reset-actions.ts",
    "Memakai token sekali pakai, justru untuk pengguna yang tidak bisa masuk.",
  ],
]);

// Awal deklarasi tingkat atas (kolom 0). Dipakai untuk memotong badan fungsi:
// dari satu deklarasi sampai deklarasi berikutnya. Badan fungsi yang menjorok ke
// dalam tidak akan cocok karena polanya berjangkar di kolom 0.
const AWAL_DEKLARASI =
  /^(?:export\s+)?(?:declare\s+)?(?:async\s+)?(?:function|const|let|var|type|interface|class|enum)\b/;

function potongBadan(teks: string, mulaiIdx: number): string {
  const baris = teks.slice(mulaiIdx).split("\n");
  for (let i = 1; i < baris.length; i++) {
    if (AWAL_DEKLARASI.test(baris[i])) {
      return baris.slice(0, i).join("\n");
    }
  }
  return baris.join("\n");
}

function cocok(pola: readonly RegExp[], teks: string): boolean {
  return pola.some((p) => p.test(teks));
}

// Kumpulkan berkas di src/modules secara rekursif, tanpa memandang pemisah path.
function berkasDi(ekstensi: string): string[] {
  return readdirSync(DIR_MODUL, { recursive: true, encoding: "utf8" })
    .map((jalur) => jalur.split("\\").join("/"))
    .filter((jalur) => jalur.endsWith(ekstensi));
}

const BERKAS_ACTIONS = berkasDi("-actions.ts");

describe("penjaga struktur Server Action", () => {
  it("menemukan berkas untuk diperiksa (tes tidak hijau karena memindai nol berkas)", () => {
    assert.ok(
      BERKAS_ACTIONS.length >= 10,
      `hanya menemukan ${BERKAS_ACTIONS.length} berkas action — pemindaiannya sendiri yang rusak`,
    );
  });

  it("setiap fungsi yang diekspor dari *-actions.ts memanggil gerbang izin", () => {
    const pelanggaran: string[] = [];
    let diperiksa = 0;

    for (const jalurRelatif of BERKAS_ACTIONS) {
      if (BERKAS_PUBLIK.has(jalurRelatif)) continue;

      const teks = readFileSync(join(DIR_MODUL, jalurRelatif), "utf8");
      const polaDeklarasi = /^export async function\s+(\w+)/gm;
      let kecocokan: RegExpExecArray | null;

      while ((kecocokan = polaDeklarasi.exec(teks)) !== null) {
        const badan = potongBadan(teks, kecocokan.index);
        diperiksa += 1;
        if (!cocok([...GERBANG_PLATFORM, ...GERBANG_LOKAL], badan)) {
          pelanggaran.push(`${jalurRelatif} -> ${kecocokan[1]}()`);
        }
      }
    }

    assert.ok(
      diperiksa >= 20,
      `hanya ${diperiksa} fungsi yang diperiksa — pemotongan badan fungsi tampaknya gagal`,
    );
    assert.deepEqual(
      pelanggaran,
      [],
      `Server Action tanpa gerbang izin:\n  ${pelanggaran.join("\n  ")}`,
    );
  });

  it("setiap pembungkus lokal aksesXxx() memanggil gerbang platform", () => {
    const pelanggaran: string[] = [];
    let diperiksa = 0;

    for (const jalurRelatif of BERKAS_ACTIONS) {
      const teks = readFileSync(join(DIR_MODUL, jalurRelatif), "utf8");
      // Pembungkus lokal tidak diekspor (mis. `async function aksesKeuangan()`).
      const polaPembungkus = /^async function\s+(akses\w+)\s*\(/gm;
      let kecocokan: RegExpExecArray | null;

      while ((kecocokan = polaPembungkus.exec(teks)) !== null) {
        const badan = potongBadan(teks, kecocokan.index);
        diperiksa += 1;
        if (!cocok(GERBANG_PLATFORM, badan)) {
          pelanggaran.push(`${jalurRelatif} -> ${kecocokan[1]}()`);
        }
      }
    }

    assert.ok(diperiksa >= 3, `hanya ${diperiksa} pembungkus lokal yang ditemukan`);
    assert.deepEqual(
      pelanggaran,
      [],
      `Pembungkus lokal tanpa gerbang platform:\n  ${pelanggaran.join("\n  ")}`,
    );
  });

  it("pembungkus akses-tenant.ts tiap modul memanggil gerbang platform", () => {
    const berkasPembungkus = berkasDi("/akses-tenant.ts");
    assert.ok(
      berkasPembungkus.length >= 2,
      `hanya menemukan ${berkasPembungkus.length} pembungkus akses-tenant.ts`,
    );

    for (const jalurRelatif of berkasPembungkus) {
      const teks = readFileSync(join(DIR_MODUL, jalurRelatif), "utf8");
      assert.ok(
        cocok(GERBANG_PLATFORM, teks),
        `${jalurRelatif} tidak memanggil gerbang platform mana pun`,
      );
    }
  });

  it("tidak ada berkas publik yang sudah tidak ada (pengecualian basi)", () => {
    const semuaBerkas = new Set(berkasDi(".ts"));
    for (const [jalurRelatif, alasan] of BERKAS_PUBLIK) {
      assert.ok(
        semuaBerkas.has(jalurRelatif),
        `pengecualian "${jalurRelatif}" (${alasan}) sudah tidak ada — hapus dari daftar`,
      );
    }
  });

  it("berkas yang dikecualikan memang tidak memanggil gerbang platform", () => {
    // Bila suatu saat berkas publik justru dipagari, pengecualiannya harus dicabut
    // supaya tidak ada celah yang tak terlihat. Pinggiran, tetapi murah.
    for (const jalurRelatif of BERKAS_PUBLIK.keys()) {
      const teks = readFileSync(join(DIR_MODUL, jalurRelatif), "utf8");
      assert.equal(
        cocok(GERBANG_PLATFORM, teks),
        false,
        `${jalurRelatif} kini memanggil gerbang — cabut dari BERKAS_PUBLIK`,
      );
    }
  });
});
