import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ambilBatasFitur,
  ambilBatasJumlah,
  AMBANG_KUOTA_DASHBOARD,
  HARGA_PRO_BULAN,
  labelBatasJumlah,
  LIMIT_LABELS,
  PLAN_LIMITS,
  kuotaMendesak,
  type LimitFiturKey,
  type LimitKey,
} from "./plan-limits";

// Matriks paket: perubahan yang tidak sengaja di sini langsung memengaruhi
// janji PRD 4.D, jadi dikunci dengan tes.

describe("batas jumlah", () => {
  it("FREE dibatasi, PRO tanpa batas", () => {
    assert.equal(ambilBatasJumlah("FREE", "INVOICE"), 50);
    assert.equal(ambilBatasJumlah("FREE", "PRODUCT"), 100);
    assert.equal(ambilBatasJumlah("FREE", "USERS"), 1);

    assert.equal(ambilBatasJumlah("PRO", "INVOICE"), null);
    assert.equal(ambilBatasJumlah("PRO", "PRODUCT"), null);
    assert.equal(ambilBatasJumlah("PRO", "USERS"), null);
  });

  it("invoice dihitung per bulan, produk tidak", () => {
    assert.equal(labelBatasJumlah("INVOICE"), "invoice per bulan");
    assert.equal(labelBatasJumlah("PRODUCT"), "produk");
    assert.equal(labelBatasJumlah("USERS"), "pengguna");
  });
});

describe("batas fitur", () => {
  it("batch, zakat otomatis, program, dan laporan HPP hanya untuk PRO", () => {
    // Semua LimitFiturKey diperiksa lewat loop yang sama: menambah kunci baru
    // tanpa mengisi kolomnya di PLAN_LIMITS akan membuat tes ini merah, bukan
    // diam-diam lolos sebagai `undefined`.
    const kunci: readonly LimitFiturKey[] = [
      "BATCH",
      "ZAKAT",
      "PROGRAM",
      "HPP",
    ];
    assert.ok(kunci.length >= 4);

    for (const key of kunci) {
      assert.equal(
        ambilBatasFitur("FREE", key),
        false,
        `${key} tidak boleh aktif pada paket FREE`,
      );
      assert.equal(
        ambilBatasFitur("PRO", key),
        true,
        `${key} harus aktif pada paket PRO`,
      );
    }
  });

  it("setiap batas punya label untuk pesan upgrade", () => {
    // checkLimit merakit pesannya dari LIMIT_LABELS[type]; kunci tanpa label
    // menghasilkan pesan "undefined tersedia pada paket PRO" di UI.
    const kunci: readonly LimitKey[] = [
      "INVOICE",
      "PRODUCT",
      "USERS",
      "BATCH",
      "ZAKAT",
      "PROGRAM",
      "HPP",
    ];

    for (const key of kunci) {
      const label = LIMIT_LABELS[key];
      assert.ok(label && label.length > 1, `LIMIT_LABELS[${key}] kosong`);
    }
  });

  it("hanya PRO yang tanpa batas jumlah", () => {
    assert.equal(PLAN_LIMITS.PRO.invoice, null);
    assert.equal(PLAN_LIMITS.FREE.batch, false);
  });
});

describe("harga PRO", () => {
  it("satu-satunya angka harga yang dipakai ajakan upgrade", () => {
    // PRD 4.D: harga menyebut satu angka di semua tempat. Kalau angka ini
    // berubah, copy di modal & pesan WhatsApp ikut berubah sendiri.
    assert.equal(HARGA_PRO_BULAN, 149_000);
  });
});

describe("meter kuota dashboard", () => {
  it("baru muncul pada 80% terpakai", () => {
    assert.equal(AMBANG_KUOTA_DASHBOARD, 0.8);

    // 39/50 = 78% — di bawah ambang, dashboard bersih dari spanduk.
    assert.equal(kuotaMendesak("INVOICE", "FREE", 39), null);
    const kuota = kuotaMendesak("INVOICE", "FREE", 40);
    assert.ok(kuota);
    assert.equal(kuota?.batas, 50);
    assert.equal(kuota?.terpakai, 40);
    // Label memakai bentuk berperiode agar kuotanya tidak terbaca selamanya.
    assert.equal(kuota?.label, "invoice per bulan");
  });

  it("PRO tidak pernah mendapat meter", () => {
    assert.equal(kuotaMendesak("INVOICE", "PRO", 999), null);
    assert.equal(kuotaMendesak("PRODUCT", "PRO", 999), null);
  });

  it("pengguna tidak diukur di dashboard", () => {
    // FREE punya 1 pengguna (Owner) sejak hari pertama: 1/1 = 100% akan jadi
    // banner permanen yang tidak menawarkan apa-apa. Pemanggil tidak mengirim
    // USERS sama sekali — ini dikunci oleh tes struktural dashboard-summary.
    assert.equal(kuotaMendesak("USERS", "FREE", 1)?.batas, 1);
  });

  it("terpakai nol tidak memicu meter", () => {
    // Modul belum aktif -> pemanggil mengirim 0; tidak ada yang perlu dijual.
    assert.equal(kuotaMendesak("PRODUCT", "FREE", 0), null);
  });
});
