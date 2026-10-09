import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ambilBatasFitur,
  ambilBatasJumlah,
  AMBANG_KUOTA_DASHBOARD,
  HARGA_PRO_BULAN,
  jarakHariKe,
  labelBatasJumlah,
  LIMIT_LABELS,
  PLAN_LIMITS,
  planEfektif,
  kuotaMendesak,
  riwayatPerluDitulis,
  tanggalKedaluwarsaPlan,
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
  it("semua fitur berbayar hanya aktif pada paket PRO", () => {
    // Semua LimitFiturKey diperiksa lewat loop yang sama: menambah kunci baru
    // tanpa mengisi kolomnya di PLAN_LIMITS akan membuat tes ini merah, bukan
    // diam-diam lolos sebagai `undefined`.
    const kunci: readonly LimitFiturKey[] = [
      "BATCH",
      "ZAKAT",
      "PROGRAM",
      "HPP",
      "BRANDING",
      "AI",
    ];
    assert.ok(kunci.length >= 6);

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
      "BRANDING",
      "AI",
    ];
    assert.equal(kunci.length, 9, "ada kunci yang lupa diperiksa labelnya");

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

// Masa berlaku PRO (PRD 4.D.4). Aturan "hari terakhir masih penuh" dan
// "kedaluwarsa tidak menghapus paket" adalah janji pada penyewa, jadi keduanya
// dikunci di sini, bukan hanya dibuktikan saat verifikasi browser.
describe("masa berlaku paket", () => {
  // Enam pagi UTC: cukup jauh dari tengah malam agar tabrangan jam pada kolom
  // tanggal tidak lolos sebagai kebetulan.
  const pagi = new Date("2026-09-26T06:00:00.000Z");
  const utc = (hari: string) => new Date(`${hari}T00:00:00.000Z`);

  it("FREE tidak pernah punya masa berlaku", () => {
    // Tanggal SEMBARANGAN pada paket FREE tidak boleh mengubah apa pun — kolom
    // planExpiresAt bisa masih terisi dari masa PRO yang lalu.
    assert.equal(tanggalKedaluwarsaPlan("FREE", utc("2020-01-01"), pagi), null);
    assert.equal(planEfektif("FREE", utc("2020-01-01"), pagi), "FREE");
  });

  it("PRO tanpa tanggal berjalan terus", () => {
    // Ini kondisi semua tenant PRO yang sudah live sebelum fitur ada: mengaktifkan
    // pencatatan masa berlaku tidak boleh menurunkan mereka.
    assert.equal(tanggalKedaluwarsaPlan("PRO", null, pagi), null);
    assert.equal(tanggalKedaluwarsaPlan("PRO", undefined, pagi), null);
    assert.equal(planEfektif("PRO", null, pagi), "PRO");
  });

  it("hari terakhir masih dihitung penuh", () => {
    // "Berlaku sampai 26 Sep" berarti masih bisa berjualan pada 26 Sep. Kalau
    // batasnya diambil tengah malam tanggalnya, penyewa kehilangan akses di
    // tengah hari terakhir yang ia bayar.
    assert.equal(tanggalKedaluwarsaPlan("PRO", utc("2026-09-26"), pagi), null);
    assert.equal(planEfektif("PRO", utc("2026-09-26"), pagi), "PRO");
    // ...dan keesokan paginya baru jatuh.
    assert.equal(
      tanggalKedaluwarsaPlan("PRO", utc("2026-09-25"), pagi)?.getTime(),
      utc("2026-09-25").getTime(),
    );
  });

  it("kedaluwarsa menurunkan aksesnya, bukan paketnya", () => {
    assert.equal(planEfektif("PRO", utc("2026-09-20"), pagi), "FREE");
    // Sehari setelah hari terakhir berjalan sebagai FREE; pada hari itu sendiri
    // masih PRO (sudah dikunci tes di atas).
    assert.equal(
      planEfektif("PRO", utc("2026-09-26"), new Date("2026-09-27T01:00:00.000Z")),
      "FREE",
    );
    assert.equal(planEfektif("PRO", utc("2026-12-31"), pagi), "PRO");
  });

  it("jarak hari dihitung dari hari kalender, bukan selisih jam", () => {
    assert.equal(jarakHariKe(utc("2026-09-26"), pagi), 0);
    assert.equal(jarakHariKe(utc("2026-09-30"), pagi), 4);
    assert.equal(jarakHariKe(utc("2026-09-23"), pagi), -3);
    // Jam berapapun pada hari yang sama tetap nol.
    assert.equal(jarakHariKe(new Date("2026-09-26T23:59:00.000Z"), pagi), 0);
    assert.equal(jarakHariKe(new Date("2026-09-26T00:01:00.000Z"), pagi), 0);
  });

  it("sisa hari dihitung dari harinya penyewa, bukan harinya server", () => {
    // 25 Sep 21:00 UTC = 26 Sep 04:00 WIB. Kalau "hari ini" diambil dari UTC,
    // kalimatnya menyebut sisa satu hari lebih banyak selama tujuh jam setiap
    // pagi — dan pada server yang jalannya UTC (mis. EC2) itu terjadi setiap
    // hari, bukan hanya saat uji.
    const diniHariWib = new Date("2026-09-25T21:00:00.000Z");
    assert.equal(jarakHariKe(utc("2026-09-30"), diniHariWib), 4);    assert.equal(jarakHariKe(utc("2026-09-26"), diniHariWib), 0);
    assert.equal(jarakHariKe(utc("2026-09-25"), diniHariWib), -1);
  });

  it("hari terakhir dilayani sampai hari itu berakhir di zona penyewa", () => {
    // Batasnya 5 Okt 17:00 UTC = 6 Okt 00:00 WIB. Satu menit sebelumnya masih
    // tanggal 5 Oktober bagi penyewa, jadi aksesnya belum boleh turun.
    assert.equal(
      tanggalKedaluwarsaPlan(
        "PRO",
        utc("2026-10-05"),
        new Date("2026-10-05T16:59:00.000Z"),
      ),
      null,
    );
    assert.equal(
      tanggalKedaluwarsaPlan(
        "PRO",
        utc("2026-10-05"),
        new Date("2026-10-05T17:00:00.000Z"),
      )?.getTime(),
      utc("2026-10-05").getTime(),
    );
  });
});

// Kapan satu tombol "Simpan" di /admin layak menjadi baris PlanChange (PRD 4.D.4).
// Keputusannya pindah ke plan-limits supaya bisa diji; sebelumnya ia ditulis inline
// di Server Action dan tidak ada satu pun tes yang menyentuhnya.
describe("riwayat paket", () => {
  const utc = (hari: string) => new Date(`${hari}T00:00:00.000Z`);

  it("perpanjangan dicatat meski paketnya tidak berubah", () => {
    // Ini peristiwa paling sering di jalur ini: bulan berikutnya dibayar, PRO tetap
    // PRO, hanya tanggalnya bergeser. Kalau "berubah" diukur dari `plan` saja,
    // tidak ada satu baris pun yang tercatat untuk setiap perpanjangan — dan
    // riwayat jadi tidak bisa dipakai menagih.
    assert.equal(
      riwayatPerluDitulis(
        { plan: "PRO", planExpiresAt: utc("2026-09-30") },
        { plan: "PRO", planExpiresAt: utc("2026-10-31") },
      ),
      true,
    );
  });

  it("naik dan turun paket selalu dicatat", () => {
    assert.equal(
      riwayatPerluDitulis(
        { plan: "FREE", planExpiresAt: null },
        { plan: "PRO", planExpiresAt: null },
      ),
      true,
    );
    assert.equal(
      riwayatPerluDitulis(
        { plan: "PRO", planExpiresAt: utc("2026-12-31") },
        { plan: "FREE", planExpiresAt: null },
      ),
      true,
    );
  });

  it("hanya menggeser modul tidak menulis baris", () => {
    // Tabel ini riwayat paket, bukan log setiap klik "Simpan".
    assert.equal(
      riwayatPerluDitulis(
        { plan: "PRO", planExpiresAt: utc("2026-12-31") },
        { plan: "PRO", planExpiresAt: utc("2026-12-31") },
      ),
      false,
    );
    assert.equal(
      riwayatPerluDitulis(
        { plan: "FREE", planExpiresAt: null },
        { plan: "FREE", planExpiresAt: null },
      ),
      false,
    );
  });

  it("tanggal dibandingkan nilainya, bukan identitas objeknya", () => {
    // Kontrol positif bahwa perbandingan tidak memakai `===`: Prisma membuat
    // objek Date baru setiap query, jadi kalau identitas yang dipakai, setiap
    // penyimpanan — termasuk yang tidak mengubah apa pun — akan menulis baris.
    assert.equal(
      riwayatPerluDitulis(
        { plan: "PRO", planExpiresAt: new Date("2026-12-31T00:00:00.000Z") },
        { plan: "PRO", planExpiresAt: new Date("2026-12-31T00:00:00.000Z") },
      ),
      false,
    );
    // Dan tanggal yang berbeda pada jam yang berbeda tetap terbaca berubah.
    assert.equal(
      riwayatPerluDitulis(
        { plan: "PRO", planExpiresAt: utc("2026-12-31") },
        { plan: "PRO", planExpiresAt: new Date("2026-12-31T00:00:00.001Z") },
      ),
      true,
    );
  });
});
