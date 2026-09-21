"use server";

import type { Prisma } from "@/generated/prisma/client";
import {
  isForeignKeyError,
  pesanErrorUmum,
  pesanValidasi,
} from "@/lib/action";
import { prisma } from "@/lib/prisma";
import type { ActionResponse } from "@/shared/types";
import {
  createCustomerSchema,
  deleteCustomerSchema,
  listCustomersSchema,
  updateCustomerSchema,
} from "../schemas/customer-schema";
import type { CustomerListData } from "../types";
import { aksesTenant } from "./akses-tenant";

// Teks opsional: "" dianggap kosong.
function bersihkan(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

// READ: daftar pelanggan tenant (paginasi + pencarian).
export async function getCustomers(
  input: unknown,
): Promise<ActionResponse<CustomerListData>> {
  const akses = await aksesTenant();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = listCustomersSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const { page, perPage, search } = parsed.data;
  const where: Prisma.CustomerWhereInput = {
    tenantId: akses.tenantId,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  try {
    const [total, customers] = await prisma.$transaction([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        include: { _count: { select: { invoices: true } } },
      }),
    ]);

    return {
      success: true,
      message: "Daftar pelanggan berhasil dimuat.",
      data: {
        customers: customers.map((customer) => ({
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          address: customer.address,
          createdAt: customer.createdAt.toISOString(),
          invoiceCount: customer._count.invoices,
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
      message: "Gagal memuat daftar pelanggan.",
      error: pesanErrorUmum(error),
    };
  }
}

// CREATE
export async function createCustomer(
  input: unknown,
): Promise<ActionResponse<{ customerId: string }>> {
  const akses = await aksesTenant();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = createCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  try {
    const customer = await prisma.customer.create({
      data: {
        tenantId: akses.tenantId,
        name: parsed.data.name,
        phone: bersihkan(parsed.data.phone),
        email: bersihkan(parsed.data.email),
        address: bersihkan(parsed.data.address),
      },
      select: { id: true },
    });

    return {
      success: true,
      message: `Pelanggan "${parsed.data.name}" berhasil dibuat.`,
      data: { customerId: customer.id },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal membuat pelanggan.",
      error: pesanErrorUmum(error),
    };
  }
}

// UPDATE (dibatasi tenantId)
export async function updateCustomer(
  input: unknown,
): Promise<ActionResponse<{ customerId: string }>> {
  const akses = await aksesTenant();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = updateCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  try {
    const hasil = await prisma.customer.updateMany({
      where: { id: parsed.data.customerId, tenantId: akses.tenantId },
      data: {
        name: parsed.data.name,
        phone: bersihkan(parsed.data.phone),
        email: bersihkan(parsed.data.email),
        address: bersihkan(parsed.data.address),
      },
    });

    if (hasil.count === 0) {
      return { success: false, message: "Pelanggan tidak ditemukan." };
    }

    return {
      success: true,
      message: `Pelanggan "${parsed.data.name}" berhasil diperbarui.`,
      data: { customerId: parsed.data.customerId },
    };
  } catch (error) {
    return {
      success: false,
      message: "Gagal memperbarui pelanggan.",
      error: pesanErrorUmum(error),
    };
  }
}

// DELETE — ditolak bila pelanggan masih punya invoice.
export async function deleteCustomer(
  input: unknown,
): Promise<ActionResponse<{ customerId: string }>> {
  const akses = await aksesTenant();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = deleteCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  try {
    const jumlahInvoice = await prisma.invoice.count({
      where: { customerId: parsed.data.customerId, tenantId: akses.tenantId },
    });
    if (jumlahInvoice > 0) {
      return {
        success: false,
        message: `Pelanggan masih punya ${jumlahInvoice} invoice. Hapus invoice-nya lebih dulu.`,
      };
    }

    const hasil = await prisma.customer.deleteMany({
      where: { id: parsed.data.customerId, tenantId: akses.tenantId },
    });
    if (hasil.count === 0) {
      return { success: false, message: "Pelanggan tidak ditemukan." };
    }

    return {
      success: true,
      message: "Pelanggan berhasil dihapus.",
      data: { customerId: parsed.data.customerId },
    };
  } catch (error) {
    if (isForeignKeyError(error)) {
      return {
        success: false,
        message: "Pelanggan masih dipakai data lain, tidak bisa dihapus.",
      };
    }
    return {
      success: false,
      message: "Gagal menghapus pelanggan.",
      error: pesanErrorUmum(error),
    };
  }
}
