import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

// Tes penjaga tautan navigasi.
//
// Alasan tes ini ada (bukan teori): item menu "Invoice" di shell tenant menunjuk
// ke `/dashboard/billing/invoices` padahal rute itu tidak pernah ada — daftar
// invoice tinggal di `/dashboard/billing`. Keadaannya bertahan lintas beberapa
// rilis dan baru ketahuan dari log nginx produksi: 20 permintaan 404 dari satu
// tenant nyata yang mengklik menu tersebut. tsc, lint, dan build semuanya hijau
// karena sebuah string href tidak pernah diperiksa terhadap isi folder `app/`.
//
// Dua hal yang dijaga:
//   1. setiap href di menu tenant punya halaman `page.tsx` sungguhan;
//   2. href yang merupakan induk dari href lain wajib `exact: true` — tanpa itu
//      dua baris menu menyala bersamaan (cacat yang sudah diperbaiki manual
//      dua kali: "Pengaturan Toko" dan "Produk & Layanan").

const DIR_INI = dirname(fileURLToPath(import.meta.url));
const AKAR_SRC = resolve(DIR_INI, "..");
const BERKAS_CANGKANG = join(AKAR_SRC, "app", "(tenant)", "layout.tsx");
const BERKAS_NAV = join(AKAR_SRC, "components", "layout", "nav.ts");
const AKAR_TENANT = join(AKAR_SRC, "app", "(tenant)", "[tenantSlug]");

/** Kumpulkan path halaman dari folder `app/(tenant)/[tenantSlug]`. */
function halamanTenant(dir: string, basis = ""): string[] {
  const hasil: string[] = [];
  for (const entri of readdirSync(dir, { withFileTypes: true })) {
    if (!entri.isDirectory()) continue;
    // Segmen dinamis apa pun ([tenantSlug], [programId]) mewakili satu nilai.
    const segmen = entri.name.startsWith("[") ? "*" : entri.name;
    const path = `${basis}/${segmen}`;
    const namaBerkas = join(dir, entri.name, "page.tsx");
    try {
      readFileSync(namaBerkas, "utf8");
      hasil.push(path);
    } catch {
      // Tidak ada page.tsx di sini — teruskan menelusuri anak-anaknya.
    }
    hasil.push(...halamanTenant(join(dir, entri.name), path));
  }
  return hasil;
}

type Tautan = { href: string; exact: boolean };

/** Penanda opak untuk setiap `${...}` di dalam source yang dipindai. */
const TOKEN_INTERPOLASI = "@@interpolasi@@";

/** Ambil setiap objek item menu yang memuat `href: \`${basePath}/...\``. */
function tautanMenu(): Tautan[] {
  // Komentar baris dibuang lebih dulu: isinya menyebut kata "exact" dan contoh
  // path, dan tidak boleh ikut terbaca sebagai kode.
  // `${...}` diganti token opak — kurung akar di dalamnya membuat pemindai blok
  // `{ ... }` di bawah tidak cocok kalau tidak dibuang (ini sebab versi pertama
  // tes membaca nol tautan).
  const kode = readFileSync(BERKAS_CANGKANG, "utf8")
    .replace(/^[ \t]*\/\/.*$/gm, "")
    .replace(/\$\{[^}]*\}/g, TOKEN_INTERPOLASI);
  const hasil: Tautan[] = [];
  for (const blok of kode.match(/\{[^{}]*\}/g) ?? []) {
    const cocok = blok.match(/href:\s*`@@interpolasi@@([^`]*)`/);
    if (!cocok) continue;
    hasil.push({ href: cocok[1], exact: /\bexact:\s*true\b/.test(blok) });
  }
  return hasil;
}

/** Nama segmen yang boleh diklik di remah lokasi (dibaca dari `nav.ts`). */
function segmenBerLabel(): string[] {
  const isi = readFileSync(BERKAS_NAV, "utf8");
  const blok = isi.match(/SEGMEN_LABEL[^=]*=\s*\{([\s\S]*?)\n\}/);
  assert.ok(blok, "peta SEGMEN_LABEL tidak ditemukan di nav.ts");
  return [...blok[1].matchAll(/^\s*([a-zA-Z][\w-]*):/gm)].map((m) => m[1]);
}

const DAFTAR_TAUTAN = tautanMenu();
const DAFTAR_HALAMAN = halamanTenant(AKAR_TENANT);

describe("tautan menu shell tenant", () => {
  it("membaca item menu dari cangkang, bukan nol", () => {
    // Penjaga bagi penjaga: kalau regexParsing rusak, tes di bawah ikut "lulus"
    // sambil tidak memeriksa apa pun.
    assert.ok(DAFTAR_TAUTAN.length >= 10, `ditemukan ${DAFTAR_TAUTAN.length} tautan`);
  });

  it("setiap href menu menunjuk ke halaman yang benar-benar ada", () => {
    const belumAda = DAFTAR_TAUTAN.filter((tautan) => {
      // /dashboard/settings/users -> halaman /dashboard/settings/users
      return !DAFTAR_HALAMAN.some(
        (halaman) =>
          halaman === tautan.href ||
          // rute dengan segmen dinamis, mis. /program/[id]
          halaman.replace(/\*/g, "[...]") === tautan.href,
      );
    }).map((tautan) => tautan.href);

    assert.deepEqual(
      belumAda,
      [],
      `href menu tidak punya page.tsx: ${belumAda.join(", ")} (halaman tersedia: ${DAFTAR_HALAMAN.join(", ")})`,
    );
  });

  it("href induk diberi exact agar dua menu tidak menyala bersamaan", () => {
    const indukTanpaExact = DAFTAR_TAUTAN.filter(
      (tautan) =>
        !tautan.exact &&
        DAFTAR_TAUTAN.some(
          (lain) => lain.href !== tautan.href && lain.href.startsWith(`${tautan.href}/`),
        ),
    ).map((tautan) => tautan.href);

    assert.deepEqual(
      indukTanpaExact,
      [],
      `induk tanpa exact: ${indukTanpaExact.join(", ")} — itemAktif() akan menyalakan induk dan anaknya sekaligus`,
    );
  });
});

describe("remah lokasi tidak merakit tautan mati", () => {
  it("setiap segmen penengah yang berlabel punya halaman sendiri", () => {
    // Breadcrumbs (src/components/layout/breadcrumbs.tsx) merakit href dari
    // tiap awalan segmen dan hanya membuang remah yang TIDAK ada di
    // SEGMEN_LABEL. Artinya segmen pengelompok URL yang diberi label tapi tidak
    // punya page.tsx menghasilkan remah yang menunjuk ke 404 — persis cara
    // "Dashboard › Keuangan › Pengeluaran" meledak di produksi: folder
    // `keuangan` tidak punya halaman, hanya `keuangan/pengeluaran`.
    const berlabel = new Set(segmenBerLabel());
    assert.ok(berlabel.size >= 8, `label terbaca: ${[...berlabel].join(", ")}`);

    const remahMati = new Set<string>();
    for (const halaman of DAFTAR_HALAMAN) {
      const segmen = halaman.split("/").filter(Boolean);
      for (let i = 0; i < segmen.length - 1; i += 1) {
        // Hanya segmen dinamis ([id]) yang boleh mewakili apa pun; ia tidak
        // pernah muncul sebagai kunci SEGMEN_LABEL.
        if (segmen[i] === "*") continue;
        if (!berlabel.has(segmen[i])) continue;
        const awalan = `/${segmen.slice(0, i + 1).join("/")}`;
        if (!DAFTAR_HALAMAN.includes(awalan)) remahMati.add(`${awalan} (label "${segmen[i]}")`);
      }
    }

    assert.deepEqual(
      [...remahMati],
      [],
      `segmen berlabel tanpa page.tsx — remahnya jadi tautan 404: ${[...remahMati].join(", ")}. ` +
        "Entah buat halamannya, entah buang labelnya dari SEGMEN_LABEL.",
    );
  });
});
