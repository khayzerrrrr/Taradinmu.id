"use server";

import type { Prisma } from "@/generated/prisma/client";
import { checkLimit } from "@/lib/feature-guards";
import { prisma } from "@/lib/prisma";
import type { ActionResponse } from "@/shared/types";
import {
  createProductSchema,
  deleteProductSchema,
  listProductsSchema,
  updateProductSchema,
} from "../schemas/product-schema";
import type { ProductListData } from "../types";
import {
  isUniqueConstraintError,
  pesanErrorUmum,
  pesanValidasi,
} from "../utils";
import { aksesTenant } from "./akses-tenant";

// Catatan: halaman inventory memakai `dynamic = "force-dynamic"`, jadi setelah
// mutasi cukup `router.refresh()` di sisi client — tidak perlu revalidatePath.

// READ: daftar produk tenant (dengan pagination + pencarian).
export async function getProducts(
  input: unknown,
): Promise<ActionResponse<ProductListData>> {
  const akses = await aksesTenant();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = listProductsSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const { page, perPage, search } = parsed.data;
  // Scoping tenant WAJIB: jangan pernah percaya tenantId dari client.
  const where: Prisma.ProductWhereInput = {
    tenantId: akses.tenantId,
    ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
  };

  try {
    const [total, products] = await prisma.$transaction([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        include: { variants: { orderBy: { sku: "asc" } } },
      }),
    ]);

    return {
      success: true,
      message: "Daftar produk berhasil dimuat.",
      data: {
        products: products.map((product) => ({
          id: product.id,
          name: product.name,
          description: product.description,
          createdAt: product.createdAt.toISOString(),
          variants: product.variants.map((variant) => ({
            id: variant.id,
            sku: variant.sku,
            name: variant.name,
            price: variant.price.toString(),
          })),
        })),
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
      message: "Gagal memuat daftar produk.",
      error: pesanErrorUmum(error),
    };
  }
}

// CREATE: produk baru untuk tenant aktif.
export async function createProduct(
  input: unknown,
): Promise<ActionResponse<{ productId: string }>> {
  const akses = await aksesTenant();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const description = parsed.data.description?.trim();

  try {
    // Batas paket: jumlah produk maksimum untuk paket FREE.
    const batas = await checkLimit(akses.tenantId, "PRODUCT");
    if (!batas.allowed) {
      return { success: false, message: batas.message, code: batas.code };
    }

    const product = await prisma.product.create({
      data: {
        tenantId: akses.tenantId,
        name: parsed.data.name,
        description: description ? description : null,
      },
      select: { id: true },
    });

    return {
      success: true,
      message: `Produk "${parsed.data.name}" berhasil dibuat.`,
      data: { productId: product.id },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal membuat produk.",
      error: pesanErrorUmum(error),
    };
  }
}

// UPDATE: hanya produk milik tenant aktif (dibatasi lewat where tenantId).
export async function updateProduct(
  input: unknown,
): Promise<ActionResponse<{ productId: string }>> {
  const akses = await aksesTenant();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = updateProductSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const description = parsed.data.description?.trim();

  try {
    const hasil = await prisma.product.updateMany({
      where: { id: parsed.data.productId, tenantId: akses.tenantId },
      data: {
        name: parsed.data.name,
        description: description ? description : null,
      },
    });

    if (hasil.count === 0) {
      return { success: false, message: "Produk tidak ditemukan." };
    }

    return {
      success: true,
      message: `Produk "${parsed.data.name}" berhasil diperbarui.`,
      data: { productId: parsed.data.productId },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal memperbarui produk.",
      error: pesanErrorUmum(error),
    };
  }
}

// DELETE: varian ikut terhapus (onDelete: Cascade pada relasi ProductVariant).
export async function deleteProduct(
  input: unknown,
): Promise<ActionResponse<{ productId: string }>> {
  const akses = await aksesTenant();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = deleteProductSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  try {
    const hasil = await prisma.product.deleteMany({
      where: { id: parsed.data.productId, tenantId: akses.tenantId },
    });

    if (hasil.count === 0) {
      return { success: false, message: "Produk tidak ditemukan." };
    }

    return {
      success: true,
      message: "Produk berhasil dihapus.",
      data: { productId: parsed.data.productId },
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { success: false, message: "Produk masih dipakai data lain." };
    }
    return {
      success: false,
      message: "Gagal menghapus produk.",
      error: pesanErrorUmum(error),
    };
  }
}
