import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

// Tes penjaga "janji freemium" (PRD 4.D).
//
// Alasan tes ini ada: tiga aturan di bawah ini tidak bisa ditegakkan oleh tsc.
//   1. harga PRO hanya boleh hidup di satu konstanta — salinan literal akan
//      tertinggal saat harga berubah, dan pengguna melihat dua angka berbeda;
//   2. modal upgrade hanya boleh menjual fitur yang benar-benar ada (PRD 4.D.2a)
//      — kalau tidak, PRO menjanjikan laporan yang belum dibangun;
//   3. angka yang dihitung dari data tenant sendiri tampil di paket FREE, dan
//      yang dikunci hanyalah aksinya (PRD 4.D: "kunci kemampuan, jangan
//      kunci kebenaran"). Menghapus satu baris `isLocked` di tempat yang salah
//      tidak menggagalkan build.
// Seperti tes struktural lain, ini membaca berkas dari disk.

const DIR_INI = dirname(fileURLToPath(import.meta.url));
const AKAR_SRC = resolve(DIR_INI, "..");

function baca(...segmen: string[]): string {
  return readFileSync(join(AKAR_SRC, ...segmen), "utf8");
}

/** Semua berkas sumber (ts/tsx), tanpa direktori hasil generate Prisma. */
function berkasSumber(dir: string, keluaran: string[] = []): string[] {
  for (const entri of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entri.name);
    if (entri.isDirectory()) {
      if (entri.name === "generated" || entri.name === "node_modules") continue;
      berkasSumber(path, keluaran);
    } else if (/\.tsx?$/.test(entri.name)) {
      keluaran.push(path);
    }
  }
  return keluaran;
}

const MODAL = ["components", "shared", "upgrade-modal.tsx"];
const GUARDS = ["lib", "feature-guards.ts"];
const SUMMARY = ["lib", "dashboard-summary.ts"];

describe("harga PRO satu sumber", () => {
  it("modal & pesan batas membaca HARGA_PRO_BULAN", () => {
    for (const berkas of [MODAL, GUARDS]) {
      const isi = baca(...berkas);
      assert.match(
        isi,
        /HARGA_PRO_BULAN/,
        `${berkas.join(sep)} harus mengimpor harga dari plan-limits`,
      );
      assert.ok(
        !/\b149/.test(isi),
        `${berkas.join(sep)} menyebut harga sebagai angka literal`,
      );
    }
  });

  it("tidak ada berkas sumber yang mengetik ulang harga", () => {
    // Pola "Rp 149" / "149.000" hanya boleh muncul di PRD/ROADMAP (markdown),
    // tidak di kode: tes ini merah begitu ada modal baru yang menghardcode harga.
    const pelanggar = berkasSumber(AKAR_SRC)
      .filter((path) => !path.endsWith(".test.ts"))
      .filter((path) => /Rp\s*149|149[.\s]000/.test(readFileSync(path, "utf8")))
      .map((path) => relative(AKAR_SRC, path));
    assert.deepEqual(pelanggar, []);
  });
});

describe("modal hanya menjual fitur yang ada", () => {
  // PRD 4.D.2a menandai tiap janji PRO ADA/BELUM. Yang BELUM dilarang muncul di
  // daftar manfaat, walau terdengar menjual.
  const DILARANG = [
    "cicilan",
    "multi-gudang",
    "gudang ganda",
    "neraca",
    "laporan arus kas",
    "subdomain",
    "favicon",
  ];

  function isiManfaat(): string {
    const modal = baca(...MODAL);
    const mulai = modal.indexOf("export const MANFAAT_KUNCI");
    const akhir = modal.indexOf("type Props");
    assert.ok(mulai > -1 && akhir > mulai, "blok MANFAAT_KUNCI tidak ditemukan");
    return modal
      .slice(mulai, akhir)
      .split("\n")
      // Komentar penulis sengaja dibuang: catatan "jangan jual cicilan" menyebut
      // kata terlarang itu justru untuk melarangnya.
      .filter((baris) => !baris.trim().startsWith("//"))
      .join("\n");
  }

  it("tidak menjual janji yang belum dibangun", () => {
    const manfaat = isiManfaat().toLowerCase();
    // Kontrol positif: kalau pemotongan blok ini gagal, isiManfaat() jadi kosong
    // dan tes di atas lolos tanpa memeriksa apa pun.
    assert.ok(
      manfaat.includes("fefo"),
      "blok manfaat kosong — tes larangan jadi tidak berarti",
    );
    for (const kata of DILARANG) {
      assert.ok(
        !manfaat.includes(kata),
        `daftar manfaat menyebut "${kata}" yang belum ada (PRD 4.D.2a)`,
      );
    }
  });

  it("setiap kunci punya daftar manfaat sendiri", () => {
    const modal = baca(...MODAL);
    const deklarasi = modal.match(/export type KunciPro =([\s\S]*?);/);
    assert.ok(deklarasi, "tipe KunciPro tidak ditemukan");
    const kunci = [...deklarasi[1].matchAll(/"([A-Z]+)"/g)].map((m) => m[1]);
    assert.ok(kunci.length >= 7, `KunciPro hanya punya ${kunci.length} kunci`);

    const manfaat = isiManfaat();
    for (const key of kunci) {
      const blok = manfaat.match(new RegExp(`\\b${key}: \\[([\\s\\S]*?)\\],`));
      assert.ok(blok, `MANFAAT_KUNCI.${key} hilang — modal jadi daftar umum`);
      assert.ok(
        blok[1].split("\n").filter((b) => b.trim().startsWith('"')).length >= 2,
        `MANFAAT_KUNCI.${key} terlalu sedikit untuk menjual dengan jujur`,
      );
    }
  });

  it("setiap pemicu modal menyebut kuncinya", () => {
    // `kunci` yang hilang tidak menimbulkan error apa pun: modal hanya kembali
    // menampilkan daftar umum, persis copy yang dihindari PRD 4.D.3.
    const tanpaKunci: string[] = [];
    for (const path of berkasSumber(AKAR_SRC)) {
      if (!path.endsWith(".tsx")) continue;
      const isi = readFileSync(path, "utf8");
      for (const cocok of isi.matchAll(/<UpgradeModal\b[\s\S]*?>/g)) {
        // Atribut bisa ditulis di beberapa baris; yang dibaca adalah tag
        // pembukanya saja, sampai ">" penutupnya.
        if (!cocok[0].includes("kunci")) {
          tanpaKunci.push(
            `${relative(AKAR_SRC, path)}: ${cocok[0].replace(/\s+/g, " ")}`,
          );
        }
      }
    }
    assert.ok(tanpaKunci.length === 0, `modal tanpa kunci: ${tanpaKunci.join(" | ")}`);
  });
});

describe("zakat FREE: angka tampil, aksi PRO", () => {
  it("ringkasan menghitung estimasi tanpa memandang paket", () => {
    const isi = baca(...SUMMARY);
    assert.match(
      isi,
      /estimasiZakat:\s*hasilZakat\.estimasi,/,
      "estimasi zakat tidak lagi dihitung untuk semua paket",
    );
    assert.ok(
      !/estimasiZakat:[^\n]*\?/.test(isi),
      "estimasi zakat jangan digating dengan plan — itu menyembunyikan kebenaran",
    );
    // Yang boleh dibedakan hanyalah otomatisasinya.
    assert.match(isi, /zakatOtomatisAktif/);
  });

  it("menulis zakat tetap butuh PRO di Server Action", () => {
    // Gerbangnya ada di aksi, bukan di UI: inilah alasan angka boleh ditampilkan.
    assert.match(
      baca("modules", "core", "actions", "zakat-actions.ts"),
      /checkLimit\(\s*akses\.tenantId,\s*"ZAKAT"\s*\)/,
    );
  });

  it("tab zakat tidak mengunci seluruh halamannya lagi", () => {
    assert.ok(
      !baca("modules", "core", "components", "zakat-tabs.tsx").includes(
        "LockedFeature",
      ),
      "zakat-tabs masih membungkus seluruh tab dengan gembok",
    );
    // Panel penghasilan yang mengunci tombol aksinya.
    const panel = baca(
      "modules",
      "core",
      "components",
      "zakat-penghasilan-panel.tsx",
    );
    assert.match(panel, /<LockedFeature/);
    assert.match(panel, /kunci="ZAKAT"/);
  });
});

describe("meter kuota", () => {
  it("hanya kuota yang bergerak tiap bulan yang diukur", () => {
    const isi = baca(...SUMMARY);
    assert.match(isi, /kuotaMendesak\(\s*"INVOICE"/);
    assert.match(isi, /kuotaMendesak\(\s*"PRODUCT"/);
    // USERS = 1/1 sejak hari pertama di paket FREE: meter ini akan jadi banner
    // permanen yang tidak menawarkan apa pun.
    assert.ok(
      !/kuotaMendesak\(\s*"USERS"/.test(isi),
      "jangan tampilkan meter pengguna di dashboard",
    );
  });

  it("dashboard benar-benar merender kuotanya", () => {
    // tanpa ini, kuotaMenipis dihitung di server lalu dibuang diam-diam
    assert.match(
      baca("modules", "core", "components", "owner-dashboard.tsx"),
      /ringkasan\.kuotaMenipis/,
    );
  });
});

describe("pesan batas menjual, bukan melarang", () => {
  it("setiap kunci menyebut apa yang terbuka di PRO", () => {
    const isi = baca(...GUARDS);
    const blok = isi.match(/const MANFAAT_LIMIT[\s\S]*?\n};/);
    assert.ok(blok, "MANFAAT_LIMIT tidak ditemukan di feature-guards.ts");
    for (const key of ["INVOICE", "PRODUCT", "USERS", "BATCH", "ZAKAT", "PROGRAM", "HPP"]) {
      assert.match(
        blok[0],
        new RegExp(`\\b${key}:\\s*"`),
        `pesan batas ${key} tidak menyebut manfaatnya`,
      );
    }
  });

  it("kuota jumlah tetap menyebut used/limit", () => {
    // UI membaca angka ini dari objek hasil; pesannya pun harus memuat angkanya.
    assert.match(baca(...GUARDS), /\$\{used\} dari \$\{limit\}/);
  });
});
