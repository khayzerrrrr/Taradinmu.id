import type { PlanType } from "@/generated/prisma/client";
import {
  ambilBatasFitur,
  ambilBatasJumlah,
  LIMIT_LABELS,
  type LimitKey,
} from "@/lib/plan-limits";
import { prisma } from "@/lib/prisma";

// Penjaga batas paket. Server-only (menyentuh database).
// Dipanggil Server Action SEBELUM membuat data, supaya tenant paket FREE tidak
// bisa melewati kuotanya lewat API.

type DasarLimit = {
  plan: PlanType;
  /** Jumlah data yang sudah ada (null untuk batas berbasis fitur). */
  used: number | null;
  /** Batas paket (null = tanpa batas / tidak berlaku). */
  limit: number | null;
};

export type LimitCheck =
  | ({ allowed: true } & DasarLimit)
  | ({
      allowed: false;
      /** Kode mesin agar UI bisa menampilkan ajakan upgrade. */
      code: "UPGRADE_REQUIRED";
      message: string;
    } & DasarLimit);

// Periksa apakah tenant masih boleh memakai sebuah fitur/data.
export async function checkLimit(
  tenantId: string,
  type: LimitKey,
): Promise<LimitCheck> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });
  if (!tenant) {
    // Pemanggil selalu memverifikasi tenant lebih dulu, jadi ini kondisi mustahil.
    throw new Error("Tenant tidak ditemukan saat memeriksa batas paket.");
  }

  const plan = tenant.plan;

  // --- Batas berbasis fitur (batch, zakat otomatis) ---
  if (type === "BATCH" || type === "ZAKAT") {
    if (ambilBatasFitur(plan, type)) {
      return { allowed: true, plan, used: null, limit: null };
    }
    return {
      allowed: false,
      plan,
      used: null,
      limit: null,
      code: "UPGRADE_REQUIRED",
      message: `Paket ${plan} tidak termasuk ${LIMIT_LABELS[type]}. Upgrade ke PRO untuk mengaktifkannya.`,
    };
  }

  // --- Batas berbasis jumlah (invoice, produk) ---
  const limit = ambilBatasJumlah(plan, type);
  const used =
    type === "INVOICE"
      ? await prisma.invoice.count({ where: { tenantId } })
      : await prisma.product.count({ where: { tenantId } });

  if (limit === null || used < limit) {
    return { allowed: true, plan, used, limit };
  }

  return {
    allowed: false,
    plan,
    used,
    limit,
    code: "UPGRADE_REQUIRED",
    message: `Batas paket ${plan} tercapai: maksimal ${limit} ${LIMIT_LABELS[type]}. Saat ini ${used}. Upgrade ke PRO untuk menambah tanpa batas.`,
  };
}
