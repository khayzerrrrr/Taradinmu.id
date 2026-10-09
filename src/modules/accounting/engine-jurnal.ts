// Engine jurnal (Fase 1, PRD 4 butir F1.6).
//
// Murni tanpa Prisma: seluruh aturan pembukuan di sini bisa diuji tanpa
// database. Ini bukan pilihan gaya — aturan pembukuan adalah tempat di mana
// bug paling mahal (salah angka pada zakat, salah pada laporan pajak), jadi ia
// harus bisa dibuktikan tanpa menyiapkan data dulu.
//
// TIGA KEBIASAAN YANG MENENTUKAN SELURUH BERKAS INI:
//
// 1. Setiap jurnal harus seimbang. Fungsi di sini TIDAK menghasilkan jurnal
//   tidak seimbang — kalau tidak bisa seimbang, ia TIDAK menghasilkan jurnal sama
//    sekali dan mengembalikan alasan yang bisa dibaca. Menghasilkan jurnal
//    setengah jadi berarti membiarkan database yang menolak, dan pesan error
//    database tidak menjelaskan apa yang salah secara bisnis.
//
// 2. Satu akun satu kali per jurnal. Kalau aturan bisnis butuh dua baris untuk
//    satu akun (misal accrued biaya dalam dua periode), itu artinya jurnal
//    harus dipecah - bukan pelanggaran aturan database.
//
// 3. Nominal uang selalu positif; sisi yang menentukan. Danatz "minus" ditulis
//    sebagai pembalik sisi, bukan sebagai angka negatif. Membolitics angka
//    negatif di baris debit membuat setiap pembaca laporan harus mengingat
//    bahwa saldo debit negatif adalah kredit — kesalahan baca yang mahal.

import { KODE_AKUN, PETA_BEBAN, type KunciAkun } from "./coa";

export type Sisi = "DEBIT" | "CREDIT";

export type BarisJurnal = {
  /** Kode akun, mis. "1-1001". */
  kode: string;
  /** Nominal positif. */
  nominal: number;
  sisi: Sisi;
};

export type JurnalRancangan = {
  source:
    | "INVOICE"
    | "PAYMENT"
    | "STOCK"
    | "EXPENSE"
    | "MANUAL"
    | "OPENING"
    | "REVERSAL"
    | "CLOSING";
  businessDate: Date;
  reference?: string;
  refType?: string;
  refId?: string;
  description?: string;
  currency?: string;
  reversedFromId?: string;
  postings: BarisJurnal[];
};

export type HasilRacik =
  | { ok: true; jurnal: JurnalRancangan }
  | { ok: false; alasan: string };

/**
 * Pembulatan ke 2 desimal untuk SETIAP nominal.
 *
 * Nominal yang belum dibulatkan membuat jurnal tidak seimbang dalam pecahan —
 * 0.005 rupiah. Karena itu penjumlahan dilakukan pada angka yang sudah
 * dibulatkan, bukan pada angka mentah lalu dibulatkan sekali di akhir.
 */
export function bulat(n: number): number {
  return Math.round(n * 100) / 100;
}

function jumlahSisi(postings: BarisJurnal[], sisi: Sisi): number {
  return bulat(
    postings
      .filter((p) => p.sisi === sisi)
      .reduce((total, p) => total + p.nominal, 0),
  );
}

/**
 * Satu-satunya pintu masuk membuat jurnal.
 *
 * Semua pembuat jurnal lain memanggil ini, sehingga aturan "harus seimbang",
 * "satu akun sekali", dan "nominal positif" ditegakkan di SATU tempat — bukan
 * di sepuluh pemanggil yang masing-masing bisa lupa berbeda.
 */
export function racikJurnal(input: {
  source: JurnalRancangan["source"];
  businessDate: Date;
  postings: BarisJurnal[];
  reference?: string;
  refType?: string;
  refId?: string;
  description?: string;
  currency?: string;
  reversedFromId?: string;
}): HasilRacik {
  const { postings } = input;

  if (postings.length < 2) {
    return {
      ok: false,
      alasan: "Jurnal butuh minimal dua baris: satu sisi debit dan satu sisi kredit.",
    };
  }

  for (const p of postings) {
    if (!Number.isFinite(p.nominal) || p.nominal <= 0) {
      return {
        ok: false,
        alasan: `Nominal akun ${p.kode} harus angka positif lebih dari nol (diterima ${p.nominal}).`,
      };
    }
  }

  const kodeTerpakai = new Set<string>();
  for (const p of postings) {
    if (kodeTerpakai.has(p.kode)) {
      return {
        ok: false,
        alasan: `Akun ${p.kode} muncul lebih dari sekali. Satu akun satu kali per jurnal; kalau butuh dua, itu dua jurnal.`,
      };
    }
    kodeTerpakai.add(p.kode);
  }

  const debit = jumlahSisi(postings, "DEBIT");
  const kredit = jumlahSisi(postings, "CREDIT");

  if (debit !== kredit) {
    return {
      ok: false,
      alasan: `Jurnal tidak seimbang: debit ${fmt(debit)} vs kredit ${fmt(kredit)} (selisih ${fmt(Math.abs(debit - kredit))}).`,
    };
  }

  return {
    ok: true,
    jurnal: {
      ...input,
      postings: postings.map((p) => ({ ...p, nominal: bulat(p.nominal) })),
    },
  };
}

function fmt(n: number): string {
  return n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

/**
 * Mengakui pendapatan saat invoice dibuat (status SENT).
 *
 * Pendapatan diakui saat faktur terbit, BUKAN saat uang masuk — dasar akuntansi
 * akrual. Kalau jurnal ini memakai Kas, Laba Rugi akan bergantung pada kapan
 * pelanggan membayar, dan tidak ada yang bisa memperkirakan apa pun dari
 * laporan itu.
 *
 * PEMBAGIAN barang/jasa: `subtotal` adalah bagian jasa. Bila tidak diberikan,
 * seluruh dianggap barang. Alasannya, invoice yang tidak memisahkan keduanya
 * hampir selalu penjualan barang, dan default yang salah akan menjatuhkan
 * seluruh penjualan ke akun jasa tanpa ada yang menyadarinya.
 *
 * CATATAN PAJAK: `taxAmount` belum punya akun dan sementara ikut terhitung
 * sebagai pendapatan. Ini catatan penting, bukan penyederhanaan yang boleh
 * dibiarkan: begitu modul pajak aktif (Fase 4), baris pajak harus dipecah
 * menjadi Utang Pajak, dan total harus dibaca sebagai subtotal + pajak secara
 * terpisah.
 */
export function jurnalDariInvoice(input: {
  businessDate: Date;
  invoiceNumber: string;
  invoiceId: string;
  /** Total termasuk pajak (kolom `Invoice.totalAmount`). */
  totalAmount: number;
  /** Bagian jasa saja. Default 0 = semua dianggap barang. */
  subtotal?: number;
}): HasilRacik {
  const total = bulat(input.totalAmount);
  if (total <= 0) {
    return { ok: false, alasan: "Nilai invoice nol tidak menghasilkan jurnal pendapatan." };
  }

  const jasa = bulat(input.subtotal ?? 0);
  const barang = bulat(total - jasa);
  if (barang < 0) {
    return { ok: false, alasan: "Subtotal melebihi total invoice." };
  }

  const postings: BarisJurnal[] = [
    { kode: KODE_AKUN.piutangUsaha, nominal: total, sisi: "DEBIT" },
  ];

  if (barang > 0) {
    postings.push({
      kode: KODE_AKUN.pendapatanPenjualan,
      nominal: barang,
      sisi: "CREDIT",
    });
  }
  if (jasa > 0) {
    postings.push({
      kode: KODE_AKUN.pendapatanJasa,
      nominal: jasa,
      sisi: "CREDIT",
    });
  }

  return racikJurnal({
    source: "INVOICE",
    businessDate: input.businessDate,
    reference: input.invoiceNumber,
    refType: "invoice",
    refId: input.invoiceId,
    description: `Pengakuan pendapatan — ${input.invoiceNumber}`,
    postings,
  });
}

/**
 * Menerima pembayaran invoice (status SENT -> PAID).
 *
 * Jurnal ini TIDAK menyentuh pendapatan — pendapatan sudah diakui saat faktur
 * terbit. Yang berkurang di sini piutang, dan yang bertambah kas/bank. Dua
 * jurnal terpisah untuk satu invoice adalah konsekuensi akuntansi akrual,
// bukan redundansi.
 */
export function jurnalDariPembayaran(input: {
  businessDate: Date;
  invoiceNumber: string;
  invoiceId: string;
  /** Total yang diterima. */
  totalAmount: number;
  /** true kalau lewat bank, false kalau tunai. */
  lewatBank?: boolean;
}): HasilRacik {
  const total = bulat(input.totalAmount);
  if (total <= 0) {
    return { ok: false, alasan: "Nilai pembayaran nol tidak menghasilkan jurnal kas." };
  }

  return racikJurnal({
    source: "PAYMENT",
    businessDate: input.businessDate,
    reference: input.invoiceNumber,
    refType: "invoice",
    refId: input.invoiceId,
    description: `Penerimaan pembayaran — ${input.invoiceNumber}`,
    postings: [
      {
        kode: input.lewatBank ? KODE_AKUN.bank : KODE_AKUN.kas,
        nominal: total,
        sisi: "DEBIT",
      },
      { kode: KODE_AKUN.piutangUsaha, nominal: total, sisi: "CREDIT" },
    ],
  });
}

/**
 * Barang keluar untuk penjualan:}</n *
 * Mengakui HPP. Terpisah dari jurnal pendapatan karena HPP mengikuti saat
 * barang benar-benar keluar (FIFO/FEFO), sedangkan pendapatan mengikuti saat
 * faktur terbit — keduanya bisa berbeda waktunya.
 *
 * Tanpa pemisahan ini, satu invoice DRAFT akan langsung memotong laba sebesar
 * seluruh modalnya padahal pendapatannya belum diakui sama sekali.
 */
export function jurnalHppTerjual(input: {
  businessDate: Date;
  reference: string;
  refId?: string;
  /** Total modal barang yang keluar. */
  hpp: number;
}): HasilRacik | null {
  const hpp = bulat(input.hpp);
  if (hpp <= 0) return null; // tidak ada barang keluar bermodul, tidak ada jurnal

  return racikJurnal({
    source: "STOCK",
    businessDate: input.businessDate,
    reference: input.reference,
    refType: "stock",
    ...(input.refId ? { refId: input.refId } : {}),
    description: `Harga pokok penjualan — ${input.reference}`,
    postings: [
      { kode: KODE_AKUN.hpp, nominal: hpp, sisi: "DEBIT" },
      { kode: KODE_AKUN.persediaan, nominal: hpp, sisi: "CREDIT" },
    ],
  });
}

/**
 * Pembelian stok.
 *
 * Barang yang masuk ke gudang adalah ASET, bukan beban. Menyatakannya sebagai
 * beban adalah kesalahan yang membuat laba turun pada bulan pembelian padahal
 * belum ada satu pun barang terjual — dan karena zakat dihitung dari laba, zakat
 * ikut turun (PRD 4.G.1).
 */
export function jurnalPembelianStok(input: {
  businessDate: Date;
  reference: string;
  refId?: string;
  nominal: number;
  lewatBank?: boolean;
}): HasilRacik {
  const nominal = bulat(input.nominal);
  if (nominal <= 0) {
    return { ok: false, alasan: "Nilai pembelian nol tidak menghasilkan jurnal." };
  }

  return racikJurnal({
    source: "STOCK",
    businessDate: input.businessDate,
    reference: input.reference,
    refType: "stock",
    ...(input.refId ? { refId: input.refId } : {}),
    description: `Pembelian persediaan — ${input.reference}`,
    postings: [
      { kode: KODE_AKUN.persediaan, nominal, sisi: "DEBIT" },
      {
        kode: input.lewatBank ? KODE_AKUN.bank : KODE_AKUN.kas,
        nominal,
        sisi: "CREDIT",
      },
    ],
  });
}

/**
 * Pengeluaran operasional.
 *
 * `kategori` memakai enum `ExpenseCategory` yang sudah ada di aplikasi, bukan
// kode akun - supaya kategori yang sudah dipilih pengguna tidak berubah makna
 * saat angkanya pindah ke GL.
 */
export function jurnalDariPengeluaran(input: {
  businessDate: Date;
  reference: string;
  refId?: string;
  nominal: number;
  kategori: keyof typeof PETA_BEBAN;
  lewatBank?: boolean;
}): HasilRacik {
  const nominal = bulat(input.nominal);
  if (nominal <= 0) {
    return { ok: false, alasan: "Nilai pengeluaran nol tidak menghasilkan jurnal." };
  }

  const kunciAkun: KunciAkun = PETA_BEBAN[input.kategori];
  // PETA_BEBAN[PURCHASE] sengaja menunjuk ke persediaan, bukan beban. Kalau
  // expense kategori PURCHASE sampai ke sini, itu jalur yang salah — dan
// menjadikannya beban berarti hasil，除非 setelah barang benar-benar terjual.
  if (kunciAkun === "persediaan") {
    return {
      ok: false,
      alasan:
        "Kategori PURCHASE harus lewat jurnalPembelianStok, bukan jurnal beban: barang yang belum terjual adalah aset.",
    };
  }

  return racikJurnal({
    source: "EXPENSE",
    businessDate: input.businessDate,
    reference: input.reference,
    refType: "expense",
    ...(input.refId ? { refId: input.refId } : {}),
    description: `Pengeluaran operasional — ${input.reference}`,
    postings: [
      { kode: KODE_AKUN[kunciAkun], nominal, sisi: "DEBIT" },
      {
        kode: input.lewatBank ? KODE_AKUN.bank : KODE_AKUN.kas,
        nominal,
        sisi: "CREDIT",
      },
    ],
  });
}

/**
 * Jurnal pembalik (reversal): membalik SELURUH isi jurnal asli, dengan sisi
 * ditukar.
 *
 * Metode ini — bukan menghapus, bukan mengubah angka asli — yang membuat
 * pembukuan tetap bisa dibaca ulang. Kalau pembukuan bisa "dibetulkan" dengan
 * mengubah barislampau, maka baris yang sudah diserahkan ke Kantor Pajak
 * berubah tanpa jejak, dan pembukuan berhenti menjadi bukti.
 */
export function jurnalPembalik(
  asli: { id: string; businessDate: Date; currency?: string; postings: BarisJurnal[] },
  tanggalPembatalan: Date,
): HasilRacik {
  return racikJurnal({
    source: "REVERSAL",
    businessDate: tanggalPembatalan,
    reference: asli.id,
    refType: "journal",
    refId: asli.id,
    reversedFromId: asli.id,
    ...(asli.currency ? { currency: asli.currency } : {}),
    description: `Pembatalan jurnal ${asli.id}`,
    postings: asli.postings.map((p) => ({
      kode: p.kode,
      nominal: p.nominal,
      sisi: p.sisi === "DEBIT" ? "CREDIT" : "DEBIT",
    })),
  });
}
