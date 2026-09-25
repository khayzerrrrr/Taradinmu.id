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
