import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { LIMIT_LABELS, kuotaMendesak, planEfektif } from "./plan-limits";
import { formatTanggal } from "./format";
import {
  AMBANG_MASA_BERLAKU_MENDESAK,
  jumlahFiturTerkunci,
  ringkasBatas,
  susunMasaBerlaku,
  susunStatusPaket,
  URUTAN_FITUR,
  URUTAN_KUOTA,
} from "./plan-status";

// Halaman "Paket Saya" hanya boleh menjadi kaca dari plan-limits.ts. Berkas ini
// menguji bahan kacanya: apa yang terjadi pada tiap angka pemakaian, tanpa DB dan
// tanpa React (lihat alasan di plan-status.ts).

const DIR_INI = dirname(fileURLToPath(import.meta.url));

/** Anggota `LimitJumlahKey` seperti tertulis di plan-limits.ts. */
function kunciJumlah(): string[] {
  const isi = readFileSync(join(DIR_INI, "plan-limits.ts"), "utf8");
  const deklarasi = isi.match(/export type LimitJumlahKey =[\s\S]*?;/);
  assert.ok(deklarasi, "tipe LimitJumlahKey tidak ditemukan di plan-limits.ts");
  return [...deklarasi[0].matchAll(/"([A-Z]+)"/g)].map((m) => m[1]);
}

describe("baris kuota", () => {
  it("setiap batas jumlah punya baris", () => {
    const status = susunStatusPaket("FREE");
    // Penjaga bagi penjaga: kalau URUTAN_KUOTA tidak ikut diperbarui saat kunci
    // baru masuk ke LimitJumlahKey, kuotanya tidak akan pernah tampil di halaman
    // dan tidak ada yang gagal — tipe `readonly LimitJumlahKey[]` tidak memaksa
    // ketiga anggotanya disebut.
    const dariDeklarasi = kunciJumlah();
    assert.ok(dariDeklarasi.length >= 3, "pemindaian LimitJumlahKey gagal");
    assert.deepEqual(
      [...URUTAN_KUOTA].sort(),
      [...dariDeklarasi].sort(),
      "URUTAN_KUOTA tidak sama dengan LimitJumlahKey",
    );
    assert.deepEqual(
      status.kuota.map((baris) => baris.key),
      [...URUTAN_KUOTA],
      "urutan baris halaman tidak sama dengan URUTAN_KUOTA",
    );
  });

  it("FREE memakai angkanya, PRO tidak dibatasi", () => {
    const free = susunStatusPaket("FREE");
    assert.deepEqual(
      free.kuota.map((baris) => baris.batas),
      [50, 100, 1],
    );

    const pro = susunStatusPaket("PRO");
    for (const baris of pro.kuota) {
      assert.equal(baris.batas, null);
      // Tanpa ini `null` akan ikut tampil di halaman sebagai batas.
      assert.equal(baris.persen, 0);
      assert.equal(baris.menipis, false);
    }
  });

  it("persen dibulatkan dan ditahan di 100", () => {
    const [invoice] = susunStatusPaket("FREE", { INVOICE: 25 }).kuota;
    assert.equal(invoice.persen, 50);

    // Melewati batas mungkin terjadi pada invoice yang dibuat sebelum kebijakan
    // berubah; meternya tidak boleh melebar keluar kartu.
    const [banjir] = susunStatusPaket("FREE", { INVOICE: 60 }).kuota;
    assert.equal(banjir.persen, 100);
  });

  it("pemakaian nol bukan meter", () => {
    // Modul belum dipakai sama sekali: tidak ada yang perlu dijual.
    const status = susunStatusPaket("FREE");
    for (const baris of status.kuota) {
      assert.equal(baris.terpakai, 0);
      assert.equal(baris.menipis, false);
    }
  });

  it("gaya menipis = aturan meter dashboard", () => {
    // Dua permukaan, satu ambang. `kuotaMendesak` adalah yang menyalakan meter di
    // dashboard; kalau halaman ini menyimpang, kuota yang sama bertingkah beda
    // tergantung halaman mana yang dibuka.
    for (const terpakai of [0, 39, 40, 48, 50]) {
      const [baris] = susunStatusPaket("FREE", { INVOICE: terpakai }).kuota;
      assert.equal(
        baris.menipis,
        kuotaMendesak("INVOICE", "FREE", terpakai) !== null,
        `menipis menyimpang dari meter dashboard pada ${terpakai}/50`,
      );
    }

    // Kontrol positif: ambangnya benar-benar terlampaui di dalam loop di atas.
    assert.equal(
      susunStatusPaket("FREE", { INVOICE: 40 }).kuota[0].menipis,
      true,
    );
    assert.equal(
      susunStatusPaket("FREE", { INVOICE: 39 }).kuota[0].menipis,
      false,
    );
  });

  it("labelnya sudah berikut periode", () => {
    const labels = susunStatusPaket("FREE").kuota.map((baris) => baris.label);
    assert.deepEqual(labels, ["invoice per bulan", "produk", "pengguna"]);
  });
});

describe("baris fitur", () => {
  it("FREE mengunci semuanya, PRO membuka semuanya", () => {
    const free = susunStatusPaket("FREE").fitur;
    assert.equal(free.length, URUTAN_FITUR.length);
    assert.ok(free.every((baris) => !baris.aktif));

    const pro = susunStatusPaket("PRO").fitur;
    assert.ok(pro.every((baris) => baris.aktif));
  });

  it("setiap baris memakai label resmi plan-limits", () => {
    // Label yang dirangkai ulang di halaman akan menyimpang dari pesan penolakan
    // server begitu LIMIT_LABELS diubah.
    for (const baris of susunStatusPaket("PRO").fitur) {
      assert.equal(baris.label, LIMIT_LABELS[baris.key]);
      assert.ok(baris.label.length > 1);
    }
  });
});

describe("ringkasan untuk kalimat pembuka", () => {
  it("jumlahFiturTerkunci menghitung yang masih bergembok", () => {
    assert.equal(
      jumlahFiturTerkunci(susunStatusPaket("FREE")),
      URUTAN_FITUR.length,
    );
    assert.equal(jumlahFiturTerkunci(susunStatusPaket("PRO")), 0);
  });

  it("ringkasBatas menyebut angka paket FREE dan diam pada PRO", () => {
    assert.equal(
      ringkasBatas(susunStatusPaket("FREE")),
      "50 invoice per bulan, 100 produk, 1 pengguna",
    );
    assert.equal(ringkasBatas(susunStatusPaket("PRO")), null);
  });
});

// Masa berlaku (PRD 4.D.4). Yang diuji di sini kalimatnya, bukan angkanya saja:
// satu baris teks adalah satu-satunya yang membedakan "saya masih punya 4 hari"
// dari "saya baru saja kehilangan akses" bagi penyewa.
describe("masa berlaku paket", () => {
  const hariIni = new Date("2026-09-26T06:00:00.000Z");
  const tanggal = (hari: number) => {
    const hasil = new Date(hariIni);
    hasil.setUTCDate(hasil.getUTCDate() + hari);
    return hasil;
  };

  it("tidak ada yang dikatakan untuk FREE atau PRO tanpa tanggal", () => {
    // Tanggal lampau pada paket FREE bukan kedaluwarsa: kolomnya hanya berarti
    // selama PRO, dan menampilkannya akan mengancam penyewa dengan tanggal yang
    // tidak pernah menegakkan apa pun.
    assert.equal(susunMasaBerlaku("FREE", null, hariIni), null);
    assert.equal(susunMasaBerlaku("PRO", null, hariIni), null);
    assert.equal(susunMasaBerlaku("PRO", undefined, hariIni), null);
    assert.equal(susunMasaBerlaku("FREE", tanggal(-400), hariIni), null);
    // Kontrol positif: tanggal yang sama SANGAT berarti pada paket PRO.
    assert.ok(susunMasaBerlaku("PRO", tanggal(-400), hariIni));
  });

  it("sisa hari dan kalimatnya searah dengan tanggal", () => {
    const nanti = susunMasaBerlaku("PRO", tanggal(20), hariIni);
    assert.equal(nanti?.sisaHari, 20);
    assert.equal(nanti?.kedaluwarsa, false);
    assert.equal(nanti?.mendesak, false);
    assert.equal(nanti?.pesan, "sisa 20 hari");
    assert.equal(nanti?.kalimat.startsWith("berlaku sampai"), true);

    const besok = susunMasaBerlaku("PRO", tanggal(1), hariIni);
    assert.equal(besok?.pesan, "sisa 1 hari");

    // Hari terakhir: masih PRO (aturannya di plan-limits), tapi sudah mendesak.
    const terakhir = susunMasaBerlaku("PRO", tanggal(0), hariIni);
    assert.equal(terakhir?.sisaHari, 0);
    assert.equal(terakhir?.kedaluwarsa, false);
    assert.equal(terakhir?.mendesak, true);
    assert.equal(terakhir?.pesan, "berakhir hari ini");

    const lewat = susunMasaBerlaku("PRO", tanggal(-3), hariIni);
    assert.equal(lewat?.kedaluwarsa, true);
    assert.equal(lewat?.sisaHari, -3);
    assert.equal(lewat?.pesan, "sudah lewat 3 hari");
    assert.equal(lewat?.kalimat.startsWith("kedaluwarsa"), true);
  });

  it("kalimatnya menyebut tanggal dengan format yang sama di mana-mana", () => {
    const masa = susunMasaBerlaku("PRO", tanggal(4), hariIni);
    // Tabel Super Admin dan halaman paket tenant memakai berkas yang sama supaya
    // dua orang tidak membaca tanggal yang sama dengan dua format berbeda.
    assert.equal(masa?.kalimat.includes(formatTanggal(tanggal(4))), true);
    assert.equal(masa?.kalimat, `berlaku sampai ${formatTanggal(tanggal(4))} · sisa 4 hari`);
  });

  it("paginya penyewa dihitung sebagai harinya sendiri, bukan harinya server", () => {
    // 25 Sep 21:00 UTC = 26 Sep 04:00 WIB. Server yang mengukur "hari" dari UTC
    // menyebut tanggal 26 sebagai besok, padahal penyewa Indonesia sudah
    // menjalaninya — kalimat tidak boleh melebihkan satu hari tiap pagi.
    const diniHariWib = new Date("2026-09-25T21:00:00.000Z");
    const masa = susunMasaBerlaku(
      "PRO",
      new Date("2026-09-26T00:00:00.000Z"),
      diniHariWib,
    );
    assert.equal(masa?.sisaHari, 0);
    assert.equal(masa?.kedaluwarsa, false);
    assert.equal(masa?.pesan, "berakhir hari ini");
    assert.equal(masa?.mendesak, true);
  });

  it("ambang mendesak = seminggu, dan itu batasnya", () => {
    assert.equal(AMBANG_MASA_BERLAKU_MENDESAK, 7);
    assert.equal(susunMasaBerlaku("PRO", tanggal(7), hariIni)?.mendesak, true);
    assert.equal(susunMasaBerlaku("PRO", tanggal(8), hariIni)?.mendesak, false);
  });

  it("kata 'kedaluwarsa' tidak boleh berbeda pendapat dengan penegak akses", () => {
    // `planEfektif` adalah yang menurunkan paketnya; `susunMasaBerlaku` adalah
    // yang mengatakannya. Keduanya boleh berubah aturan (mis. diambil tengah
    // malam lokal), tapi tidak boleh berdua berbeda tanggal jatuh.
    for (const selisih of [-10, -2, -1, 0, 1, 2, 10]) {
      const expiresAt = tanggal(selisih);
      const masa = susunMasaBerlaku("PRO", expiresAt, hariIni);
      assert.ok(masa, `tidak ada masa berlaku untuk ${selisih}`);
      assert.equal(
        masa.kedaluwarsa,
        planEfektif("PRO", expiresAt, hariIni) === "FREE",
        `kalimat dan penegak berbeda pendapat pada selisih ${selisih} hari`,
      );
    }
  });
});
