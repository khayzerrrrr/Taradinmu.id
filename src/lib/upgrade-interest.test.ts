import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  JENDELA_MINAT_HARI,
  KUNCI_MINAT,
  MINAT_KOSONG,
  normalisasiKunci,
  normalisasiSumber,
  normalisasiTahap,
  rangkumMinat,
  SUMBER_BAKU,
  SUMBER_MINAT,
  TAHAP_MINAT,
  labelKunciMinat,
  type BarisMinat,
} from "@/lib/upgrade-interest";
import { validasiCatatMinat } from "@/modules/core/schemas/upgrade-schema";

// Tes pencatatan minat upgrade (PRD 4.D.5).
//
// Dua hal yang dijaga di sini tidak bisa ditegakkan oleh tsc:
//   1. tabel UpgradeInterest harus tetap hanya berisi nilai dari daftar tertutup.
//      Begitu satu pemanggil boleh mengirim teks bebas, agregat "kunci mana yang
//      paling sering diklik" kehilangan artinya DAN tabel berubah jadi tempat
//      penampungan data tenant;
//   2. kedua peristiwa (modal dibuka, tombol WhatsApp diklik) harus tetap
//      dicatat. Kalau suatu refactor tinggal menyisakan satu, funnel terlihat
//      utuh padahal tidak — dan halaman admin tidak menampilkan apa pun.
// Bagian struktural membaca berkas dari disk, seperti tes penjaga lain di repo ini.

const DIR_INI = dirname(fileURLToPath(import.meta.url));
const AKAR_SRC = resolve(DIR_INI, "..");

function baca(...segmen: string[]): string {
  return readFileSync(join(AKAR_SRC, ...segmen), "utf8");
}

function berkasSumber(dir: string, keluaran: string[] = []): string[] {
  for (const entri of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entri.name);
    if (entri.isDirectory()) {
      if (entri.name === "generated" || entri.name === "node_modules") continue;
      berkasSumber(path, keluaran);
    } else if (/\.tsx?$/.test(entri.name) && !entri.name.includes(".test.")) {
      keluaran.push(path);
    }
  }
  return keluaran;
}

const SEMUA_SUMBER = berkasSumber(AKAR_SRC);

describe("daftar tertutup minat upgrade", () => {
  it("setiap kunci yang sah diterima dan yang lain ditolak", () => {
    for (const kunci of KUNCI_MINAT) {
      assert.equal(normalisasiKunci(kunci), kunci);
    }
    // Kontrol positif bahwa ini bukan sekadar `String(x)`: bentuk kecil dan nilai
    // yang belum dibangun harus tetap tertolak.
    assert.equal(normalisasiKunci("batch"), null);
    assert.equal(normalisasiKunci("SIKLIAN"), null);
    assert.equal(normalisasiKunci("MULTI_GUDANG"), null);
    assert.equal(normalisasiKunci(7), null);
    assert.equal(normalisasiKunci(undefined), null);
  });

  it("hanya dua tahap yang dikenal", () => {
    assert.deepEqual([...TAHAP_MINAT], ["BUKA", "CTA"]);
    assert.equal(normalisasiTahap("BUKA"), "BUKA");
    assert.equal(normalisasiTahap("klik"), null);
  });

  it("sumber asing menjadi TIDAK_DIKETAHUI, bukan ditolak atau disalin mentah", () => {
    assert.equal(normalisasiSumber("NAVIGASI"), "NAVIGASI");
    assert.equal(normalisasiSumber("<script>tokobuku</script>"), SUMBER_BAKU);
    assert.equal(normalisasiSumber(null), SUMBER_BAKU);
    for (const sumber of SUMBER_MINAT) {
      assert.equal(normalisasiSumber(sumber), sumber);
    }
  });

  it("setiap kunci punya label ramah", () => {
    for (const kunci of KUNCI_MINAT) {
      const label = labelKunciMinat(kunci);
      assert.ok(label.length > 0, `${kunci} tanpa label`);
      assert.notEqual(label, kunci, `${kunci} menampilkan kode mentah`);
    }
  });

  it("kunci yang dicatat semuanya bisa dijual hari ini (PRD 4.D.2a)", () => {
    // Semua kunci minat wajib muncul sebagai kunci manfaat di modal upgrade.
    // Kalau suatu saat cicilan atau multi-gudang ditambahkan ke daftar ini
    // sementara PRD 4.D.2a masih menuliskannya BELUM, tes ini yang berbunyi.
    const modal = baca("components", "shared", "upgrade-modal.tsx");
    for (const kunci of KUNCI_MINAT) {
      if (kunci === "UMUM") continue;
      assert.ok(
        new RegExp(`^  ${kunci}: \\[`, "m").test(modal),
        `kunci ${kunci} tercatat tetapi tidak punya manfaat di modal upgrade`,
      );
    }
  });

  it("jendela pelaporan satu bulan, sesuai siklus keputusan upgrade", () => {
    assert.equal(JENDELA_MINAT_HARI, 30);
  });
});

describe("validasi input Server Action", () => {
  it("menerima catatan lengkap dan menormalkan sumber", () => {
    assert.deepEqual(
      validasiCatatMinat({ kunci: "BATCH", tahap: "BUKA", sumber: "DASHBOARD" }),
      { kunci: "BATCH", tahap: "BUKA", sumber: "DASHBOARD" },
    );
    assert.deepEqual(validasiCatatMinat({ kunci: "UMUM", tahap: "CTA" }), {
      kunci: "UMUM",
      tahap: "CTA",
      sumber: SUMBER_BAKU,
    });
  });

  it("menolak bentuk apa pun yang bukan catatan sah", () => {
    for (const input of [
      null,
      undefined,
      "BATCH",
      42,
      [],
      { kunci: "BATCH" },
      { kunci: "NERACA", tahap: "BUKA" },
      { kunci: "BATCH", tahap: "MEMBUKA" },
      { kunci: "<script>", tahap: "BUKA", sumber: "NAVIGASI" },
    ]) {
      assert.equal(validasiCatatMinat(input), null, `lolos: ${JSON.stringify(input)}`);
    }
  });
});

function baris(
  tenantId: string,
  kunci: string,
  tahap: string,
  jumlah: number,
): BarisMinat {
  return { tenantId, kunci, tahap, jumlah };
}

describe("perangkuman minat", () => {
  it("memisah modal dibuka dan klik WhatsApp", () => {
    const hasil = rangkumMinat([
      baris("t1", "BATCH", "BUKA", 4),
      baris("t1", "BATCH", "CTA", 1),
    ]).get("t1");
    assert.deepEqual(hasil, { buka: 4, cta: 1, kunci: ["batch & kedaluwarsa"] });
  });

  it("menjumlahkan beberapa kunci untuk satu tenant", () => {
    const hasil = rangkumMinat([
      baris("t1", "BATCH", "BUKA", 4),
      baris("t1", "ZAKAT", "BUKA", 2),
      baris("t1", "ZAKAT", "CTA", 2),
    ]).get("t1");
    assert.equal(hasil?.buka, 6);
    assert.equal(hasil?.cta, 2);
  });

  it("peringkat kunci hanya mengikuti modal yang dibuka", () => {
    // ZAKAT punya baris lebih banyak secara total (1 buka + 9 cta), tetapi
    // peringkatnya harus kalah dari BATCH yang 3 kali dibuka.
    const hasil = rangkumMinat([
      baris("t1", "ZAKAT", "BUKA", 1),
      baris("t1", "ZAKAT", "CTA", 9),
      baris("t1", "BATCH", "BUKA", 3),
    ]).get("t1");
    assert.deepEqual(hasil?.kunci, [
      "batch & kedaluwarsa",
      "zakat otomatis",
    ]);
    assert.equal(hasil?.buka, 4);
    assert.equal(hasil?.cta, 9);
  });

  it("urutan deterministik saat jumlah sama", () => {
    const hasil = rangkumMinat([
      baris("t1", "ZAKAT", "BUKA", 2),
      baris("t1", "HPP", "BUKA", 2),
      baris("t1", "BRANDING", "BUKA", 2),
    ]).get("t1");
    assert.deepEqual(hasil?.kunci, [
      "branding kustom",
      "laporan HPP",
      "zakat otomatis",
    ]);
  });

  it("maksimal tiga kunci teratas", () => {
    const hasil = rangkumMinat([
      baris("t1", "BATCH", "BUKA", 9),
      baris("t1", "ZAKAT", "BUKA", 8),
      baris("t1", "HPP", "BUKA", 7),
      baris("t1", "PROGRAM", "BUKA", 6),
      baris("t1", "AI", "BUKA", 5),
    ]).get("t1");
    assert.equal(hasil?.kunci.length, 3);
    assert.deepEqual(hasil?.kunci, [
      "batch & kedaluwarsa",
      "zakat otomatis",
      "laporan HPP",
    ]);
  });

  it("mengabaikan baris rusak tanpa menghilangkan yang sah", () => {
    const hasil = rangkumMinat([
      baris("t1", "NERACA", "BUKA", 5),
      baris("t1", "BATCH", "BUKA", 0),
      baris("t1", "BATCH", "BUKA", Number.NaN),
      baris("t1", "BATCH", "BUKA", 3),
    ]);
    assert.deepEqual(hasil.get("t1"), {
      buka: 3,
      cta: 0,
      kunci: ["batch & kedaluwarsa"],
    });
  });

  it("memisah tenant dan tidak mengarang baris untuk tenant tanpa catatan", () => {
    const hasil = rangkumMinat([baris("t1", "BATCH", "BUKA", 2)]);
    assert.equal(hasil.has("t2"), false);
    assert.deepEqual(hasil.get("t1")?.kunci, ["batch & kedaluwarsa"]);
    assert.deepEqual(MINAT_KOSONG, { buka: 0, cta: 0, kunci: [] });
  });
});

describe("penjaga struktural pencatatan minat", () => {
  const MODAL = baca("components", "shared", "upgrade-modal.tsx");

  it("modal mencatat kedua peristiwa, bukan satu saja", () => {
    assert.match(
      MODAL,
      /onOpenChange=\{/,
      "pembukaan modal tidak lagi dicatat — funnel kehilangan sisi kiri",
    );
    assert.match(MODAL, /,\s*"BUKA"\s*\)/, "tahap BUKA hilang");
    assert.match(MODAL, /,\s*"CTA"\s*\)/, "tahap CTA hilang");
  });

  it("Server Action-nya dipagari gerbang izin dan rate limiter", () => {
    const aksi = baca("modules", "core", "actions", "upgrade-actions.ts");
    assert.match(aksi, /\bassertTenantMember\s*\(/, "aksi tanpa gerbang izin");
    assert.match(aksi, /\bperiksaBatas\s*\(/, "aksi tanpa rate limit");
    assert.match(aksi, /BATAS_MINAT/, "aksi memakai batas yang tidak terdaftar");
  });

  it("setiap sumber punya permukaan UI sungguhan", () => {
    // Daftar sumber yang tidak dipakai di mana pun berarti ada nilai mati di
    // tabel, dan laporan "sumber klik" diam-diam tidak lengkap.
    const isi = SEMUA_SUMBER.map((path) => readFileSync(path, "utf8")).join("\n");
    for (const sumber of SUMBER_MINAT) {
      if (sumber === SUMBER_BAKU) continue;
      assert.ok(
        isi.includes(`"${sumber}"`),
        `sumber ${sumber} tidak dipakai satu pun komponen`,
      );
    }
  });

  it("tidak ada kolom teks bebas di skema minat", () => {
    const skema = baca(
      "..",
      "prisma",
      "schema.prisma",
    ).match(/model UpgradeInterest \{[\s\S]*?\n\}/)?.[0];
    assert.ok(skema, "model UpgradeInterest hilang dari skema");
    // Hanya id, cuid, tenantId, tiga kolom daftar tertutup, dan createdAt.
    assert.doesNotMatch(skema, /String @id @db/, "kolom teks panjang baru muncul");
    const kolom = (skema.match(/^\s{2}\w+/gm) ?? []).map((s) => s.trim());
    assert.deepEqual(kolom, [
      "id",
      "tenantId",
      "tenant",
      "kunci",
      "sumber",
      "tahap",
      "createdAt",
    ]);
  });
});
