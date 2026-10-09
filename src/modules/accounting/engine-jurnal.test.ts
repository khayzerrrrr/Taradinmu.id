import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COA_MINIMAL, KODE_AKUN, KODE_AKUN_DI_TEMPLATE, PETA_BEBAN } from "./coa";
import {
  bulat,
  jurnalDariInvoice,
  jurnalDariPembayaran,
  jurnalDariPengeluaran,
  jurnalHppTerjual,
  jurnalPembelianStok,
  jurnalPembalik,
  racikJurnal,
  type BarisJurnal,
} from "./engine-jurnal";

const TANGGAL = new Date("2026-10-15T00:00:00Z");

/** Ringkas jurnal supaya assertion-nya terbaca: "kode: nominal sisi". */
function ringkas(postings: BarisJurnal[]): string {
  return postings.map((p) => `${p.kode}:${p.nominal} ${p.sisi}`).join(" | ");
}

describe("template CoA", () => {
  it("tidak ada kode akun yang dobel", () => {
    const baru = new Set<string>();
    for (const c of KODE_AKUN_DI_TEMPLATE) {
      assert.equal(baru.has(c), false, `kode dobel: ${c}`);
      baru.add(c);
    }
  });

  it("SEMUA akun yang dipakai jurnal otomatis ada di template", () => {
    // KODE_AKUN adalah tempat engine menulis. Kalau ada kunci yang kodenya tidak
    // ada di template, jurnal otomatis akan gagal saat buku penyewanya dibuka,
    // bukan saat kode ini ditulis.
    for (const [kunci, kode] of Object.entries(KODE_AKUN)) {
      assert.ok(
        KODE_AKUN_DI_TEMPLATE.includes(kode),
        `KODE_AKUN.${kunci} = ${kode} tidak ada di COA_MINIMAL`,
      );
    }
  });

  it("semua kode mengikuti pola tipe-urutan", () => {
    for (const a of COA_MINIMAL) {
      assert.match(
        a.code,
        /^[1-5]-\d{4}$/,
        `kode ${a.code} (${a.name}) tidak mengikuti pola tipe-urutan`,
      );
    }
  });

  it("semua akun yang dipetakan PETA_BEBAN ada di template", () => {
    for (const [kategori, kunci] of Object.entries(PETA_BEBAN)) {
      assert.ok(
        KODE_AKUN_DI_TEMPLATE.includes(KODE_AKUN[kunci]),
        `PETA_BEBAN.${kategori} menunjuk kode yang tidak ada`,
      );
    }
  });

  it("PURCHASE menunjuk persediaan, bukan akun beban", () => {
    // Kalau tidak, pembelian stok akan memotong laba pada bulan pembelian --
    // kesalahan yang membuat zakat penghasilan ikut turun (PRD 4.G.1).
    assert.equal(PETA_BEBAN.PURCHASE, "persediaan");
    const akun = COA_MINIMAL.find((a) => a.code === KODE_AKUN.persediaan);
    assert.equal(akun?.type, "ASSET");
  });

  it("tidak ada akun pajak sebelum modul pajak ada", () => {
    // Akun PPN sekarang akan menyiratkan presisi tarif yang belum ada.
    for (const a of COA_MINIMAL) {
      assert.doesNotMatch(
        a.name,
        /PPN|Pajak/,
        `akun pajak belum waktunya: ${a.name}`,
      );
    }
  });
});

describe("racikJurnal", () => {
  const seimbang: BarisJurnal[] = [
    { kode: KODE_AKUN.kas, nominal: 100, sisi: "DEBIT" },
    { kode: KODE_AKUN.pendapatanPenjualan, nominal: 100, sisi: "CREDIT" },
  ];

  it("menerima jurnal yang seimbang", () => {
    const hasil = racikJurnal({
      source: "MANUAL",
      businessDate: TANGGAL,
      postings: seimbang,
    });
    assert.equal(hasil.ok, true);
  });

  it("menolak jurnal tidak seimbang, dengan selisihnya disebutkan", () => {
    const hasil = racikJurnal({
      source: "MANUAL",
      businessDate: TANGGAL,
      postings: [
        { kode: KODE_AKUN.kas, nominal: 100, sisi: "DEBIT" },
        { kode: KODE_AKUN.pendapatanPenjualan, nominal: 90, sisi: "CREDIT" },
      ],
    });
    assert.equal(hasil.ok, false);
    if (!hasil.ok) {
      assert.match(hasil.alasan, /tidak seimbang/);
      assert.match(hasil.alasan, /10/, "selisihnya harus disebut supaya bisa dibaca");
    }
  });

  it("menolak jurnal satu baris", () => {
    const hasil = racikJurnal({
      source: "MANUAL",
      businessDate: TANGGAL,
      postings: [{ kode: KODE_AKUN.kas, nominal: 100, sisi: "DEBIT" }],
    });
    assert.equal(hasil.ok, false);
  });

  it("menolak nominal nol", () => {
    // Baris nol adalah pembukuan yang tidak menjelaskan apa pun, dan ia tetap
    // membuat jurnal terlihat seimbang tanpa menjelaskan transaksi.
    const hasil = racikJurnal({
      source: "MANUAL",
      businessDate: TANGGAL,
      postings: [
        { kode: KODE_AKUN.kas, nominal: 100, sisi: "DEBIT" },
        { kode: KODE_AKUN.bebanLain, nominal: 0, sisi: "CREDIT" },
      ],
    });
    assert.equal(hasil.ok, false);
    if (!hasil.ok) assert.match(hasil.alasan, /positif/);
  });

  it("menolak nominal negatif", () => {
    // Sisi yang menentukan; pembalikan ditulis dengan menukar sisi, bukan
    // menulis angka negatif.
    const hasil = racikJurnal({
      source: "MANUAL",
      businessDate: TANGGAL,
      postings: [
        { kode: KODE_AKUN.kas, nominal: 100, sisi: "DEBIT" },
        { kode: KODE_AKUN.bebanLain, nominal: -100, sisi: "CREDIT" },
      ],
    });
    assert.equal(hasil.ok, false);
  });

  it("menolak akun yang sama dua kali dalam satu jurnal", () => {
    const hasil = racikJurnal({
      source: "MANUAL",
      businessDate: TANGGAL,
      postings: [
        { kode: KODE_AKUN.kas, nominal: 100, sisi: "DEBIT" },
        { kode: KODE_AKUN.kas, nominal: 100, sisi: "CREDIT" },
      ],
    });
    assert.equal(hasil.ok, false);
    if (!hasil.ok) assert.match(hasil.alasan, /lebih dari sekali/);
  });

  it("membulatkan setiap nominal, bukan hanya totalnya", () => {
    // 0.1 + 0.2 = 0.30000000000000004 dalam float. Kalau pembulatan hanya di
    // akhir, jurnal terlihat seimbang padahal tidak.
    //
    // Tiga baris, bukan dua: satu akun satu kali per jurnal, jadi dua debit
    // harus memakai dua akun berbeda.
    const hasil = racikJurnal({
      source: "MANUAL",
      businessDate: TANGGAL,
      postings: [
        { kode: KODE_AKUN.kas, nominal: 0.1, sisi: "DEBIT" },
        { kode: KODE_AKUN.sisaUtangUsaha, nominal: 0.2, sisi: "DEBIT" },
        { kode: KODE_AKUN.pendapatanPenjualan, nominal: 0.3, sisi: "CREDIT" },
      ],
    });
    assert.equal(hasil.ok, true, "0.1 + 0.2 harus dianggap sama dengan 0.3");
    if (hasil.ok) {
      // Yang diperiksa: setiap nominal sudah bulat, sehingga penjumlahannya di
      // database (NUMERIC(18,4)) sama dengan yang dihitung di sini.
      for (const p of hasil.jurnal.postings) {
        assert.equal(p.nominal, bulat(p.nominal), `nominal ${p.nominal} belum bulat`);
      }
      const totalKredit = hasil.jurnal.postings
        .filter((p) => p.sisi === "CREDIT")
        .reduce((s, p) => s + p.nominal, 0);
      assert.equal(bulat(totalKredit), 0.3);
    }
  });
});

describe("jurnal dari invoice", () => {
  it("mengakui pendapatan saat faktur terbit, bukan saat dibayar", () => {
    // Dr Piutang / Cr Penjualan. Pendapatan diakui saat faktur terbit (akrual);
    // kalau Dr Kas, Laba Rugi bergantung pada kapan pelanggan membayar.
    const hasil = jurnalDariInvoice({
      businessDate: TANGGAL,
      invoiceNumber: "INV-001",
      invoiceId: "inv1",
      totalAmount: 1_000_000,
    });
    assert.equal(hasil.ok, true);
    if (hasil.ok) {
      assert.equal(hasil.jurnal.source, "INVOICE");
      assert.equal(
        ringkas(hasil.jurnal.postings),
        "1-1100:1000000 DEBIT | 4-1000:1000000 CREDIT",
      );
    }
  });

  it("memisahkan barang dan jasa ke akun pendapatan yang berbeda", () => {
    const hasil = jurnalDariInvoice({
      businessDate: TANGGAL,
      invoiceNumber: "INV-002",
      invoiceId: "inv2",
      totalAmount: 300_000,
      // `subtotal` = bagian JASA (200.000), jadi sisanya 100.000 barang.
      subtotal: 200_000,
    });
    assert.equal(hasil.ok, true);
    if (hasil.ok) {
      assert.equal(
        ringkas(hasil.jurnal.postings),
        "1-1100:300000 DEBIT | 4-1000:100000 CREDIT | 4-2000:200000 CREDIT",
      );
    }
  });

  it("tanpa subtotal, seluruh invoice dianggap penjualan barang", () => {
    // Default "semua barang". Default "semua jasa" pernah dibuat di engine ini
    // dan test di atas yang menangkapnya -- seluruh penjualan retail akan masuk
    // akun jasa tanpa ada yang melihat.
    const hasil = jurnalDariInvoice({
      businessDate: TANGGAL,
      invoiceNumber: "INV-002b",
      invoiceId: "inv2b",
      totalAmount: 750_000,
    });
    assert.equal(hasil.ok, true);
    if (hasil.ok) {
      assert.equal(
        ringkas(hasil.jurnal.postings),
        "1-1100:750000 DEBIT | 4-1000:750000 CREDIT",
      );
    }
  });

  it("nominal nol tidak menghasilkan jurnal", () => {
    assert.equal(
      jurnalDariInvoice({
        businessDate: TANGGAL,
        invoiceNumber: "INV-0",
        invoiceId: "inv0",
        totalAmount: 0,
      }).ok,
      false,
    );
  });

  it("menolak subtotal yang melebihi total", () => {
    const hasil = jurnalDariInvoice({
      businessDate: TANGGAL,
      invoiceNumber: "INV-003",
      invoiceId: "inv3",
      totalAmount: 100_000,
      subtotal: 150_000,
    });
    assert.equal(hasil.ok, false);
  });

  it("membawa referensi dokumen supaya jurnal bisa ditelusuri balik", () => {
    const hasil = jurnalDariInvoice({
      businessDate: TANGGAL,
      invoiceNumber: "INV-004",
      invoiceId: "inv4",
      totalAmount: 500_000,
    });
    assert.equal(hasil.ok, true);
    if (hasil.ok) {
      assert.equal(hasil.jurnal.refType, "invoice");
      assert.equal(hasil.jurnal.refId, "inv4");
      assert.equal(hasil.jurnal.reference, "INV-004");
    }
  });
});

describe("jurnal dari pembayaran", () => {
  it("kas masuk mengurangi piutang, tidak menambah pendapatan lagi", () => {
    // Kalau jurnal ini juga menyentuh pendapatan, satu invoice dihitung dua
    // kali -- kesalahan yang paling sering terjadi saat kasir diganti pembukuan.
    const hasil = jurnalDariPembayaran({
      businessDate: TANGGAL,
      invoiceNumber: "INV-001",
      invoiceId: "inv1",
      totalAmount: 1_000_000,
    });
    assert.equal(hasil.ok, true);
    if (hasil.ok) {
      assert.equal(
        ringkas(hasil.jurnal.postings),
        "1-1001:1000000 DEBIT | 1-1100:1000000 CREDIT",
      );
      assert.ok(
        !hasil.jurnal.postings.some(
          (p) => p.kode === KODE_AKUN.pendapatanPenjualan,
        ),
        "pembayaran tidak boleh menyentuh pendapatan",
      );
    }
  });

  it("lewat bank memakai akun Bank, bukan Kas", () => {
    const hasil = jurnalDariPembayaran({
      businessDate: TANGGAL,
      invoiceNumber: "INV-002",
      invoiceId: "inv2",
      totalAmount: 250_000,
      lewatBank: true,
    });
    assert.equal(hasil.ok, true);
    if (hasil.ok) assert.equal(hasil.jurnal.postings[0].kode, KODE_AKUN.bank);
  });
});

describe("HPP", () => {
  it("mengakui HPP terpisah dari pendapatan", () => {
    // Dr HPP / Cr Persediaan. Dipisah dari jurnal pendapatan karena HPP
    // mengikuti saat barang keluar, pendapatan mengikuti saat faktur terbit.
    const hasil = jurnalHppTerjual({
      businessDate: TANGGAL,
      reference: "INV-001",
      hpp: 600_000,
    });
    assert.ok(hasil);
    if (hasil?.ok) {
      assert.equal(
        ringkas(hasil.jurnal.postings),
        "5-1000:600000 DEBIT | 1-1200:600000 CREDIT",
      );
    }
  });

  it("HPP nol tidak menghasilkan jurnal sama sekali", () => {
    // Ini jalur yang dipakai invoice jasa, atau invoice yang belum punya
    // movement. Jurnal dengan dua baris nol hanya menambah baris tanpa
    // menjelaskan apa pun.
    assert.equal(
      jurnalHppTerjual({ businessDate: TANGGAL, reference: "INV-J", hpp: 0 }),
      null,
    );
  });

  it("HPP negatif ditolak", () => {
    assert.equal(
      jurnalHppTerjual({ businessDate: TANGGAL, reference: "INV-N", hpp: -100 }),
      null,
    );
  });
});

describe("pembelian stok", () => {
  it("memasukkan persediaan sebagai aset, bukan beban", () => {
    // Membebankan stok di bulan pembelian tanpa penjualan apa pun akan
    // menurunkan laba -- dan zakat -- padahal belum ada barang terjual.
    const hasil = jurnalPembelianStok({
      businessDate: TANGGAL,
      reference: "BATCH-001",
      nominal: 2_000_000,
    });
    assert.equal(hasil.ok, true);
    if (hasil.ok) {
      assert.equal(hasil.jurnal.postings[0].kode, KODE_AKUN.persediaan);
      assert.ok(
        !hasil.jurnal.postings.some(
          (p) => p.sisi === "DEBIT" && p.kode.startsWith("5-"),
        ),
        "pembelian stok tidak boleh menyentuh akun beban",
      );
    }
  });

  it("lewat bank mengurangi Bank", () => {
    const hasil = jurnalPembelianStok({
      businessDate: TANGGAL,
      reference: "BATCH-002",
      nominal: 100_000,
      lewatBank: true,
    });
    assert.equal(hasil.ok, true);
    if (hasil.ok) assert.equal(hasil.jurnal.postings[1].kode, KODE_AKUN.bank);
  });
});

describe("pengeluaran operasional", () => {
  it("memetakan kategori ke akun beban yang sesuai", () => {
    const hasil = jurnalDariPengeluaran({
      businessDate: TANGGAL,
      reference: "EXP-001",
      nominal: 450_000,
      kategori: "SALARY",
    });
    assert.equal(hasil.ok, true);
    if (hasil.ok) {
      assert.equal(hasil.jurnal.postings[0].kode, KODE_AKUN.bebanGaji);
    }
  });

  it("menolak kategori PURCHASE, karena itu jalur aset", () => {
    // Ini pengaman, bukan sekadar division. Kalau expense kategori PURCHASE
    // sampai ke jurnal beban, laba turun pada pembelian dan zakat ikut turun.
    const hasil = jurnalDariPengeluaran({
      businessDate: TANGGAL,
      reference: "EXP-002",
      nominal: 900_000,
      kategori: "PURCHASE",
    });
    assert.equal(hasil.ok, false);
    if (!hasil.ok) {
      assert.match(hasil.alasan, /jurnalPembelianStok/);
      assert.match(hasil.alasan, /aset/);
    }
  });
});

describe("jurnal pembalik", () => {
  const asli = {
    id: "j1",
    businessDate: new Date("2026-10-01T00:00:00Z"),
    postings: [
      { kode: KODE_AKUN.kas, nominal: 100_000, sisi: "DEBIT" as const },
      {
        kode: KODE_AKUN.pendapatanPenjualan,
        nominal: 100_000,
        sisi: "CREDIT" as const,
      },
    ],
  };

  it("menukar sisi dan mempertahankan nominal", () => {
    const hasil = jurnalPembalik(asli, TANGGAL);
    assert.equal(hasil.ok, true);
    if (hasil.ok) {
      assert.equal(
        ringkas(hasil.jurnal.postings),
        "1-1001:100000 CREDIT | 4-1000:100000 DEBIT",
      );
      assert.equal(hasil.jurnal.reversedFromId, "j1");
      assert.equal(hasil.jurnal.source, "REVERSAL");
    }
  });

  it("jurnal pembalik tetap seimbang", () => {
    // Kalau pembalik tidak seimbang, pembatalan justru merusak pembukuan --
    // lebih buruk daripada tidak membatalkan sama sekali.
    const hasil = jurnalPembalik(asli, TANGGAL);
    assert.equal(hasil.ok, true);
    if (hasil.ok) {
      const debit = hasil.jurnal.postings
        .filter((p) => p.sisi === "DEBIT")
        .reduce((s, p) => s + p.nominal, 0);
      const kredit = hasil.jurnal.postings
        .filter((p) => p.sisi === "CREDIT")
        .reduce((s, p) => s + p.nominal, 0);
      assert.equal(debit, kredit);
    }
  });

  it("membawa tanggal pembatalan, bukan tanggal jurnal asli", () => {
    // Membatalkan jurnal lama bulan lalu berarti jurnal pembalik masuk ke
    // periode bulan ini -- itulah yang membuat tutup buku bermakna.
    const hasil = jurnalPembalik(asli, TANGGAL);
    assert.equal(hasil.ok, true);
    if (hasil.ok) {
      assert.equal(hasil.jurnal.businessDate.getTime(), TANGGAL.getTime());
    }
  });
});

describe("saldo awal", () => {
  it("secara teknis bisa diracik, tapi belum ada pemanggilnya di Fase 1", () => {
    // Saldo awal bukan transaksi; ia memisahkan masa lalu dari masa depan.
    // Membukanya lewat jurnal biasa membuat "laba tahun lalu" memuat angka yang
    // bukan miliknya.
    //
    // Yang dijaga test ini adalah KEPUTUSAN: saldo awal ditunda sampai migrasi
    // data diputuskan (PRD 9 butir 2). Begitu ada pemanggil, test ini harus
    // berubah -- bukan karena mesinnya salah, tapi karena keputusannya berubah.
    const hasil = racikJurnal({
      source: "OPENING",
      businessDate: TANGGAL,
      postings: [
        { kode: KODE_AKUN.kas, nominal: 1_000_000, sisi: "DEBIT" },
        { kode: KODE_AKUN.modalDisetor, nominal: 1_000_000, sisi: "CREDIT" },
      ],
    });
    assert.equal(hasil.ok, true);
    if (hasil.ok) assert.equal(hasil.jurnal.source, "OPENING");
  });
});
