import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BusinessType } from "@/generated/prisma/client";
import { parseTanggalInput } from "@/lib/stock";
import {
  hitungRingkasan,
  langkahStatusBerikut,
  labelProgram,
  perluDitinjau,
  pesanRentangTanggal,
  statusBolehDipakai,
  tanggalIso,
  tanggalNull,
} from "./utils";
import { createProgramSchema } from "./schemas/program-schema";

// Tes logika murni modul Program (PRD 4.F). Hanya fungsi tanpa I/O di sini:
// angka uang, status, tanggal, dan label industri adalah bagian yang paling
// mungkin salah dan paling murah dibuktikan.

describe("labelProgram", () => {
  it("menyebut program dengan istilah industrinya", () => {
    assert.equal(labelProgram("TRAVEL_UMROH").program, "Kloter");
    assert.equal(labelProgram("PROJECT_BASED").program, "Proyek");
    assert.equal(labelProgram("EDUCATION").program, "Tahun Ajaran");
    assert.equal(labelProgram("JASA_ORDER").program, "Pesanan");
    assert.equal(labelProgram("RETAIL_FNB").program, "Acara");
  });

  it("jatuh ke label netral untuk jenis usaha tanpa sebutan khusus", () => {
    for (const jenis of ["TRADING", "HEALTH_CLINIC", "OTHER"] as BusinessType[]) {
      assert.deepEqual(labelProgram(jenis), {
        program: "Program",
        peserta: "Peserta",
      });
    }
  });

  it("ikut menyebut pesertanya, bukan hanya programnya", () => {
    assert.equal(labelProgram("TRAVEL_UMROH").peserta, "Jamaah");
    assert.equal(labelProgram("EDUCATION").peserta, "Siswa");
  });
});

describe("langkahStatusBerikut", () => {
  it("maju satu tahap dan bisa batal dari mana pun", () => {
    assert.deepEqual(langkahStatusBerikut("PLANNING"), ["ACTIVE", "CANCELLED"]);
    assert.deepEqual(langkahStatusBerikut("ACTIVE"), ["COMPLETED", "CANCELLED"]);
  });

  it("tidak membuka kembali program yang sudah ditutup", () => {
    // Alasannya pembukuan: laporan bulan lalu tidak boleh berubah sendiri.
    assert.deepEqual(langkahStatusBerikut("COMPLETED"), []);
    assert.deepEqual(langkahStatusBerikut("CANCELLED"), []);
    assert.equal(statusBolehDipakai("COMPLETED", "ACTIVE"), false);
    assert.equal(statusBolehDipakai("CANCELLED", "ACTIVE"), false);
  });

  it("membiarkan status tidak berubah (form dikirim tanpa mengubah pilihan)", () => {
    assert.equal(statusBolehDipakai("COMPLETED", "COMPLETED"), true);
  });

  it("melompat mundur dari ACTIVE ke PLANNING ditolak", () => {
    assert.equal(statusBolehDipakai("ACTIVE", "PLANNING"), false);
  });
});

describe("pesanRentangTanggal", () => {
  it("menerima rentang yang normal dan tanggal selesai kosong", () => {
    assert.equal(pesanRentangTanggal("2026-01-10", "2026-03-01"), null);
    assert.equal(pesanRentangTanggal("2026-01-10", null), null);
    assert.equal(pesanRentangTanggal("2026-01-10", ""), null);
    assert.equal(pesanRentangTanggal("2026-01-10", "2026-01-10"), null);
  });

  it("menolak tanggal selesai sebelum tanggal mulai", () => {
    const pesan = pesanRentangTanggal("2026-03-01", "2026-02-01");
    assert.ok(pesan);
    assert.match(pesan, /tidak boleh sebelum/);
  });

  it("menolak string yang bukan tanggal kalender", () => {
    // 31 Februari lolos regex YYYY-MM-DD tetapi bukan tanggal nyata.
    assert.ok(pesanRentangTanggal("2026-02-31", null));
    assert.ok(pesanRentangTanggal("2026-13-01", null));
    assert.ok(pesanRentangTanggal("besok", null));
    assert.ok(pesanRentangTanggal("2026-01-10", "2026-02-30"));
  });
});

describe("hitungRingkasan", () => {
  it("menghitung persen dan sisa target", () => {
    const hasil = hitungRingkasan({
      targetAmount: 400_000_000,
      budgetAmount: null,
      collected: 150_000_000,
      spent: 0,
    });
    assert.equal(hasil.persenTarget, 37.5);
    assert.equal(hasil.sisaTarget, 250_000_000);
    assert.equal(hasil.anggaranTerlewat, false);
  });

  it("tanpa target tidak menghasilkan 0% yang menyesatkan", () => {
    // 0% berarti "belum ada yang masuk"; tanpa target artinya "tidak diukur".
    const hasil = hitungRingkasan({
      targetAmount: null,
      budgetAmount: null,
      collected: 5_000_000,
      spent: 1_000_000,
    });
    assert.equal(hasil.persenTarget, null);
    assert.equal(hasil.sisaTarget, 0);
    assert.equal(hasil.sisaAnggaran, null);
    assert.equal(hasil.saldo, 4_000_000);
  });

  it("target terlampaui tidak menghasilkan sisa negatif", () => {
    const hasil = hitungRingkasan({
      targetAmount: 10_000_000,
      budgetAmount: 5_000_000,
      collected: 12_000_000,
      spent: 4_000_000,
    });
    assert.equal(hasil.sisaTarget, 0);
    assert.equal(hasil.persenTarget, 120);
  });

  it("pengeluaran melewati anggaran ditandai, bukan disembunyikan", () => {
    const hasil = hitungRingkasan({
      targetAmount: null,
      budgetAmount: 10_000_000,
      collected: 20_000_000,
      spent: 13_500_000.5,
    });
    assert.equal(hasil.anggaranTerlewat, true);
    assert.equal(hasil.sisaAnggaran, -3_500_000.5);
    assert.equal(hasil.saldo, 6_499_999.5);
  });

  it("membulatkan ke sen, bukan membiarkan pecahan biner menumpuk", () => {
    const hasil = hitungRingkasan({
      targetAmount: null,
      budgetAmount: null,
      collected: 0.1 + 0.2,
      spent: 0,
    });
    assert.equal(hasil.saldo, 0.3);
  });
});

describe("perluDitinjau", () => {
  const sekarang = new Date("2026-05-10T12:00:00");

  it("menandai program berjalan yang tanggal selesainya sudah lewat", () => {
    assert.equal(perluDitinjau("ACTIVE", "2026-05-01", sekarang), true);
  });

  it("tidak menandai yang masih punya waktu", () => {
    assert.equal(perluDitinjau("ACTIVE", "2026-06-01", sekarang), false);
    assert.equal(perluDitinjau("ACTIVE", null, sekarang), false);
  });

  it("tidak menandai status yang sudah ditutup", () => {
    // Sekali selesai/dibatalkan, tanggal lewat adalah hal yang wajar.
    assert.equal(perluDitinjau("COMPLETED", "2026-05-01", sekarang), false);
    assert.equal(perluDitinjau("CANCELLED", "2026-05-01", sekarang), false);
    assert.equal(perluDitinjau("PLANNING", "2026-05-01", sekarang), false);
  });
});

describe("createProgramSchema", () => {
  const lengkap = {
    name: "Umrah Reguler Oktober",
    startDate: "2026-10-01",
  };

  it("menerima isian minimal", () => {
    const hasil = createProgramSchema.safeParse(lengkap);
    assert.equal(hasil.success, true);
  });

  it("menganggap kolom kosong sebagai 'tidak dipasang', bukan nol", () => {
    const hasil = createProgramSchema.safeParse({
      ...lengkap,
      endDate: "",
      targetAmount: "",
      budgetAmount: "  ",
    });
    assert.equal(hasil.success, true);
    if (hasil.success) {
      assert.equal(hasil.data.endDate, undefined);
      assert.equal(hasil.data.targetAmount, undefined);
      assert.equal(hasil.data.budgetAmount, undefined);
    }
  });

  it("menolak tanggal selesai sebelum tanggal mulai lewat satu jalur uji", () => {
    const hasil = createProgramSchema.safeParse({
      ...lengkap,
      endDate: "2026-09-01",
    });
    assert.equal(hasil.success, false);
    if (!hasil.success) {
      assert.deepEqual(hasil.error.issues[0]?.path, ["endDate"]);
    }
  });

  it("menolak nominal negatif dan teks yang bukan angka", () => {
    assert.equal(
      createProgramSchema.safeParse({ ...lengkap, targetAmount: "-1000" }).success,
      false,
    );
    assert.equal(
      createProgramSchema.safeParse({ ...lengkap, targetAmount: "sepuluh juta" })
        .success,
      false,
    );
  });

  it("menolak nama terlalu pendek", () => {
    assert.equal(
      createProgramSchema.safeParse({ ...lengkap, name: "A" }).success,
      false,
    );
  });
});

describe("tanggalIso / tanggalNull", () => {
  it("membaca ulang tanggal yang sama seperti saat dimasukkan", () => {
    // Regresi: form memakai input type="date" dan kolomnya TIMESTAMP(3) tanpa
    // zona. Membangun Date dari "T00:00:00" tanpa "Z" membuat "1 Jan 2027"
    // tersimpan dan tampil sebagai "31 Des 2026" pada zona UTC+7.
    for (const hari of ["2026-01-31", "2026-12-31", "2027-01-01", "2028-02-29"]) {
      assert.equal(tanggalIso(parseTanggalInput(hari)), hari);
    }
  });

  it("menyimpan tanggal sebagai tengah malam UTC, bukan tengah malam lokal", () => {
    assert.equal(
      parseTanggalInput("2027-01-01").toISOString(),
      "2027-01-01T00:00:00.000Z",
    );
  });

  it("tanggal selesai yang kosong tetap null, bukan tanggal hari ini", () => {
    assert.equal(tanggalNull(null), null);
    assert.equal(tanggalNull(parseTanggalInput("2027-02-15")), "2027-02-15");
  });
});
