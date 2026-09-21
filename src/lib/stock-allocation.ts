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
};

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
    select: { id: true, batchNumber: true, quantity: true, expiredDate: true },
  });

  const now = new Date();
  const layak = batches.filter((batch) => !isExpired(batch.expiredDate, now));
  const stokLayak = layak.reduce((total, batch) => total + batch.quantity, 0);
  const stokKedaluwarsa = batches
    .filter((batch) => isExpired(batch.expiredDate, now))
    .reduce((total, batch) => total + batch.quantity, 0);

  if (stokLayak < quantity) {
    throw new StokTidakCukupError(stokLayak, stokKedaluwarsa);
  }

  let sisa = quantity;
  const allocations: AlokasiItem[] = [];

  for (const batch of layak) {
    if (sisa <= 0) break;

    const ambil = Math.min(sisa, batch.quantity);
    // Guard `gte` mencegah stok minus bila ada perubahan bersamaan.
    const terpakai = await tx.inventoryBatch.updateMany({
      where: { id: batch.id, quantity: { gte: ambil } },
      data: { quantity: { decrement: ambil } },
    });
    if (terpakai.count === 0) throw new StokBerubahError();

    await tx.stockMovement.create({
      data: {
        batchId: batch.id,
        type: "OUT",
        quantity: ambil,
        reference,
        notes,
      },
    });

    allocations.push({
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      expiredDate: batch.expiredDate ? batch.expiredDate.toISOString() : null,
      quantity: ambil,
    });
    sisa -= ambil;
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
    select: { id: true, batchId: true, quantity: true },
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
