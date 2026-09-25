import type { Prisma } from "@/generated/prisma/client";
import { isExpired } from "@/lib/stock";

// Alokasi stok yang dipakai bersama modul inventory & billing.
// Sesuai PRD Bagian 6: "Gunakan Prisma langsung atau shared utils di src/lib/".

export class StokTidakCukupError extends Error {
  constructor(
    public readonly stokLayak: number,
    public readonly stokKedaluwarsa: number,
  ) {
    super(
      `Stok layak tidak cukup: tersedia ${stokLayak} unit${
        stokKedaluwarsa > 0
          ? `, dan ${stokKedaluwarsa} unit lain sudah kedaluwarsa (tidak diikutkan).`
          : "."
      }`,
    );
    this.name = "StokTidakCukupError";
  }
}

export class StokBerubahError extends Error {
  constructor() {
    super("Stok berubah saat diproses. Silakan ulangi.");
    this.name = "StokBerubahError";
  }
}

export type AlokasiItem = {
  batchId: string;
  batchNumber: string;
  expiredDate: string | null;
  quantity: number;
  /**
   * Harga modal per unit batch asal pada saat potongan (PRD 4.G.3).
   * null = batch itu tidak punya catatan harga modal.
   */
  unitCost: number | null;
};

/** Batch calon penyedia stok, seperti hasil query FEFO (sudah terurut). */
export type CalonBatch = {
  id: string;
  batchNumber: string;
  quantity: number;
  expiredDate: Date | null;
  costPrice: number | null;
};

export type RencanaAlokasiItem = {
  batchId: string;
  batchNumber: string;
  expiredDate: Date | null;
  quantity: number;
  unitCost: number | null;
};

/**
 * Keputusan FEFO murni: batch mana dipakai dan berapa unit dari masing-masing.
 *
 * Diambil dari `alokasiFefoKeluar` agar aturan pemilihannya bisa diuji tanpa
 * database. Urutan batch harus sudah FEFO (kedaluwarsa terdekat lebih dulu,
 * tanpa tanggal di akhir, lalu menurut waktu masuk) seperti hasil query.
 * Batch kedaluwarsa DILEWATI, dan kekurangannya dilaporkan sebagai angka terpisah
 * supaya pesan error tidak membuat stok busuk terlihat seperti stok kurang.
 */
export function rencanaAlokasiFefo(
  batches: readonly CalonBatch[],
  quantity: number,
  now: Date = new Date(),
): RencanaAlokasiItem[] {
  const layak = batches.filter((batch) => !isExpired(batch.expiredDate, now));
  const stokLayak = layak.reduce((total, batch) => total + batch.quantity, 0);
  const stokKedaluwarsa = batches
    .filter((batch) => isExpired(batch.expiredDate, now))
    .reduce((total, batch) => total + batch.quantity, 0);

  if (stokLayak < quantity) {
    throw new StokTidakCukupError(stokLayak, stokKedaluwarsa);
  }

  let sisa = quantity;
  const rencana: RencanaAlokasiItem[] = [];

  for (const batch of layak) {
    if (sisa <= 0) break;
    const ambil = Math.min(sisa, batch.quantity);
    rencana.push({
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      expiredDate: batch.expiredDate,
      quantity: ambil,
      unitCost: batch.costPrice,
    });
    sisa -= ambil;
  }

  return rencana;
}

export type AlokasiFefoOptions = {
  variantId: string;
  quantity: number;
  /** Biasanya nomor dokumen (mis. nomor invoice atau "PO-002"). */
  reference?: string | null;
  notes?: string | null;
};

// FEFO (First Expired First Out): pakai batch dengan kedaluwarsa terdekat lebih dulu.
// Batch kedaluwarsa DILEWATI. Setiap batch yang terpakai menulis satu StockMovement OUT.
// Harus dipanggil di dalam transaksi (tx) agar atomik dengan dokumen pemanggilnya.
export async function alokasiFefoKeluar(
  tx: Prisma.TransactionClient,
  options: AlokasiFefoOptions,
): Promise<{ allocations: AlokasiItem[]; total: number }> {
  const { variantId, quantity, reference = null, notes = null } = options;

  const batches = await tx.inventoryBatch.findMany({
    where: { variantId, quantity: { gt: 0 } },
    orderBy: [
      { expiredDate: { sort: "asc", nulls: "last" } },
      { createdAt: "asc" },
    ],
    select: {
      id: true,
      batchNumber: true,
      quantity: true,
      expiredDate: true,
      costPrice: true,
    },
  });

  // Decimal -> number: harga modal hanya dipakai sebagai angka satuan uang, dan
  // pembacaan Decimal di jalur ini sudah terbukti aman (kolom DECIMAL(12,2)).
  const rencana = rencanaAlokasiFefo(
    batches.map((batch) => ({
      id: batch.id,
      batchNumber: batch.batchNumber,
      quantity: batch.quantity,
      expiredDate: batch.expiredDate,
      costPrice: batch.costPrice === null ? null : Number(batch.costPrice),
    })),
    quantity,
  );

  const allocations: AlokasiItem[] = [];

  for (const item of rencana) {
    // Guard `gte` mencegah stok minus bila ada perubahan bersamaan.
    const terpakai = await tx.inventoryBatch.updateMany({
      where: { id: item.batchId, quantity: { gte: item.quantity } },
      data: { quantity: { decrement: item.quantity } },
    });
    if (terpakai.count === 0) throw new StokBerubahError();

    await tx.stockMovement.create({
      data: {
        batchId: item.batchId,
        type: "OUT",
        quantity: item.quantity,
        // Potret modal batch saat keluar: inilah dasar HPP dokumen ini, dan ia
        // tidak ikut berubah bila harga modal batch dikoreksi belakangan.
        unitCost: item.unitCost,
        reference,
        notes,
      },
    });

    allocations.push({
      batchId: item.batchId,
      batchNumber: item.batchNumber,
      expiredDate: item.expiredDate ? item.expiredDate.toISOString() : null,
      quantity: item.quantity,
      unitCost: item.unitCost,
    });
  }

  return { allocations, total: quantity };
}

export type KembalikanStokOptions = {
  tenantId: string;
  /** Nomor dokumen yang stoknya dikembalikan (mis. nomor invoice). */
  reference: string;
  notes?: string | null;
};

// Mengembalikan stok ke batch asal berdasarkan movement OUT dengan `reference`
// tertentu (dipakai saat invoice DRAFT dihapus).
// Movement OUT yang sudah dikembalikan ditandai agar tidak diproses dua kali.
export async function kembalikanStokDariReferensi(
  tx: Prisma.TransactionClient,
  options: KembalikanStokOptions,
): Promise<{ totalDikembalikan: number; jumlahBatch: number }> {
  const { tenantId, reference, notes = null } = options;

  const movements = await tx.stockMovement.findMany({
    where: {
      reference,
      type: "OUT",
      batch: { variant: { product: { tenantId } } },
    },
    select: { id: true, batchId: true, quantity: true, unitCost: true },
  });

  let totalDikembalikan = 0;

  for (const movement of movements) {
    await tx.inventoryBatch.update({
      where: { id: movement.batchId },
      data: { quantity: { increment: movement.quantity } },
    });

    await tx.stockMovement.create({
      data: {
        batchId: movement.batchId,
        type: "ADJUSTMENT",
        quantity: movement.quantity,
        // Modalnya ikut kembali, supaya riwayat menunjukkan nilai yang sama
        // dengan yang sempat keluar. HPP tidak membaca baris ADJUSTMENT.
        unitCost: movement.unitCost === null ? null : Number(movement.unitCost),
        reference,
        notes: notes ?? "Pengembalian stok (dokumen dibatalkan)",
      },
    });

    totalDikembalikan += movement.quantity;
  }

  if (movements.length > 0) {
    // Tandai movement OUT lama supaya pengembalian tidak terjadi dua kali.
    await tx.stockMovement.updateMany({
      where: { id: { in: movements.map((movement) => movement.id) } },
      data: { reference: `${reference}#BATAL` },
    });
  }

  return { totalDikembalikan, jumlahBatch: movements.length };
}
