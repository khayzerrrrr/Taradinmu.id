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
    assert.ok(
      mulai > -1 && akhir > mulai,
      "blok MANFAAT_KUNCI tidak ditemukan",
    );
    return (
      modal
        .slice(mulai, akhir)
        .split("\n")
        // Komentar penulis sengaja dibuang: catatan "jangan jual cicilan" menyebut
        // kata terlarang itu justru untuk melarangnya.
        .filter((baris) => !baris.trim().startsWith("//"))
        .join("\n")
    );
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
    // Daftarnya dibaca dari sumber tunggal di upgrade-interest.ts, bukan dari
    // union di modal: sejak KunciPro adalah alias KunciMinat, satu daftar berlaku
    // untuk manfaat DAN pencatatan minat. Menambah kunci baru tanpa manfaat di
    // sini menggagalkan kompilasi (Record<KunciPro, ...>), dan tes ini menjaga
    // panjang daftarnya tetap layak jual.
    const kunci = kunciMinat();
    assert.ok(
      kunci.length >= 7,
      `KunciMinat hanya punya ${kunci.length} kunci`,
    );

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

  it("kunci modal bukan daftar yang diketik ulang", () => {
    // Kalau modal mendeklarasikan unionnya sendiri, ia bisa menyimpang dari
    // daftar minat tanpa ada yang menyadarinya.
    const modal = baca(...MODAL);
    assert.match(
      modal,
      /export type KunciPro = KunciMinat;/,
      "KunciPro sebaiknya alias KunciMinat, bukan union kedua",
    );
    // Salinan umum tidak boleh bisa dipakai diam-diam: pemicu wajib menyebut
    // kuncinya, dan "UMUM" adalah nilai yang dipilih sadar.
    assert.match(modal, /kunci: KunciPro;/);
    assert.ok(
      !/kunci\?:/.test(modal),
      "`kunci` jangan opsional — modal jatuh ke daftar umum tanpa ada yang tahu",
    );
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
    assert.ok(
      tanpaKunci.length === 0,
      `modal tanpa kunci: ${tanpaKunci.join(" | ")}`,
    );
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

  it("halaman produk memakai pola yang sama dengan halaman invoice", () => {
    // Kuota produk sudah ditegakkan di Server Action sejak lama, tetapi tombol
    // "Tambah Produk" tetap terbuka: orang mengisi form panjang lalu ditolak.
    // Halaman Invoice dan Pengguna sudah lebih dulu bertingkah laku benar.
    const halaman = baca(
      "app",
      "(tenant)",
      "[tenantSlug]",
      "dashboard",
      "inventory",
      "page.tsx",
    );
    assert.match(halaman, /checkLimit\(\s*tenant\.id,\s*"PRODUCT"\s*\)/);
    assert.match(halaman, /<UpgradeModal[\s\S]*?kunci="PRODUCT"/);
    assert.match(halaman, /sumber="HALAMAN_PRODUK"/);
    // Yang ditolak hanya additions baru; meyakinkan bahwa katalog lama aman jual.
    assert.match(halaman, /tetap bisa dijual/);
  });
});

describe("pesan batas menjual, bukan melarang", () => {
  it("setiap kunci menyebut apa yang terbuka di PRO", () => {
    const isi = baca(...GUARDS);
    const blok = isi.match(/const MANFAAT_LIMIT[\s\S]*?\n};/);
    assert.ok(blok, "MANFAAT_LIMIT tidak ditemukan di feature-guards.ts");
    // Kuncinya dibaca dari deklarasi LimitKey, bukan dari daftar yang diketik
    // ulang di sini: kalau tidak, tes ini tetap hijau saat kunci baru ditambahkan.
    const kunci = kunciLimit();
    assert.ok(kunci.length >= 9, `LimitKey hanya punya ${kunci.length} kunci`);
    for (const key of kunci) {
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

/** Anggota `KunciMinat` sebagaimana dideklarasikan di upgrade-interest.ts. */
function kunciMinat(): string[] {
  const isi = baca("lib", "upgrade-interest.ts");
  const deklarasi = isi.match(
    /export const KUNCI_MINAT = \[([\s\S]*?)\] as const/,
  );
  assert.ok(deklarasi, "KUNCI_MINAT tidak ditemukan di upgrade-interest.ts");
  return [...deklarasi[1].matchAll(/"([A-Z]+)"/g)].map((m) => m[1]);
}

/** Anggota `LimitFiturKey` sebagaimana dideklarasikan di plan-limits.ts. */
function kunciFiturLimit(): string[] {
  const isi = baca("lib", "plan-limits.ts");
  const deklarasi = isi.match(/export type LimitFiturKey =[\s\S]*?;/);
  assert.ok(deklarasi, "tipe LimitFiturKey tidak ditemukan di plan-limits.ts");
  return [...deklarasi[0].matchAll(/"([A-Z]+)"/g)].map((m) => m[1]);
}

describe("halaman Paket Saya (PRD 4.D.3)", () => {
  const PAKET = [
    "app",
    "(tenant)",
    "[tenantSlug]",
    "dashboard",
    "paket",
    "page.tsx",
  ];

  it("angkanya dari checkLimit, cabang tampilannya dari plan-status", () => {
    const isi = baca(...PAKET);
    // Kontrol positif: berkas terbaca dan memakai helper-nya.
    assert.match(isi, /susunStatusPaket/);
    for (const key of ["INVOICE", "PRODUCT", "USERS"]) {
      assert.match(
        isi,
        new RegExp(`checkLimit\\(\\s*tenant\\.id,\\s*"${key}"\\s*\\)`),
        `kuota ${key} tidak diukur dengan aturan yang sama dengan penegakan tulis`,
      );
    }
    // Yang dilarang: halaman menyimpulkan sendiri apa yang terbuka. Membaca
    // `tenant.plan` untuk menampilkannya boleh; bercabang darinya tidak.
    assert.ok(
      !/tenant\.plan\s*[!=]==/.test(isi),
      "halaman Paket membandingkan string paket untuk memutuskan tampilan",
    );
  });

  it("menawarkan setiap fitur terkunci, dan menyebut sumber pemicunya", () => {
    const isi = baca(...PAKET);
    // Tanpa `sumber`, klik di halaman ini tercatat sebagai TIDAK_DIKETAHUI dan
    // satu-satunya tempat orang membandingkan paket jadi buta bagi admin.
    assert.match(isi, /sumber="HALAMAN_PAKET"/g);
    assert.match(isi, /kunci=\{baris\.key\}/);
  });

  it("daftar fiturnya selebar plan-limits", () => {
    // Kalau URUTAN_FITUR ketinggalan satu kunci, halaman ini tampak jujur sambil
    // menyembunyikan fitur yang justru paling ingin dibeli orang.
    const isi = baca("lib", "plan-status.ts");
    const blok = isi.match(/export const URUTAN_FITUR[\s\S]*?\];/);
    assert.ok(blok, "URUTAN_FITUR tidak ditemukan di plan-status.ts");
    const daftar = [...blok[0].matchAll(/"([A-Z]+)"/g)].map((m) => m[1]);
    assert.deepEqual(
      [...daftar].sort(),
      kunciFiturLimit().sort(),
      "daftar fitur di halaman Paket tidak sama dengan LimitFiturKey",
    );
  });

  it("menu dan tautan sidebar menunjuk ke halaman ini", () => {
    // Dua-duanya pernah menunjuk ke tempat lain: tautan "Aktifkan PRO" di
    // kaki sidebar mendarat di Pengaturan Toko.
    assert.match(
      baca("app", "(tenant)", "layout.tsx"),
      /href: `\$\{basePath\}\/dashboard\/paket`/,
    );
    const sidebar = baca("components", "layout", "app-sidebar.tsx");
    assert.match(
      sidebar,
      /href=\{`\$\{basePath\}\/dashboard\/paket`\}[\s\S]*?Aktifkan PRO/,
      "tautan upgrade di kaki sidebar tidak menuju halaman paket",
    );
    // Remah lokasi butuh label, kalau tidak rute ini menampilkan "[tenantSlug]".
    assert.match(baca("components", "layout", "nav.ts"), /paket: "/);
  });
});

describe("masa berlaku & riwayat paket (PRD 4.D.4)", () => {
  const AKAR_PROYEK = resolve(AKAR_SRC, "..");
  const TENANT_CTX = ["lib", "tenant.ts"];
  const DIALOG_KELOLA = [
    "modules",
    "core",
    "components",
    "tenant-edit-dialog.tsx",
  ];
  const TABEL_ADMIN = [
    "modules",
    "core",
    "components",
    "tenant-table.tsx",
  ];
  const PAKET = [
    "app",
    "(tenant)",
    "[tenantSlug]",
    "dashboard",
    "paket",
    "page.tsx",
  ];

  it("penegakan akses memakai paket yang sedang berlaku", () => {
    // Ini satu-satunya tempat checkLimit mendapat angkanya. Kalau sampai kembali
    // ke `tenant.plan`, menyewa PRO selama sehari berarti akses selamanya.
    const guards = baca(...GUARDS);
    assert.match(guards, /planEfektif\(/);
    assert.match(guards, /planExpiresAt:\s*true/);

    const konteks = baca(...TENANT_CTX);
    // Penulisan multi-baris (Fase 0.3 menambah argumen `timezone`), jadi yang
    // dijaga adalah urutan argumennya, bukan format barisnya.
    assert.match(
      konteks,
      /planEfektif\(\s*tenant\.plan,\s*tenant\.planExpiresAt,[\s\S]*?tenant\.timezone/,
      "planEfektif di tenant.ts harus menerima timezone sebagai argumen ketiga",
    );
    // Zona yang dipakai harus benar-benar kolom tenant, bukan literal.
    assert.match(konteks, /tenant\.timezone/);
    // `planTerkontrak` harus ikut dikirim: halaman paket membutuhkannya untuk
    // menjelaskan bahwa yang terlihat FREE adalah masa berlaku yang habis.
    assert.match(konteks, /planTerkontrak/);
    // Dan penurunan paketnya terjadi TEPAT sekali — kalau dua tempat menurunkannya,
    // yang kedua akan menurunkan hasil yang sudah diturunkan.
    assert.equal(
      [...konteks.matchAll(/planEfektif\(/g)].length,
      1,
      "planEfektif dipakai lebih dari sekali di tenant.ts",
    );
  });

  it("tidak ada berkas lain yang menilai tanggal kedaluwarsa sendiri", () => {
    // Aturannya hidup di plan-limits.ts. Cabang tanggal di tempat lain berarti
    // satu permukaan bisa menurunkan paket pada hari yang berbeda dari yang lain.
    // Yang dicari: baris yang MEMBANDINGKAN planExpiresAt dengan tanggal lain —
    // hanya `[<>]` yang dipakai, karena `!== null` di pemanggil helper bukan
    // penilaian tanggal.
    const MEMBANDING = /planExpiresAt[^\n]*[<>]=?|[<>]=?[^\n]*planExpiresAt/;
    const pelanggar = berkasSumber(AKAR_SRC)
      .filter((path) => !path.endsWith("plan-limits.ts"))
      .filter((path) => !path.endsWith(".test.ts"))
      .filter((path) => MEMBANDING.test(readFileSync(path, "utf8")))
      .map((path) => relative(AKAR_SRC, path));
    // Kontrol positif: pola ini memang menangkap perbandingan di kedua sisi,
    // bukan deret kosong yang selalu lolos.
    assert.ok(
      MEMBANDING.test("if (planExpiresAt < sekarang) turunkan();"),
      "pencari perbandingan tanggal tidak bekerja (kiri)",
    );
    assert.ok(
      MEMBANDING.test("sekarang.getTime() >= akhirHariPlan(planExpiresAt)"),
      "pencari perbandingan tanggal tidak bekerja (kanan)",
    );
    assert.deepEqual(
      pelanggar,
      [],
      `kedaluwarsa dinilai di luar plan-limits: ${pelanggar.join(", ")}`,
    );
  });

  it("setiap perubahan paket menulis satu baris riwayat", () => {
    const aksi = baca("modules", "core", "actions", "tenant-actions.ts");
    // Ditulis dalam transaksi yang sama dengan perubahan tenant: tanpa ini,
    // kegagalan di tengah jalan meninggalkan paket yang berubah tanpa jejak.
    assert.match(aksi, /\$transaction/);
    assert.match(aksi, /prisma\.planChange\.create/);
    // Aktivasi pertama (lewat dialog Tambah Tenant) juga tercatat.
    assert.match(aksi, /planChanges:\s*\{\s*create/);
    // Yang melakukan perubahan dicatat — inilah yang ditagih saat menagih
    // perpanjangan berikutnya.
    assert.match(aksi, /olehUserId:\s*guard\.userId/);
    // Keputusannya tidak boleh ditulis inline di aksi lagi: syaratnya adalah
    // "perpanjangan juga peristiwa", dan itu hanya teruji di plan-limits.
    assert.match(
      aksi,
      /riwayatPerluDitulis\(/,
      "kapan riwayat ditulis tidak lagi didelegasikan ke plan-limits",
    );
    assert.ok(
      !/paketBerubah\s*=\s*sebelum\.plan/.test(aksi),
      "perubahan paket diukur dari kolom plan saja: perpanjangan tidak tercatat",
    );
  });

  it("riwayat dibaca UI dan tidak pernah diubah UI", () => {
    const aksi = baca("modules", "core", "actions", "tenant-actions.ts");
    // Kolom yang diambil harus lengkap: kalau `catatan` atau `oleh` hilang dari
    // select, dialog hanya menampilkan tanggal tanpa bisa menjelaskan mengapa.
    const kolom = ["dari", "ke", "expiresAt", "catatan", "createdAt", "oleh"];
    for (const nama of kolom) {
      assert.match(
        aksi,
        new RegExp(`${nama}:\\s*(true|\\{)`),
        `kolom riwayat ${nama} tidak diambil oleh getAllTenants`,
      );
    }
    assert.match(baca(...DIALOG_KELOLA), /tenant\.riwayat\.map/);
    // Barisnya append-only.
    assert.ok(
      !/planChange\.(update|delete)/.test(aksi),
      "riwayat paket boleh ditambahkan, tidak boleh diedit",
    );
  });

  it("menurunkan paket tidak menghapus data apa pun", () => {
    // Perjanjian PRD 4.D.4: tanggal yang lewat hanya menurunkan AKSES. Kalau suatu
    // hari ada yang menulis penghapusan di jalur ini, sewa yang habis berubah
    // menjadi kehilangan pembukuan.
    const aksi = baca("modules", "core", "actions", "tenant-actions.ts");
    assert.ok(
      !/prisma\.\w+\.(delete|deleteMany|truncate)/.test(aksi),
      "jalur perubahan paket melakukan penghapusan data",
    );
    // Kolomnya juga tidak boleh dibersihkan diam-diam saat downgrade: `plan`
    // tetap menyimpan paket yang dibeli supaya perpanjangan cukup mengisi tanggal.
    assert.match(aksi, /data:\s*\{\s*plan,\s*planExpiresAt:/);
  });

  it("kedua dialog menyediakan kolom tanggalnya", () => {
    for (const berkas of [
      ["modules", "core", "components", "tenant-edit-dialog.tsx"],
      ["modules", "core", "components", "tenant-form-dialog.tsx"],
    ]) {
      const isi = baca(...berkas);
      assert.match(isi, /type="date"/, `${berkas.join("/")} tanpa kolom tanggal`);
      assert.match(isi, /register\("expiresAt"\)/);
    }
  });

  it("halaman paket memakai paket terkontrak untuk masa berlakunya", () => {
    // Paket EFEKTIF sudah menjadi FREE saat masanya habis — memakainya di sini
    // akan menyembunyikan pesan "PRO Anda kedaluwarsa" persis saat diperlukan.
    assert.match(
      baca(...PAKET),
      /susunMasaBerlaku\(\s*tenant\.planTerkontrak,\s*tenant\.planExpiresAt,?\s*\)/,
    );
    // Tabel Super Admin menilai tanggal yang sama dengan fungsi yang sama.
    assert.match(baca(...TABEL_ADMIN), /susunMasaBerlaku/);
  });

  it("skema & migrasinya ada dan aditif", () => {
    const skema = readFileSync(join(AKAR_PROYEK, "prisma", "schema.prisma"), "utf8");
    assert.match(skema, /planExpiresAt\s+DateTime\?/);
    assert.match(skema, /model PlanChange \{[\s\S]*?\@@index\(\[tenantId, createdAt\]\)/);
    // Kolom baru harus nullable: semua tenant PRO yang sudah live hari ini tidak
    // boleh berubah perilakunya hanya karena fitur ini di-deploy.
    assert.ok(
      !/planExpiresAt\s+DateTime\s+@default/.test(skema),
      "planExpiresAt tidak boleh wajib",
    );
    const migrasi = readdirSync(join(AKAR_PROYEK, "prisma", "migrations"))
      .filter((nama) => nama.includes("masa_berlaku"))
      .map((nama) =>
        readFileSync(join(AKAR_PROYEK, "prisma", "migrations", nama, "migration.sql"), "utf8"),
      );
    assert.equal(migrasi.length, 1, "migrasi masa berlaku tidak ditemukan");
    assert.match(migrasi[0], /ALTER TABLE "Tenant" ADD COLUMN\s+"planExpiresAt"/);
    assert.match(migrasi[0], /CREATE TABLE "PlanChange"/);
    // Kolom baru di tabel yang sudah berisi data sewa tidak boleh NOT NULL tanpa
    // nilai bawaan: migrasinya akan gagal di produksi, bukan hanya di mesin ini.
    assert.ok(
      !/ADD COLUMN[^;]*NOT NULL/i.test(migrasi[0]),
      "migrasi menambah kolom wajib pada tabel tenant",
    );
    // Jalur rilis tidak boleh menghapus data lama.
    assert.ok(
      !/DROP (TABLE|COLUMN)/i.test(migrasi[0]),
      "migrasi masa berlaku menghapus sesuatu",
    );
  });
});

/** Anggota `LimitKey` sebagaimana dideklarasikan di plan-limits.ts. */
function kunciLimit(): string[] {
  const isi = baca("lib", "plan-limits.ts");
  const deklarasi = isi.match(/export type LimitKey =([\s\S]*?);/);
  assert.ok(deklarasi, "tipe LimitKey tidak ditemukan di plan-limits.ts");
  return [...deklarasi[1].matchAll(/"([A-Z]+)"/g)].map((m) => m[1]);
}

describe("satu kosakata gating", () => {
  // Dulu ada dua cara menutup fitur: checkLimit() untuk tujuh kunci, dan
  // `tenant.isPro` untuk branding & AI. Yang kedua tidak lewat PLAN_LIMITS, jadi
  // pesannya dirangkai di tempat lain dan tidak ikut berubah saat kebijakan
  // paket berubah. Yang dilarang di sini hanyalah KEPUTUSAN gating yang diambil
  // sendiri; membandingkan plan untuk menampilkan badge tetap boleh.
  const POLA_PLAN_LANGSUNG =
    /plan\s*[!=]==\s*"PRO"|!\s*tenant\.isPro\b|!\s*isPro\b/;

  function berkasPenegakan(): string[] {
    const hasil: string[] = [];
    for (const path of berkasSumber(AKAR_SRC)) {
      const rel = relative(AKAR_SRC, path).split(sep).join("/");
      const penegakan =
        rel.includes("/actions/") ||
        rel.startsWith("app/api/") ||
        rel.endsWith("/route.ts");
      if (penegakan) hasil.push(path);
    }
    return hasil;
  }

  it("berkas penegakan tidak membandingkan paket sendiri", () => {
    const berkas = berkasPenegakan();
    // Kontrol positif: penjaga ini tidak boleh hijau karena tidak menemukan apa pun.
    assert.ok(
      berkas.length >= 10,
      `hanya ${berkas.length} berkas penegakan ditemukan — pemindainya yang salah`,
    );

    const pelanggar = berkas
      .filter((path) => POLA_PLAN_LANGSUNG.test(readFileSync(path, "utf8")))
      .map((path) => relative(AKAR_SRC, path));
    assert.deepEqual(
      pelanggar,
      [],
      `keputusan gating di luar checkLimit(): ${pelanggar.join(", ")}`,
    );
  });

  it("branding dan AI melewati checkLimit, bukan teks lokal", () => {
    const branding = baca("modules", "core", "actions", "branding-actions.ts");
    assert.match(branding, /checkLimit\(\s*[\w.]+,\s*"BRANDING"\s*\)/);
    assert.ok(
      !/hanya tersedia untuk plan PRO/.test(branding),
      "branding-actions masih membawa pesan PRO sendiri",
    );

    const chat = baca("app", "api", "chat", "route.ts");
    assert.match(chat, /checkLimit\(\s*[\w.]+,\s*"AI"\s*\)/);
    assert.ok(
      !/\bplan\b/.test(chat),
      "route chat masih membaca kolom plan langsung",
    );
  });
});
