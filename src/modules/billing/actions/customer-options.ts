"use server";

import { pesanErrorUmum } from "@/lib/action";
import { prisma } from "@/lib/prisma";
import type { ActionResponse } from "@/shared/types";
import { aksesTenant } from "./akses-tenant";

export type CustomerOption = {
  id: string;
  name: string;
  phone: string | null;
};

// Daftar ringkas pelanggan untuk dropdown (mis. pada form invoice).
export async function getCustomerOptions(): Promise<
  ActionResponse<CustomerOption[]>
> {
  const akses = await aksesTenant();
  if (!akses.ok) return { success: false, message: akses.message };

  try {
    const customers = await prisma.customer.findMany({
      where: { tenantId: akses.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true },
    });

    return { success: true, message: "Daftar pelanggan dimuat.", data: customers };
  } catch (error) {
    return {
      success: false,
      message: "Gagal memuat daftar pelanggan.",
      error: pesanErrorUmum(error),
    };
  }
}
