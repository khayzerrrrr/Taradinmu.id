import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createTenantSchema,
  tanggalIsoLokal,
  tanggalMasaBerlaku,
  updateTenantSchema,
} from "./tenant-schema";

// Isian masa berlaku paket (PRD 4.D.4) melewati dua tangan: format tanggal HTML
// di dialog Super Admin, dan kolom `DateTime?` di database. Kedua sisi itu diuji
// di sini karena kegagalan di salah satunya berbunyi "tenant kehilangan akses
// pada hari yang salah".

describe("isian tanggal masa berlaku", () => {
  it("kosong berarti tanpa tanggal berakhir, bukan hari ini", () => {
    // Bedanya besar: "hari ini" akan menurunkan paket PRO tenant saat itu juga.
    assert.equal(tanggalMasaBerlaku(undefined), null);
    assert.equal(tanggalMasaBerlaku(""), null);
  });

  it("tanggal disimpan sebagai tengah malam UTC", () => {
    assert.equal(
      tanggalMasaBerlaku("2026-10-31")?.toISOString(),
      "2026-10-31T00:00:00.000Z",
    );
  });

  it("tanggal yang tidak ada di kalender ditolak, bukan digeser", () => {
    // new Date("2026-02-31") justru BERHASIL dan menjadi 3 Maret. Kalau itu
    // lolos, tenant yang seharusnya kehilangan akses pada 1 Maret masih dibayar
    // penuh tiga hari lebih lama tanpa ada yang tahu.
    assert.equal(tanggalMasaBerlaku("2026-02-31"), null);
    assert.equal(tanggalMasaBerlaku("2026-04-31"), null);
    assert.equal(tanggalMasaBerlaku("2026-13-01"), null);
    assert.equal(tanggalMasaBerlaku("bukan-tanggal"), null);
  });

  it("pergi-pulang antar format tidak menggeser harinya", () => {
    // Dialog mengisi kolom dengan YYYY-MM-DD; tabel membacanya kembali. Selisih
    // satu hari di sini akan membuat "berlaku sampai" tampil berbeda dari yang
    // diketik admin.
    for (const isian of ["2026-01-01", "2026-09-26", "2026-12-31"]) {
      assert.equal(tanggalIsoLokal(tanggalMasaBerlaku(isian)), isian);
    }
    assert.equal(tanggalIsoLokal(null), "");
    assert.equal(tanggalIsoLokal(undefined), "");
    assert.equal(tanggalIsoLokal("bukan tanggal"), "");
  });

  it("menyimpan object Date langsung tetap terbaca", () => {
    // Kolomnya bisa diisi dari object Date hasil query Prisma, bukan hanya string.
    assert.equal(tanggalIsoLokal(new Date("2026-09-26T00:00:00.000Z")), "2026-09-26");
  });
});

describe("skema update paket tenant", () => {
  const dasar = { tenantId: "t1", plan: "PRO", enabledModules: ["BILLING"] };

  it("menerima tanggal masa berlaku dan catatan", () => {
    const hasil = updateTenantSchema.safeParse({
      ...dasar,
      expiresAt: "2026-10-31",
      catatan: "pembayaran 15 Sep via WhatsApp",
    });
    assert.equal(hasil.success, true);
  });

  it("menolak format selain YYYY-MM-DD", () => {
    // Bukan soal kerapian: "31-10-2026" akan terbaca sebagai tanggal lain atau
    // sama sekali tidak terbaca, dan yang berubah adalah hak akses orang.
    assert.equal(
      updateTenantSchema.safeParse({ ...dasar, expiresAt: "31-10-2026" }).success,
      false,
    );
    assert.equal(
      updateTenantSchema.safeParse({ ...dasar, expiresAt: "2026-10-3" }).success,
      false,
    );
    assert.equal(
      updateTenantSchema.safeParse({ ...dasar, expiresAt: "2026-10-31T00:00" })
        .success,
      false,
    );
  });

  it("kolom kosong tetap sah", () => {
    assert.equal(
      updateTenantSchema.safeParse({ ...dasar, expiresAt: "" }).success,
      true,
    );
    assert.equal(updateTenantSchema.safeParse(dasar).success, true);
  });

  it("catatan yang terlalu panjang ditolak sebelum menyentuh riwayat", () => {
    // Tabel PlanChange menyimpannya apa adanya; 200 karakter adalah batas yang
    // dijanjikan di dialog, bukan yang ditegakkan di dalam hati.
    assert.equal(
      updateTenantSchema.safeParse({ ...dasar, catatan: "a".repeat(201) }).success,
      false,
    );
    assert.equal(
      updateTenantSchema.safeParse({ ...dasar, catatan: "a".repeat(200) }).success,
      true,
    );
  });
});

describe("skema pembuatan tenant", () => {
  const dasar = {
    name: "Toko Berkah",
    plan: "PRO",
    enabledModules: ["BILLING"],
    ownerName: "Budi",
    ownerEmail: "budi@toko.id",
    ownerPassword: "rahasia123",
  };

  it("provisioning boleh langsung membawa tanggal berakhir", () => {
    assert.equal(
      createTenantSchema.safeParse({ ...dasar, expiresAt: "2026-11-30" }).success,
      true,
    );
    assert.equal(createTenantSchema.safeParse(dasar).success, true);
  });

  it("tanpa paket, tenant baru tetap FREE", () => {
    const hasil = createTenantSchema.safeParse({ ...dasar, plan: undefined });
    assert.equal(hasil.success, true);
    // default() di skema: nilai yang hilang menjadi FREE, bukan null.
    assert.equal(
      hasil.success ? hasil.data.plan : null,
      "FREE",
    );
  });
});
