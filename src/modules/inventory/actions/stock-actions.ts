"use server";

import type { Prisma } from "@/generated/prisma/client";
import { DEFAULT_BATCH_NUMBER } from "@/lib/business-presets";
import { gabungHargaModal } from "@/lib/hpp";
import { prisma } from "@/lib/prisma";
import { ringkasStok } from "@/lib/stock";
import {
  alokasiFefoKeluar,
  StokBerubahError,
  StokTidakCukupError,
} from "@/lib/stock-allocation";
import type { ActionResponse } from "@/shared/types";
import {
  listMovementsSchema,
  listStockSchema,
  stockInSchema,
  stockOutSchema,
} from "../schemas/stock-schema";
import type {
  BatchItem,
  MovementType,
  StockListData,
  StockMovementItem,
  StockOutAllocation,
  StockSummaryItem,
  VariantOption,
} from "../types";
import {
  isExpired,
  LOW_STOCK_THRESHOLD,
  parseTanggalInput,
  pesanErrorUmum,
  pesanValidasi,
} from "../utils";
import { aksesTenant } from "./akses-tenant";

// ---------------------------------------------------------------------------
// BACA
// ---------------------------------------------------------------------------

// Daftar varian tenant + stok tersedia (dipakai form stok masuk/keluar).
// Hanya item BARANG: jasa tidak punya stok, jadi tidak boleh muncul di sini.
export async function getVariantsForStock(): Promise<
  ActionResponse<VariantOption[]>
> {
  const akses = await aksesTenant();
  if (!akses.ok) return { success: false, message: akses.message };

  try {
    const variants = await prisma.productVariant.findMany({
      where: { product: { tenantId: akses.tenantId, kind: "GOODS" } },
      orderBy: [{ product: { name: "asc" } }, { sku: "asc" }],
      select: {
        id: true,
        sku: true,
        name: true,
        product: { select: { name: true } },
        batches: { select: { quantity: true, expiredDate: true } },
      },
    });

    const now = new Date();
    const data: VariantOption[] = variants.map((variant) => {
      const ringkasan = ringkasStok(variant.batches, now);
      return {
        id: variant.id,
        sku: variant.sku,
        name: variant.name,
        productName: variant.product.name,
        available: ringkasan.layak,
        expired: ringkasan.kedaluwarsa,
        batchCount: variant.batches.length,
      };
    });

    return { success: true, message: "Daftar varian berhasil dimuat.", data };
  } catch (error) {
    return {
      success: false,
      message: "Gagal memuat daftar varian.",
      error: pesanErrorUmum(error),
    };
  }
}

// Ringkasan stok per varian (halaman Ringkasan Stok).
export async function getStockSummary(
  input: unknown,
): Promise<ActionResponse<StockListData>> {
  const akses = await aksesTenant();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = listStockSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const { page, perPage, search } = parsed.data;
  // Hanya item BARANG — jasa tidak punya stok untuk diringkas.
  const where: Prisma.ProductVariantWhereInput = {
    product: { tenantId: akses.tenantId, kind: "GOODS" },
    ...(search
      ? {
          OR: [
            { sku: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
            { product: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  try {
    const [total, variants] = await prisma.$transaction([
      prisma.productVariant.count({ where }),
      prisma.productVariant.findMany({
        where,
        orderBy: [{ product: { name: "asc" } }, { sku: "asc" }],
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          sku: true,
          name: true,
          product: { select: { name: true } },
          batches: { select: { quantity: true, expiredDate: true } },
        },
      }),
    ]);

    const now = new Date();
    const items: StockSummaryItem[] = variants.map((variant) => {
      const ringkasan = ringkasStok(variant.batches, now);
      return {
        variantId: variant.id,
        sku: variant.sku,
        variantName: variant.name,
        productName: variant.product.name,
        totalQuantity: ringkasan.total,
        nonExpiredQuantity: ringkasan.layak,
        expiredQuantity: ringkasan.kedaluwarsa,
        batchCount: variant.batches.length,
        nearestExpiry: ringkasan.expiryTerdekat
          ? ringkasan.expiryTerdekat.toISOString()
          : null,
        isLowStock: ringkasan.layak <= LOW_STOCK_THRESHOLD,
        isExpiringSoon: ringkasan.segeraKedaluwarsa,
      };
    });

    return {
      success: true,
      message: "Ringkasan stok berhasil dimuat.",
      data: {
        items,
        meta: {
          page,
          perPage,
          total,
          totalPages: Math.max(1, Math.ceil(total / perPage)),
        },
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal memuat ringkasan stok.",
      error: pesanErrorUmum(error),
    };
  }
}

// Daftar batch satu varian (dengan cek kepemilikan tenant).
export async function getVariantBatches(
  variantId: string,
): Promise<ActionResponse<BatchItem[]>> {
  const akses = await aksesTenant();
  if (!akses.ok) return { success: false, message: akses.message };

  try {
    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, product: { tenantId: akses.tenantId } },
      select: { id: true },
    });
    if (!variant) {
      return { success: false, message: "Varian tidak ditemukan pada tenant ini." };
    }

    const batches = await prisma.inventoryBatch.findMany({
      where: { variantId: variant.id },
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
        supplier: { select: { name: true } },
      },
    });

    const now = new Date();
    const data: BatchItem[] = batches.map((batch) => ({
      id: batch.id,
      batchNumber: batch.batchNumber,
      quantity: batch.quantity,
      expiredDate: batch.expiredDate ? batch.expiredDate.toISOString() : null,
      isExpired: isExpired(batch.expiredDate, now),
      costPrice: batch.costPrice?.toString() ?? null,
      supplierName: batch.supplier?.name ?? null,
    }));

    return { success: true, message: "Daftar batch berhasil dimuat.", data };
  } catch (error) {
    return {
      success: false,
      message: "Gagal memuat daftar batch.",
      error: pesanErrorUmum(error),
    };
  }
}

// Riwayat pergerakan stok terbaru (semua perubahan stok WAJIB tercatat di sini).
export async function getRecentMovements(
  input: unknown,
): Promise<ActionResponse<StockMovementItem[]>> {
  const akses = await aksesTenant();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = listMovementsSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const { variantId, type, perPage } = parsed.data;

  try {
    const movements = await prisma.stockMovement.findMany({
      where: {
        // Filter tenant dan filter varian digabung dalam SATU kunci `batch`
        // (kalau dipisah, spread kedua akan menghapus filter tenant).
        batch: {
          variant: {
            product: { tenantId: akses.tenantId },
            ...(variantId ? { id: variantId } : {}),
          },
        },
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: perPage,
      select: {
        id: true,
        type: true,
        quantity: true,
        reference: true,
        notes: true,
        createdAt: true,
        batch: {
          select: {
            batchNumber: true,
            variant: { select: { sku: true, name: true } },
          },
        },
      },
    });

    const data: StockMovementItem[] = movements.map((movement) => ({
      id: movement.id,
      type: movement.type as MovementType,
      quantity: movement.quantity,
      reference: movement.reference,
      notes: movement.notes,
      createdAt: movement.createdAt.toISOString(),
      batchNumber: movement.batch.batchNumber,
      sku: movement.batch.variant.sku,
      variantName: movement.batch.variant.name,
    }));

    return { success: true, message: "Riwayat pergerakan dimuat.", data };
  } catch (error) {
    return {
      success: false,
      message: "Gagal memuat riwayat pergerakan.",
      error: pesanErrorUmum(error),
    };
  }
}

// ---------------------------------------------------------------------------
// TULIS
// ---------------------------------------------------------------------------

// STOK MASUK: tambah ke batch yang sama bila batchNumber sudah ada.
export async function stockIn(input: unknown): Promise<
  ActionResponse<{
    batchId: string;
    batchNumber: string;
    quantity: number;
    batchBaru: boolean;
    /** Harga modal per unit batch setelah stok masuk (null = belum dicatat). */
    costPrice: number | null;
    /** true bila pemasok pilihan user tidak dipakai karena batch sudah punya. */
    pemasokDipertahankan: boolean;
  }>
> {
  const akses = await aksesTenant();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = stockInSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const {
    variantId,
    batchNumber,
    quantity,
    expiredDate,
    reference,
    notes,
    costPrice: costPriceInput,
    supplierId,
  } = parsed.data;

  // "" dari form berarti "belum dicatat" — bukan harga nol.
  const costPrice =
    costPriceInput && costPriceInput.length > 0 ? Number(costPriceInput) : null;

  // Kebijakan batch: nomor batch & tanggal kedaluwarsa hanya dipakai bila fitur
  // batch aktif (paket PRO — PRD Bagian 4.D). Selain itu stok masuk
  // menumpuk di satu batch default tanpa tanggal kedaluwarsa.
  const nomorBatch = akses.batchEnabled
    ? (batchNumber ?? "").trim()
    : DEFAULT_BATCH_NUMBER;
  if (akses.batchEnabled && nomorBatch.length === 0) {
    return {
      success: false,
      message: "Nomor batch wajib diisi untuk jenis usaha ini.",
    };
  }

  // id pemasok dari tenant lain tidak boleh tersimpan: diperiksa dengan findFirst
  // berfilter tenantId, sama seperti variantId di bawah.
  const pemasokDipilih = supplierId && supplierId.length > 0 ? supplierId : null;

  try {
    const [variant, pemasok] = await Promise.all([
      prisma.productVariant.findFirst({
        where: { id: variantId, product: { tenantId: akses.tenantId } },
        select: { id: true },
      }),
      pemasokDipilih
        ? prisma.supplier.findFirst({
            where: { id: pemasokDipilih, tenantId: akses.tenantId },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);
    if (!variant) {
      return { success: false, message: "Varian tidak ditemukan pada tenant ini." };
    }
    if (pemasokDipilih && !pemasok) {
      return { success: false, message: "Pemasok tidak ditemukan pada tenant ini." };
    }

    const expired =
      akses.batchEnabled && expiredDate && expiredDate.length > 0
        ? parseTanggalInput(expiredDate)
        : null;

    const hasil = await prisma.$transaction(async (tx) => {
      const batchLama = await tx.inventoryBatch.findFirst({
        where: { variantId: variant.id, batchNumber: nomorBatch },
        select: { id: true, quantity: true, costPrice: true, supplierId: true },
      });

      let batchId: string;
      let batchBaru: boolean;
      let costPriceSetelah = costPrice;
      let supplierIdSetelah = pemasokDipilih;
      let pemasokDipertahankan = false;

      if (batchLama) {
        // Batch yang sama = satu sumber pembelian, jadi pemasok asalnya tidak
        // ditimpa oleh stok masuk berikutnya. Bila batch belum punya pemasok,
        // pilihan kali ini yang mengisinya.
        const supplierLama = batchLama.supplierId;
        supplierIdSetelah = supplierLama ?? pemasokDipilih;
        pemasokDipertahankan =
          pemasokDipilih !== null &&
          supplierLama !== null &&
          supplierLama !== pemasokDipilih;

        // Harga modal digabung rata-rata tertimbang, bukan "harga terakhir menang"
        // (alasan lengkapnya di src/lib/hpp.ts).
        costPriceSetelah = gabungHargaModal({
          jumlahLama: batchLama.quantity,
          modalLama: batchLama.costPrice === null ? null : Number(batchLama.costPrice),
          jumlahBaru: quantity,
          modalBaru: costPrice,
        });

        await tx.inventoryBatch.update({
          where: { id: batchLama.id },
          data: {
            quantity: { increment: quantity },
            costPrice: costPriceSetelah,
            supplierId: supplierIdSetelah,
          },
        });
        batchId = batchLama.id;
        batchBaru = false;
      } else {
        const dibuat = await tx.inventoryBatch.create({
          data: {
            variantId: variant.id,
            batchNumber: nomorBatch,
            quantity,
            expiredDate: expired,
            costPrice,
            supplierId: pemasokDipilih,
          },
          select: { id: true },
        });
        batchId = dibuat.id;
        batchBaru = true;
      }

      // Setiap perubahan stok wajib tercatat. unitCost pada baris IN adalah
      // harga modal yang dibayar kali ini — HPP hanya membaca baris OUT, jadi
      // mencatatnya di sini tidak menimbulkan perhitungan ganda.
      await tx.stockMovement.create({
        data: {
          batchId,
          type: "IN",
          quantity,
          unitCost: costPrice,
          reference: reference && reference.length > 0 ? reference : null,
          notes: notes && notes.length > 0 ? notes : null,
        },
      });

      return { batchId, batchBaru, costPriceSetelah, pemasokDipertahankan };
    });

    return {
      success: true,
      message: `Stok masuk ${quantity} unit ke batch ${nomorBatch}${
        hasil.batchBaru ? " (batch baru)" : " (digabung ke batch yang ada)"
      }${hasil.pemasokDipertahankan ? " · pemasok batch tetap seperti asalnya" : ""}.`,
      data: {
        batchId: hasil.batchId,
        batchNumber: nomorBatch,
        quantity,
        batchBaru: hasil.batchBaru,
        costPrice: hasil.costPriceSetelah,
        pemasokDipertahankan: hasil.pemasokDipertahankan,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal menyimpan stok masuk.",
      error: pesanErrorUmum(error),
    };
  }
}

// STOK KELUAR: alokasi FEFO (implementasi bersama ada di src/lib/stock-allocation.ts).
export async function stockOut(input: unknown): Promise<
  ActionResponse<{ allocations: StockOutAllocation[]; total: number }>
> {
  const akses = await aksesTenant();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = stockOutSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const { variantId, quantity, reference, notes } = parsed.data;

  try {
    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, product: { tenantId: akses.tenantId } },
      select: { id: true },
    });
    if (!variant) {
      return { success: false, message: "Varian tidak ditemukan pada tenant ini." };
    }

    const hasil = await prisma.$transaction((tx) =>
      alokasiFefoKeluar(tx, {
        variantId: variant.id,
        quantity,
        reference: reference && reference.length > 0 ? reference : null,
        notes: notes && notes.length > 0 ? notes : null,
      }),
    );

    return {
      success: true,
      message: `Stok keluar ${quantity} unit dari ${hasil.allocations.length} batch (FEFO).`,
      data: hasil,
    };
  } catch (error) {
    if (error instanceof StokTidakCukupError) {
      return { success: false, message: error.message };
    }
    if (error instanceof StokBerubahError) {
      return { success: false, message: error.message };
    }
    return {
      success: false,
      message: "Gagal memproses stok keluar.",
      error: pesanErrorUmum(error),
    };
  }
}
