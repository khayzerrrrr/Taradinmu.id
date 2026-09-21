"use server";

import { prisma } from "@/lib/prisma";
import type { ActionResponse } from "@/shared/types";
import {
  createVariantSchema,
  deleteVariantSchema,
  updateVariantSchema,
} from "../schemas/variant-schema";
import type { VariantItem } from "../types";
import {
  isForeignKeyError,
  isUniqueConstraintError,
  pesanErrorUmum,
  pesanValidasi,
} from "../utils";
import { aksesTenant } from "./akses-tenant";

// ProductVariant tidak memiliki tenantId, jadi setiap operasi WAJIB memverifikasi
// bahwa produk induknya milik tenant aktif (mencegah IDOR antar tenant).

// CREATE
export async function createVariant(
  input: unknown,
): Promise<ActionResponse<VariantItem>> {
  const akses = await aksesTenant();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = createVariantSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const { productId, sku, name, price } = parsed.data;

  try {
    const produk = await prisma.product.findFirst({
      where: { id: productId, tenantId: akses.tenantId },
      select: { id: true },
    });
    if (!produk) {
      return { success: false, message: "Produk tidak ditemukan pada tenant ini." };
    }

    const variant = await prisma.productVariant.create({
      data: { productId: produk.id, sku, name, price },
      select: { id: true, sku: true, name: true, price: true },
    });

    return {
      success: true,
      message: `Varian "${variant.name}" berhasil dibuat.`,
      data: {
        id: variant.id,
        sku: variant.sku,
        name: variant.name,
        price: variant.price.toString(),
      },
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { success: false, message: `SKU "${sku}" sudah dipakai.` };
    }
    return {
      success: false,
      message: "Gagal membuat varian.",
      error: pesanErrorUmum(error),
    };
  }
}

// UPDATE
export async function updateVariant(
  input: unknown,
): Promise<ActionResponse<{ variantId: string }>> {
  const akses = await aksesTenant();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = updateVariantSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const { variantId, sku, name, price } = parsed.data;

  try {
    const hasil = await prisma.productVariant.updateMany({
      where: { id: variantId, product: { tenantId: akses.tenantId } },
      data: { sku, name, price },
    });

    if (hasil.count === 0) {
      return { success: false, message: "Varian tidak ditemukan." };
    }

    return {
      success: true,
      message: "Varian berhasil diperbarui.",
      data: { variantId },
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { success: false, message: `SKU "${sku}" sudah dipakai.` };
    }
    return {
      success: false,
      message: "Gagal memperbarui varian.",
      error: pesanErrorUmum(error),
    };
  }
}

// DELETE
export async function deleteVariant(
  input: unknown,
): Promise<ActionResponse<{ variantId: string }>> {
  const akses = await aksesTenant();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = deleteVariantSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  try {
    const hasil = await prisma.productVariant.deleteMany({
      where: { id: parsed.data.variantId, product: { tenantId: akses.tenantId } },
    });

    if (hasil.count === 0) {
      return { success: false, message: "Varian tidak ditemukan." };
    }

    return {
      success: true,
      message: "Varian berhasil dihapus.",
      data: { variantId: parsed.data.variantId },
    };
  } catch (error) {
    if (isForeignKeyError(error)) {
      return {
        success: false,
        message: "Varian masih dipakai data stok/batch, tidak bisa dihapus.",
      };
    }
    return {
      success: false,
      message: "Gagal menghapus varian.",
      error: pesanErrorUmum(error),
    };
  }
}
