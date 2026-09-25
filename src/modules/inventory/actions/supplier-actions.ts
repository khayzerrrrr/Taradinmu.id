"use server";

import { pesanErrorUmum, pesanValidasi } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import type { ActionResponse } from "@/shared/types";
import {
  createSupplierSchema,
  deleteSupplierSchema,
  listSuppliersSchema,
  updateSupplierSchema,
} from "../schemas/supplier-schema";
import type { SupplierItem, SupplierListData, SupplierOption } from "../types";
import { aksesTenant, aksesTenantTulis } from "./akses-tenant";

// Master data pemasok (PRD 4.G.4).
//
// Pemasok menjawab "modal siapa yang masih numpuk di rak". Pertanyaan itu tidak
// bisa dijawab oleh kolom teks bebas di form stok, karena ejaan yang berbeda
// membuat dua pembelian dari toko yang sama tidak pernah bertemu.
//
// TULIS dikhususkan untuk OWNER/ADMIN lewat aksesTenantTulis(); STAFF membaca
// saja. Baca memakai aksesTenant() seperti action inventory lainnya.

// Teks opsional: "" dianggap kosong.
function bersihkan(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

// READ: daftar pemasok tenant + nilai modal yang masih tertahan di stoknya.
export async function getSuppliers(
  input: unknown,
): Promise<ActionResponse<SupplierListData>> {
  const akses = await aksesTenant();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = listSuppliersSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const { page, perPage, search } = parsed.data;
  const where = {
    tenantId: akses.tenantId,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  try {
    const [total, suppliers] = await prisma.$transaction([
      prisma.supplier.count({ where }),
      prisma.supplier.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          address: true,
          notes: true,
          createdAt: true,
        },
      }),
    ]);

    // Nilai modal yang masih tertahan: jumlahkan sisa stok x harga modal batch.
    // Satu query untuk seluruh baris di halaman ini, bukan per baris.
    const batch = await prisma.inventoryBatch.findMany({
      where: {
        supplierId: { in: suppliers.map((supplier) => supplier.id) },
        variant: { product: { tenantId: akses.tenantId } },
      },
      select: { supplierId: true, quantity: true, costPrice: true },
    });

    const modalPerPemasok = new Map<string, number>();
    const batchPerPemasok = new Map<string, number>();
    for (const baris of batch) {
      if (!baris.supplierId) continue;
      const nilai =
        baris.costPrice === null ? 0 : baris.quantity * Number(baris.costPrice);
      modalPerPemasok.set(
        baris.supplierId,
        (modalPerPemasok.get(baris.supplierId) ?? 0) + nilai,
      );
      batchPerPemasok.set(
        baris.supplierId,
        (batchPerPemasok.get(baris.supplierId) ?? 0) + 1,
      );
    }

    const data: SupplierItem[] = suppliers.map((supplier) => ({
      ...supplier,
      createdAt: supplier.createdAt.toISOString(),
      batchCount: batchPerPemasok.get(supplier.id) ?? 0,
      // Decimal dikirim sebagai string agar presisi tidak hilang.
      nilaiModal: (modalPerPemasok.get(supplier.id) ?? 0).toFixed(2),
    }));

    return {
      success: true,
      message: "Daftar pemasok berhasil dimuat.",
      data: {
        suppliers: data,
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
      message: "Gagal memuat daftar pemasok.",
      error: pesanErrorUmum(error),
    };
  }
}

// Opsi pemasok untuk form stok masuk: nama saja, urut alfabet, tanpa paginasi.
export async function getSupplierOptions(): Promise<
  ActionResponse<SupplierOption[]>
> {
  const akses = await aksesTenant();
  if (!akses.ok) return { success: false, message: akses.message };

  try {
    const suppliers = await prisma.supplier.findMany({
      where: { tenantId: akses.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

    return {
      success: true,
      message: "Daftar pemasok berhasil dimuat.",
      data: suppliers,
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal memuat daftar pemasok.",
      error: pesanErrorUmum(error),
    };
  }
}

// CREATE
export async function createSupplier(
  input: unknown,
): Promise<ActionResponse<{ supplierId: string }>> {
  const akses = await aksesTenantTulis();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = createSupplierSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  try {
    const supplier = await prisma.supplier.create({
      data: {
        tenantId: akses.tenantId,
        name: parsed.data.name,
        phone: bersihkan(parsed.data.phone),
        email: bersihkan(parsed.data.email),
        address: bersihkan(parsed.data.address),
        notes: bersihkan(parsed.data.notes),
      },
      select: { id: true },
    });

    return {
      success: true,
      message: `Pemasok "${parsed.data.name}" berhasil dibuat.`,
      data: { supplierId: supplier.id },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal membuat pemasok.",
      error: pesanErrorUmum(error),
    };
  }
}

// UPDATE (dibatasi tenantId agar id dari tenant lain tidak bisa diubah)
export async function updateSupplier(
  input: unknown,
): Promise<ActionResponse<{ supplierId: string }>> {
  const akses = await aksesTenantTulis();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = updateSupplierSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  try {
    const hasil = await prisma.supplier.updateMany({
      where: { id: parsed.data.supplierId, tenantId: akses.tenantId },
      data: {
        name: parsed.data.name,
        phone: bersihkan(parsed.data.phone),
        email: bersihkan(parsed.data.email),
        address: bersihkan(parsed.data.address),
        notes: bersihkan(parsed.data.notes),
      },
    });

    if (hasil.count === 0) {
      return { success: false, message: "Pemasok tidak ditemukan." };
    }

    return {
      success: true,
      message: `Pemasok "${parsed.data.name}" berhasil diperbarui.`,
      data: { supplierId: parsed.data.supplierId },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal memperbarui pemasok.",
      error: pesanErrorUmum(error),
    };
  }
}

/**
 * DELETE — batch yang berasal dari pemasok ini TIDAK ikut terhapus: relasinya
 * ON DELETE SET NULL (PRD 4.G.4), jadi stok dan harga modalnya tetap ada, hanya
 * penanda asalnya yang lepas. Jumlah batch dilaporkan lebih dulu lewat dialog
 * konfirmasi agar pengguna tidak melepasnya tanpa sadar.
 */
export async function deleteSupplier(
  input: unknown,
): Promise<ActionResponse<{ supplierId: string }>> {
  const akses = await aksesTenantTulis();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = deleteSupplierSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  try {
    const hasil = await prisma.supplier.deleteMany({
      where: { id: parsed.data.supplierId, tenantId: akses.tenantId },
    });
    if (hasil.count === 0) {
      return { success: false, message: "Pemasok tidak ditemukan." };
    }

    return {
      success: true,
      message: "Pemasok berhasil dihapus. Batch stoknya tetap ada.",
      data: { supplierId: parsed.data.supplierId },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal menghapus pemasok.",
      error: pesanErrorUmum(error),
    };
  }
}
