"use server";

import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { assertSuperAdmin } from "@/modules/core/auth/dal";
import {
  createTenantSchema,
  listTenantsSchema,
  updateTenantSchema,
} from "@/modules/core/schemas/tenant-schema";
import type { ActionResponse, TenantListData } from "@/modules/core/types";
import { slugify } from "@/modules/core/utils";
import { isReservedSlug } from "@/shared/constants";

// Kumpulkan pesan validasi Zod menjadi satu kalimat.
function pesanValidasi(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join(" ");
}

// Deteksi pelanggaran unique constraint (P2002) tanpa bergantung pada kelas error Prisma.
function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function isRecordNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2025"
  );
}

function pesanErrorUmum(error: unknown): string {
  return error instanceof Error ? error.message : "Terjadi kesalahan tak terduga.";
}

// Mendapatkan semua tenant dengan pagination.
export async function getAllTenants(
  input: unknown,
): Promise<ActionResponse<TenantListData>> {
  const guard = await assertSuperAdmin();
  if (!guard.ok) return { success: false, message: guard.message };

  const parsed = listTenantsSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const { page, perPage, search } = parsed.data;
  const where: Prisma.TenantWhereInput = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { slug: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  try {
    const [total, tenants] = await prisma.$transaction([
      prisma.tenant.count({ where }),
      prisma.tenant.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        include: { _count: { select: { users: true } } },
      }),
    ]);

    return {
      success: true,
      message: "Daftar tenant berhasil dimuat.",
      data: {
        tenants: tenants.map((tenant) => ({
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          subdomain: tenant.subdomain,
          plan: tenant.plan,
          enabledModules: tenant.enabledModules,
          createdAt: tenant.createdAt.toISOString(),
          userCount: tenant._count.users,
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
      message: "Gagal memuat daftar tenant.",
      error: pesanErrorUmum(error),
    };
  }
}

// Membuat tenant baru sekaligus akun OWNER-nya.
export async function createTenant(
  input: unknown,
): Promise<ActionResponse<{ tenantId: string; slug: string }>> {
  const guard = await assertSuperAdmin();
  if (!guard.ok) return { success: false, message: guard.message };

  const parsed = createTenantSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const data = parsed.data;
  const slug = data.slug && data.slug.length > 0 ? data.slug : slugify(data.name);
  if (!slug) {
    return { success: false, message: "Slug tidak valid. Isi slug secara manual." };
  }
  // Slug hasil generate dari nama juga harus dicek (mis. nama "Admin" -> "admin").
  if (isReservedSlug(slug)) {
    return {
      success: false,
      message: `Slug "${slug}" dipakai sistem. Gunakan nama atau slug lain.`,
    };
  }

  const subdomain = data.subdomain && data.subdomain.length > 0 ? data.subdomain : null;
  if (subdomain && isReservedSlug(subdomain)) {
    return {
      success: false,
      message: `Subdomain "${subdomain}" dipakai sistem. Gunakan yang lain.`,
    };
  }

  const ownerEmail = data.ownerEmail.trim().toLowerCase();

  try {
    const passwordHash = await hash(data.ownerPassword, 10);

    // Pembuatan tenant + user OWNER dilakukan dalam satu query bersarang (atomik).
    const tenant = await prisma.tenant.create({
      data: {
        name: data.name,
        slug,
        subdomain,
        plan: data.plan,
        enabledModules: data.enabledModules,
        users: {
          create: {
            name: data.ownerName,
            email: ownerEmail,
            password: passwordHash,
            role: "OWNER",
          },
        },
      },
      select: { id: true, slug: true },
    });

    revalidatePath("/admin");
    return {
      success: true,
      message: `Tenant "${data.name}" berhasil dibuat beserta akun OWNER.`,
      data: { tenantId: tenant.id, slug: tenant.slug },
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        success: false,
        message: "Email pemilik, slug, atau subdomain sudah dipakai.",
      };
    }
    return {
      success: false,
      message: "Gagal membuat tenant.",
      error: pesanErrorUmum(error),
    };
  }
}

// Memperbarui paket (plan) dan daftar modul aktif tenant.
export async function updateTenantPlanAndModules(
  input: unknown,
): Promise<ActionResponse<{ tenantId: string }>> {
  const guard = await assertSuperAdmin();
  if (!guard.ok) return { success: false, message: guard.message };

  const parsed = updateTenantSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const { tenantId, plan, enabledModules } = parsed.data;

  try {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { plan, enabledModules },
    });

    revalidatePath("/admin");
    return {
      success: true,
      message: "Paket dan modul tenant berhasil diperbarui.",
      data: { tenantId },
    };
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { success: false, message: "Tenant tidak ditemukan." };
    }
    return {
      success: false,
      message: "Gagal memperbarui tenant.",
      error: pesanErrorUmum(error),
    };
  }
}
