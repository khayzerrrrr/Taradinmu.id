import { round2 } from "@/lib/zakat";

// Aturan Harga Pokok Penjualan (PRD 4.G). Murni, tanpa Prisma, agar bisa diuji.
//
// Satu-satunya sumber kebenaran HPP adalah StockMovement type OUT: ia mencatat
// batch mana barangnya keluar dan berapa modal batch itu saat keluar. Sengaja
// TIDAK ada salinan harga modal di InvoiceItem — dua kolom untuk fakta yang sama
// adalah cara paling pasti menghasilkan laporan yang berbeda sendiri.

/**
 * Akhiran yang menandai reference movement OUT sudah dikembalikan stoknya
 * (ditulis oleh `kembalikanStokDariReferensi`). Movement ber-`#BATAL` tidak boleh
 * dihitung sebagai HPP: barangnya kembali ke rak, jadi modalnya belum terpakai.
 */
export const AKHIRAN_BATAL = "#BATAL";

export function adalahReferensiBatal(reference: string | null): boolean {
  return reference !== null && reference.endsWith(AKHIRAN_BATAL);
}

export type BarisModalBatch = {
  /** Sisa unit di batch sebelum penambahan. */
  jumlahLama: number;
  /** Harga modal per unit yang sudah tercatat; null bila belum diketahui. */
  modalLama: number | null;
  /** Unit yang baru masuk. */
  jumlahBaru: number;
  /** Harga modal per unit yang baru diisi; null bila user mengosongkannya. */
  modalBaru: number | null;
};

// Harga modal batch yang ditumpuki stok baru.
//
// Rata-rata tertimbang, BUKAN "harga terakhir menang": batch lama sudah punya
// modal untuk unit yang masih di rak. Menimpa dengan harga pembelian terbaru
// akan mengubah HPP unit lama tanpa jejak — dan selisihnya uang nyata.
// Movement OUT yang terlanjur tercatat tetap menyimpan unitCost-nya masing-masing
// (PRD 4.G.3), jadi rata-rata ini hanya memengaruhi unit yang belum keluar.
export function gabungHargaModal(baris: BarisModalBatch): number | null {
  const { jumlahLama, modalLama, jumlahBaru, modalBaru } = baris;

  // Tidak ada harga baru: batch tetap seperti semula (mungkin tetap null).
  if (modalBaru === null) return modalLama === null ? null : round2(modalLama);
  // Batch belum tahu modalnya, atau unit lamanya sudah habis terjual:
  // harga baru adalah satu-satunya informasi yang kita punya.
  if (modalLama === null || jumlahLama <= 0) return round2(modalBaru);
  if (jumlahBaru <= 0) return round2(modalLama);

  const totalUnit = jumlahLama + jumlahBaru;
  return round2((jumlahLama * modalLama + jumlahBaru * modalBaru) / totalUnit);
}

export type BarisMovementHpp = {
  quantity: number;
  /** null = batch asal tidak punya catatan harga modal. */
  unitCost: number | null;
};

export type HasilHpp = {
  /** Jumlah modal unit yang sudah keluar dan punya catatan harga. */
  hpp: number;
  /** Unit yang HPP-nya tidak bisa dihitung (batch lama tanpa harga modal). */
  unitTanpaModal: number;
  /** true bila SEBAGIAN/SELURUH unit tidak punya modal — UI harus jujur soal ini. */
  tidakLengkap: boolean;
};

/** Nilai awal saat tenant belum punya movement OUT sama sekali. */
export const HPP_NOL: HasilHpp = {
  hpp: 0,
  unitTanpaModal: 0,
  tidakLengkap: false,
};

/**
 * HPP dari kumpulan movement OUT satu dokumen.
 * Pemanggil WAJIB menyaring type OUT dan reference persis (bukan prefix) —
 * movement ADJUSTMENT hasil pengembalian memakai reference yang sama dengan
 * movement OUT asalnya, dan movement OUT yang dibatalkan sudah berganti
 * reference menjadi berakhiran `#BATAL`.
 */
export function hitungHpp(movements: readonly BarisMovementHpp[]): HasilHpp {
  let hpp = 0;
  let unitTanpaModal = 0;

  for (const movement of movements) {
    if (movement.unitCost === null) {
      unitTanpaModal += movement.quantity;
      continue;
    }
    hpp += movement.quantity * movement.unitCost;
  }

  return {
    hpp: round2(hpp),
    unitTanpaModal,
    tidakLengkap: unitTanpaModal > 0,
  };
}

/**
 * Laba kotor dokumen. `hpp` bernilai 0 saat harga modal belum tercatat — itu
 * BUKAN berarti "margin 100%", makanya pemanggil harus menampilkan keterangan
 * `hppLengkap` alih-alih angka laba saja (PRD 4.G.6).
 */
export function labaKotor(pendapatan: number, hpp: number): number {
  return round2(pendapatan - hpp);
}

/** Baris movement `OUT` apa pun, termasuk yang sudah dibatalkan. */
export type BarisMovementOut = BarisMovementHpp & {
  reference: string | null;
};

/**
 * HPP untuk sekumpulan movement `OUT` satu periode (mis. satu bulan).
 *
 * Saringannya sengaja berada di sini dan bukan di query: `reference` boleh
 * `null` (stok keluar manual tanpa dokumen), dan filter Prisma
 * `not: { endsWith: "#BATAL" }` akan membuang baris `null` bersama dengan yang
 * dibatalkan — hasilnya HPP bulan ini tampak lebih kecil dari kenyataan.
 */
export function hppDariMovementOut(
  movements: readonly BarisMovementOut[],
): HasilHpp {
  return hitungHpp(
    movements.filter((movement) => !adalahReferensiBatal(movement.reference)),
  );
}

// --- Kelengkapan modal (Fase 0.1) ---
//
// Lubang yang ditutup di sini bukan "HPP salah sedikit" tapi "HPP nol tanpa
// tanda": tenant yang stoknya tidak pernah melewati Stok Masuk tidak punya satu
// baris StockMovement pun, jadi HPP = 0 DAN unitTanpaModal = 0. Kedua angka itu
// nol berarti "tidak ada barang terjual" yang sahwatertukar dengan "barang
// terjual tapi modalnya belum pernah dicatat" yang SALAH. Dilihat pada tenant
// demo: 3 invoice lunas, 0 movement, batch costPrice=NULL — kartu Laba Bersih
// terlihat bersih padahal modalnya nol sungguhan.
//
// 왜 harus dibaca di satu tempat: dashboard, zakat, dan laporan memakai aturan
// ini, jadi mereka tidak mungkin berbeda pendapat tentang apakah angkanya
// sudah layak dipercaya.

/** Alasan kenapa angka HPP belum layak dipercaya sebagai angka utuh. */
export type AlasanKelengkapanModal =
  /** Tidak ada barang terjual bulan ini — HPP 0 di sini memang benar. */
  | "TIDAK_ADA_BARANG_TERJUAL"
  /** Ada barang terjual tapi nol movement — modal belum pernah dicatat. */
  | "TIDAK_ADA_MOVEMENT"
  /** Movement ada, tapi sebagian batch tak punya harga modal. */
  | "MODAL_BELUM_TERCATAT"
  /** HPP boleh dipakai utuh. */
  | "LENGKAP";

export type KelengkapanModal = {
  /** Unit barang (kind GOODS) terjual pada periode itu. */
  unitTerjual: number;
  /** Movement OUT yang benar-benar ditemukan untuk unit itu. */
  movementDitemukan: number;
  /** Unit keluar yang batch-nya tak punya harga modal. */
  unitTanpaModal: number;
  /** Batch di rak (quantity > 0) yang costPrice-nya kosong. */
  batchDiRakTanpaModal: number;
  /** true hanya bila HPP boleh dipercaya sebagai angka utuh. */
  lengkap: boolean;
  /** Alasan singkat — untuk ditampilkan ke pengguna, bukan untuk log. */
  alasan: AlasanKelengkapanModal;
};

/**
 * Menentukan apakah angka HPP sudah layak dipercaya.
 *
 * Murni tanpa Prisma supaya bisa diuji tanpa database.
 *
 * Urutan pemeriksaan disengaja. `TIDAK_ADA_MOVEMENT` diperiksa SEBELUM
 * `batchDiRakTanpaModal`, bukan sesudahnya: batch kosongnya modal bukan bukti
 * apa pun tentang penjualan bulan ini, jadi tidak boleh menutupi fakta bahwa
 * tidak ada satu pun movement yang ditemukan. Kalau urukannya dibalik, kasus
 * yang paling salah justru akan terbaca "lengkap".
 */
export function nilaiKelengkapanModal(input: {
  unitTerjual: number;
  movementDitemukan: number;
  unitTanpaModal: number;
  batchDiRakTanpaModal: number;
}): KelengkapanModal {
  const dasar = {
    unitTerjual: input.unitTerjual,
    movementDitemukan: input.movementDitemukan,
    unitTanpaModal: input.unitTanpaModal,
    batchDiRakTanpaModal: input.batchDiRakTanpaModal,
  };

  // Tidak ada yang terjual bulan ini: HPP 0 adalah jawaban yang benar, bukan
  // tanda ada yang salah. Tidak ada yang perlu diperingatkan.
  if (input.unitTerjual <= 0) {
    return { ...dasar, lengkap: true, alasan: "TIDAK_ADA_BARANG_TERJUAL" };
  }

  // Ada barang terjual tapi nol movement: ini lubang Fase 0.1. HPP 0 di sini
  // berarti "tidak diketahui", bukan "gratis".
  if (input.movementDitemukan <= 0) {
    return { ...dasar, lengkap: false, alasan: "TIDAK_ADA_MOVEMENT" };
  }

  if (input.unitTanpaModal > 0) {
    return { ...dasar, lengkap: false, alasan: "MODAL_BELUM_TERCATAT" };
  }

  // `batchDiRakTanpaModal` sengaja TIDAK masuk penentu `lengkap`. Barang yang
  // belum terjual tidak memengaruhi HPP bulan ini; ia hanya memberi tahu lebih
  // awal lewat hitungan tersebut. Menaikannya jadi alasan "belum lengkap" akan
  // membuat setiap toko yang punya batch baru mendapat peringatan yang tidak
  // perlu.
  return { ...dasar, lengkap: true, alasan: "LENGKAP" };
}

/**
 * Nilai untuk tenant yang modul Inventory-nya tidak aktif.
 *
 * Modul mati bukan berarti datanya salah, jadi tidak diperingatkan — sama
 * dengan "tidak ada barang terjual".
 */
export const KELENGKAPAN_MODAL_NONAKTIF: KelengkapanModal = {
  unitTerjual: 0,
  movementDitemukan: 0,
  unitTanpaModal: 0,
  batchDiRakTanpaModal: 0,
  lengkap: true,
  alasan: "TIDAK_ADA_BARANG_TERJUAL",
};
