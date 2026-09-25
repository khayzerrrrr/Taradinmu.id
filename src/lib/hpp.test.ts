import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  adalahReferensiBatal,
  AKHIRAN_BATAL,
  gabungHargaModal,
  hitungHpp,
  hppDariMovementOut,
  labaKotor,
} from "./hpp";

describe("adalahReferensiBatal", () => {
  it("menandai movement yang stoknya sudah dikembalikan", () => {
    assert.equal(
      adalahReferensiBatal(`INV-001${AKHIRAN_BATAL}`),
      true,
    );
  });

  it("reference biasa dan null tidak dianggap batal", () => {
    assert.equal(adalahReferensiBatal("INV-001"), false);
    assert.equal(adalahReferensiBatal(null), false);
  });

  it("reference yang memang berakhiran #BATAL dianggap batal", () => {
    // Penandaan pembatalan memakai akhiran reference, jadi nomor dokumen yang
    // kebetulan berakhir sama ikut terbatal. Tes ini menjaga perilakunya agar
    // tidak berubah diam-diam.
    assert.equal(adalahReferensiBatal("INV-9#BATAL"), true);
  });
});

describe("gabungHargaModal", () => {
  it("mengisi harga modal batch yang belum pernah tercatat", () => {
    assert.equal(
      gabungHargaModal({ jumlahLama: 5, modalLama: null, jumlahBaru: 10, modalBaru: 2000 }),
      2000,
    );
  });

  it("dibiarkan kosong: harga modal batch lama tidak berubah menjadi nol", () => {
    assert.equal(
      gabungHargaModal({ jumlahLama: 5, modalLama: null, jumlahBaru: 10, modalBaru: null }),
      null,
    );
    assert.equal(
      gabungHargaModal({ jumlahLama: 5, modalLama: 2000, jumlahBaru: 10, modalBaru: null }),
      2000,
    );
  });

  it("menggabungkan dengan rata-rata tertimbang, bukan harga terakhir", () => {
    // 2 unit @1.000 + 8 unit @2.000 = 18.000 / 10 = 1.800
    assert.equal(
      gabungHargaModal({ jumlahLama: 2, modalLama: 1000, jumlahBaru: 8, modalBaru: 2000 }),
      1800,
    );
  });

  it("unit lama yang sudah habis tidak ikut menimbang", () => {
    // Batch sudah kosong (semua unit lama sempat keluar dengan modal lamanya),
    // jadi harga baru adalah modal untuk seluruh isi batch sekarang.
    assert.equal(
      gabungHargaModal({ jumlahLama: 0, modalLama: 1000, jumlahBaru: 5, modalBaru: 2000 }),
      2000,
    );
  });

  it("pembelian dengan jumlah nol tidak mengubah harga", () => {
    assert.equal(
      gabungHargaModal({ jumlahLama: 4, modalLama: 1000, jumlahBaru: 0, modalBaru: 2000 }),
      1000,
    );
  });

  it("membulatkan hasil ke dua desimal", () => {
    assert.equal(
      gabungHargaModal({ jumlahLama: 1, modalLama: 1000, jumlahBaru: 2, modalBaru: 1001 }),
      1000.67,
    );
  });

  it("harga yang sama bolak-balik tetap harga itu", () => {
    const tetap = gabungHargaModal({
      jumlahLama: 3,
      modalLama: 1500,
      jumlahBaru: 7,
      modalBaru: 1500,
    });
    assert.equal(tetap, 1500);
  });
});

describe("hitungHpp", () => {
  it("menjumlahkan quantity x unitCost tiap movement", () => {
    const hasil = hitungHpp([
      { quantity: 2, unitCost: 1000 },
      { quantity: 5, unitCost: 1500 },
    ]);
    assert.equal(hasil.hpp, 9500);
    assert.equal(hasil.unitTanpaModal, 0);
    assert.equal(hasil.tidakLengkap, false);
  });

  it("batch tanpa harga modal dilaporkan, tidak dihitung nol diam-diam", () => {
    const hasil = hitungHpp([
      { quantity: 3, unitCost: 1000 },
      { quantity: 4, unitCost: null },
    ]);
    assert.equal(hasil.hpp, 3000);
    assert.equal(hasil.unitTanpaModal, 4);
    assert.equal(hasil.tidakLengkap, true);
  });

  it("semua unit tanpa modal: HPP nol tapi tidakLengkap true", () => {
    const hasil = hitungHpp([{ quantity: 10, unitCost: null }]);
    assert.equal(hasil.hpp, 0);
    assert.equal(hasil.tidakLengkap, true);
  });

  it("tanpa movement (mis. semua item jasa) HPP nol dan lengkap", () => {
    const hasil = hitungHpp([]);
    assert.deepEqual(hasil, { hpp: 0, unitTanpaModal: 0, tidakLengkap: false });
  });
});

describe("hppDariMovementOut", () => {
  const out = (
    quantity: number,
    unitCost: number | null,
    reference: string | null,
  ) => ({ quantity, unitCost, reference });

  it("movement berakhiran #BATAL tidak dihitung sebagai HPP", () => {
    const hasil = hppDariMovementOut([
      out(2, 1000, "INV-1"),
      out(2, 1000, `INV-1${AKHIRAN_BATAL}`),
    ]);
    assert.equal(hasil.hpp, 2000);
    assert.equal(hasil.unitTanpaModal, 0);
  });

  it("reference null tetap dihitung", () => {
    // Baris inilah yang hilang bila penyaringan dipindah ke Prisma
    // `reference: { not: { endsWith: "#BATAL" } }` — filter itu ikut membuang
    // nilai null, padahal stok keluar manual memang tidak bernomor dokumen.
    const hasil = hppDariMovementOut([out(3, 500, null)]);
    assert.equal(hasil.hpp, 1500);
  });

  it("campuran batal, tanpa modal, dan normal dilaporkan terpisah", () => {
    const hasil = hppDariMovementOut([
      out(1, 1000, "INV-2"),
      out(4, null, "SOK-9"),
      out(5, 2000, `INV-3${AKHIRAN_BATAL}`),
    ]);
    assert.equal(hasil.hpp, 1000);
    assert.equal(hasil.unitTanpaModal, 4);
    assert.equal(hasil.tidakLengkap, true);
  });
});

describe("labaKotor", () => {
  it("pendapatan dikurangi HPP", () => {
    assert.equal(labaKotor(20000, 9500), 10500);
  });

  it("boleh negatif bila modal lebih besar dari harga jual", () => {
    // Terjadi pada penjualan rugi / harga modal yang dikoreksi naik — angkanya
    // harus tetap tampil, bukan dipaksa nol.
    assert.equal(labaKotor(5000, 9500), -4500);
  });
});

// --- Penjaga basis pengakuan HPP ---
//
// Alasan: kartu Laba Bersih menjumlahkan tiga suku (pendapatan, beban, HPP).
// Suku pertama hanya menghitung invoice PAID; begitu HPP dihitung dari tanggal
// movement, satu invoice draft langsung menjadi "rugi" sebesar seluruh modalnya.
// Itu bug pembukuan yang tidak ditangkap tsc maupun build, jadi aturannya
// dikunci di sini: baca berkas sumbernya, pastikan filternya masih sama.

const SUMBER_HPP_QUERY = bacaSumber("lib/hpp-query.ts");

function bacaSumber(relatifDariAkar: string): string {
  const akar = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  return readFileSync(join(akar, relatifDariAkar), "utf8");
}

// Ambil satu fungsi dari deklarasi sampai `export` berikutnya, supaya assertion
// hanya membaca badan fungsi itu — bukan komentar atau fungsi lain di berkas.
function potongFungsi(sumber: string, nama: string): string {
  const mulai = sumber.indexOf(`export async function ${nama}`);
  assert.ok(mulai >= 0, `fungsi ${nama}() tidak ditemukan — tesnya jadi palsu`);
  const berikutnya = sumber.indexOf("\nexport ", mulai + 1);
  return sumber.slice(mulai, berikutnya === -1 ? sumber.length : berikutnya);
}

describe("basis pengakuan HPP periode (PRD 4.G.3)", () => {
  it("periode HPP disaring dari invoice lunas, bukan dari tanggal movement", () => {
    const badan = potongFungsi(SUMBER_HPP_QUERY, "hppInvoiceLunas");
    assert.match(badan, /status:\s*"PAID"/);
    assert.match(badan, /paidAt:\s*\{\s*gte:/);
    // Kalau seseorang mengembalikan batas periode ke createdAt movement,
    // rugi phantom dari invoice draft kembali muncul.
    assert.doesNotMatch(badan, /createdAt/);
  });

  it("dashboard dan zakat membaca HPP dari satu sumber yang sama", () => {
    for (const berkas of [
      "lib/dashboard-summary.ts",
      "modules/core/actions/zakat-actions.ts",
    ]) {
      const sumber = bacaSumber(berkas);
      assert.match(sumber, /hppInvoiceLunas\(/, `${berkas} tidak lagi pakai hppInvoiceLunas`);
      // Basis pendapatannya harus tetap sama, tidak boleh salah satu bergeser.
      assert.match(sumber, /status:\s*"PAID"/);
      assert.match(sumber, /paidAt:\s*\{\s*gte:/);
    }
  });

  it("HPP per dokumen tidak ikut disaring status lunas", () => {
    // Dialog invoice menjawab "berapa modal barang pada invoice ini", draft maupun
    // lunas — jadi menyaring PAID di sana akan salah angka.
    const badan = potongFungsi(SUMBER_HPP_QUERY, "hppDokumen");
    assert.match(badan, /reference,/);
    assert.doesNotMatch(badan, /status:\s*"PAID"/);
  });
});
