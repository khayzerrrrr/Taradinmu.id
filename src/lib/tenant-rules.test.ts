import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Role } from "@/generated/prisma/client";
import {
  nilaiAksesTenant,
  PESAN_BUKAN_ANGGOTA,
  PESAN_PERAN_OWNER,
  PESAN_PERAN_PENGGUNA,
  PESAN_PERAN_UMUM,
  PESAN_TANPA_SESI,
  rumahSetelahMasuk,
  TENANT_MANAGER_ROLES,
  TENANT_OWNER_ROLES,
  TENANT_USER_MANAGER_ROLES,
  type SesiPengguna,
} from "./tenant-rules";

// Tes isolasi tenant.
//
// Ini penjaga satu-satunya properti yang kegagalannya tidak bisa dimaafkan pada
// SaaS multi-tenant: pengguna tenant A tidak boleh pernah menyentuh data tenant B.
// Kebocoran lintas-tenant menghancurkan kepercayaan seluruh anggota SUMU sekaligus,
// sedangkan bug fitur biasa hanya mengganggu. Karena itu aturannya dikunci di sini,
// bukan hanya diandalkan pada review manual.

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

// Seluruh role yang ada di enum Role. Dipakai untuk menyapu matriks, supaya role
// baru yang ditambahkan nanti otomatis ikut diuji — bukan diam-diam lolos.
const SEMUA_ROLE: readonly Role[] = [
  "SUPER_ADMIN",
  "OWNER",
  "ADMIN",
  "STAFF",
  "ACCOUNTANT",
];

function sesi(role: Role, tenantId: string | null): SesiPengguna {
  return { id: `user-${role}`, role, tenantId };
}

// Izin "mengelola data tenant": OWNER/ADMIN/STAFF, plus SUPER_ADMIN.
function kelolaData(user: SesiPengguna | null, tenantId: string) {
  return nilaiAksesTenant(
    user,
    tenantId,
    TENANT_MANAGER_ROLES,
    PESAN_PERAN_UMUM,
  );
}

describe("nilaiAksesTenant — tanpa sesi", () => {
  it("menolak dan meminta masuk lebih dulu", () => {
    const hasil = kelolaData(null, TENANT_A);
    assert.equal(hasil.ok, false);
    if (hasil.ok) return;
    assert.equal(hasil.message, PESAN_TANPA_SESI);
  });
});

describe("nilaiAksesTenant — lintas tenant (properti paling kritis)", () => {
  it("SETIAP role non-SUPER_ADMIN ditolak saat mengakses tenant lain", () => {
    // Disapu untuk semua role, bukan hanya OWNER. Menambah role baru ke enum
    // Role tanpa memikirkan isolasi tenant akan langsung memerahkan tes ini.
    const roleNonSuper = SEMUA_ROLE.filter((role) => role !== "SUPER_ADMIN");

    for (const role of roleNonSuper) {
      const hasil = kelolaData(sesi(role, TENANT_A), TENANT_B);
      assert.equal(
        hasil.ok,
        false,
        `role ${role} seharusnya TIDAK boleh mengakses tenant lain`,
      );
      if (hasil.ok) continue;
      // Pesannya harus "bukan anggota", yang membuktikan penolakan datang dari
      // pemeriksaan keanggotaan — bukan kebetulan dari pemeriksaan role.
      assert.equal(hasil.message, PESAN_BUKAN_ANGGOTA);
    }
  });

  it("anggota tanpa tenant (tenantId null) ditolak", () => {
    const hasil = kelolaData(sesi("OWNER", null), TENANT_A);
    assert.equal(hasil.ok, false);
    if (hasil.ok) return;
    assert.equal(hasil.message, PESAN_BUKAN_ANGGOTA);
  });

  it("keanggotaan diperiksa sebelum role, sehingga role tinggi pun tetap ditolak", () => {
    // Bila urutan pemeriksaan tertukar, pesan yang keluar akan PESAN_PERAN_UMUM.
    const hasil = nilaiAksesTenant(
      sesi("ACCOUNTANT", TENANT_A),
      TENANT_B,
      TENANT_MANAGER_ROLES,
      PESAN_PERAN_UMUM,
    );
    assert.equal(hasil.ok, false);
    if (hasil.ok) return;
    assert.equal(hasil.message, PESAN_BUKAN_ANGGOTA);
  });
});

describe("nilaiAksesTenant — SUPER_ADMIN", () => {
  it("boleh mengakses tenant mana pun", () => {
    for (const tenantId of [TENANT_A, TENANT_B, "tenant-baru"]) {
      const hasil = kelolaData(sesi("SUPER_ADMIN", null), tenantId);
      assert.equal(hasil.ok, true, `SUPER_ADMIN seharusnya boleh di ${tenantId}`);
    }
  });

  it("tetap boleh saat mode impersonasi (tenantId menunjuk tenant lain)", () => {
    // PRD 4.B: impersonasi TIDAK menurunkan role, jadi cabang SUPER_ADMIN yang
    // berlaku. Bila kelak impersonasi diubah menjadi penurunan hak, tes ini
    // harus ikut diperbarui secara sadar.
    const hasil = kelolaData(sesi("SUPER_ADMIN", TENANT_A), TENANT_B);
    assert.equal(hasil.ok, true);
  });
});

describe("nilaiAksesTenant — anggota tenant sendiri", () => {
  it("OWNER, ADMIN, STAFF boleh mengelola data", () => {
    for (const role of ["OWNER", "ADMIN", "STAFF"] as const) {
      const hasil = kelolaData(sesi(role, TENANT_A), TENANT_A);
      assert.equal(hasil.ok, true, `role ${role} seharusnya boleh`);
    }
  });

  it("mengembalikan userId pemanggil saat diizinkan", () => {
    const hasil = kelolaData(sesi("OWNER", TENANT_A), TENANT_A);
    assert.equal(hasil.ok, true);
    if (!hasil.ok) return;
    assert.equal(hasil.userId, "user-OWNER");
  });
});

describe("matriks role tiap gerbang", () => {
  it("gerbang data: OWNER, ADMIN, STAFF", () => {
    assert.deepEqual([...TENANT_MANAGER_ROLES], ["OWNER", "ADMIN", "STAFF"]);
  });

  it("gerbang identitas/branding: hanya OWNER", () => {
    assert.deepEqual([...TENANT_OWNER_ROLES], ["OWNER"]);
  });

  it("gerbang pengguna: hanya OWNER dan ADMIN", () => {
    assert.deepEqual([...TENANT_USER_MANAGER_ROLES], ["OWNER", "ADMIN"]);
  });

  it("STAFF ditolak di gerbang pengguna, dengan pesan khusus", () => {
    const hasil = nilaiAksesTenant(
      sesi("STAFF", TENANT_A),
      TENANT_A,
      TENANT_USER_MANAGER_ROLES,
      PESAN_PERAN_PENGGUNA,
    );
    assert.equal(hasil.ok, false);
    if (hasil.ok) return;
    assert.equal(hasil.message, PESAN_PERAN_PENGGUNA);
  });

  it("ADMIN ditolak di gerbang branding, dengan pesan khusus", () => {
    const hasil = nilaiAksesTenant(
      sesi("ADMIN", TENANT_A),
      TENANT_A,
      TENANT_OWNER_ROLES,
      PESAN_PERAN_OWNER,
    );
    assert.equal(hasil.ok, false);
    if (hasil.ok) return;
    assert.equal(hasil.message, PESAN_PERAN_OWNER);
  });
});

// CATATAN — pertanyaan produk yang belum diputuskan, sengaja tidak disembunyikan:
// ACCOUNTANT bisa dibuat lewat halaman Pengguna (ASSIGNABLE_ROLES di
// user-schema.ts) dan diberi label "Akuntan", tetapi tidak masuk
// TENANT_MANAGER_ROLES. Akibatnya akun Akuntan bisa masuk lalu langsung
// dialihkan keluar dari dashboard tanpa bisa melakukan apa pun.
// Tes di bawah mengunci KEADAAN SEKARANG, bukan menyatakan bahwa ini benar.
// Bila pemilik produk memutuskan Akuntan boleh membaca data, ubah
// TENANT_MANAGER_ROLES dan tes ini bersama-sama.
describe("ACCOUNTANT — keadaan sekarang, menunggu keputusan produk", () => {
  it("ditolak oleh gerbang data", () => {
    const hasil = kelolaData(sesi("ACCOUNTANT", TENANT_A), TENANT_A);
    assert.equal(hasil.ok, false);
  });
});

describe("rumahSetelahMasuk", () => {
  it("mengirim Super Admin ke area platform, bukan ke halaman pemasaran", () => {
    assert.equal(rumahSetelahMasuk("SUPER_ADMIN", null), "/admin");
  });

  it("mengirim pengguna tenant ke dashboard tenantnya sendiri", () => {
    for (const role of ["OWNER", "ADMIN", "STAFF", "ACCOUNTANT"] as const) {
      assert.equal(rumahSetelahMasuk(role, "berkah-haramain"), "/berkah-haramain/dashboard");
    }
  });

  it("tidak pernah memberi Super Admin dashboard tenant", () => {
    // Bila ini berubah, mode impersonasi bukan lagi satu-satunya jalan masuk
    // Super Admin ke data tenant.
    assert.equal(rumahSetelahMasuk("SUPER_ADMIN", "toko-berkah"), "/admin");
  });

  it("jatuh ke \"/\" untuk akun tanpa tenant, bukan ke /admin", () => {
    // Fallback aman: "/" selalu bisa dibuka, sedangkan "/admin" akan menolak
    // dan meninggalkan pengguna di halaman kosong.
    for (const role of SEMUA_ROLE) {
      if (role === "SUPER_ADMIN") continue;
      assert.equal(rumahSetelahMasuk(role, null), "/");
    }
  });

  it("slug menjadi satu-satunya segmen path, tanpa jalur mencurigakan", () => {
    // Menjaga bentuk hasil bila suatu saat slug mengandung karakter aneh;
    // validasi slug ada di schema tenant, tapi fungsi ini tidak boleh
    // menghasilkan something seperti "//" atau "/../".
    const hasil = rumahSetelahMasuk("OWNER", "toko-demo");
    assert.equal(hasil, "/toko-demo/dashboard");
    assert.ok(!hasil.includes("//"));
  });
});
