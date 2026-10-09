"use server";

import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import type { Prisma } from "@/generated/prisma/client";
import { formatTanggal } from "@/lib/format";
import { paketBisaKedaluwarsa, riwayatPerluDitulis } from "@/lib/plan-limits";
import { prisma } from "@/lib/prisma";
import { assertSuperAdmin } from "@/modules/core/auth/dal";
import {
  createTenantSchema,
  listTenantsSchema,
  updateTenantSchema,
  tanggalMasaBerlaku,
} from "@/modules/core/schemas/tenant-schema";
import type { ActionResponse, TenantListData } from "@/modules/core/types";
import { slugify } from "@/modules/core/utils";
import {
  JENDELA_MINAT_HARI,
  MINAT_KOSONG,
  rangkumMinat,
} from "@/lib/upgrade-interest";
import { isReservedSlug } from "@/shared/constants";

// Empat helper di bawah ini sempat dityalin secara lokal di berkas ini, sehingga
// aksi Super Admin justru jadi satu-satunya yang tidak melewati pencatatan error
// terpusat. Sekarang mengimpor dari src/lib/action seperti modul lain.
import {
  isRecordNotFoundError,
  isUniqueConstraintError,
  pesanErrorUmum,
  pesanValidasi,
} from "@/lib/action";

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
        include: {
          _count: { select: { users: true } },
          // Beberapa perubahan paket terakhir (PRD 4.D.4). Tabelnya append-only,
          // jadi dibatasi: halaman ini menjawab "kapan terakhir diganti dan oleh
          // siapa", bukan membentangkan seluruh sejarah.
          planChanges: {
            orderBy: { createdAt: "desc" },
            take: 3,
            select: {
              id: true,
              dari: true,
              ke: true,
              expiresAt: true,
              catatan: true,
              createdAt: true,
              oleh: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    // Klik gembok 30 hari terakhir (PRD 4.D.5). Query kedua khusus untuk halaman
    // ini — hanya Super Admin yang membacanya, dan hanya untuk tenant di halaman
    // yang sama, jadi jumlah barisnya dibatasi pagination.
    const sejak = new Date(
      Date.now() - JENDELA_MINAT_HARI * 24 * 60 * 60 * 1000,
    );
    const barisMinat = await prisma.upgradeInterest.groupBy({
      by: ["tenantId", "kunci", "tahap"],
      where: { tenantId: { in: tenants.map((tenant) => tenant.id) }, createdAt: { gte: sejak } },
      _count: { _all: true },
    });
    const minatPerTenant = rangkumMinat(
      barisMinat.map((baris) => ({
        tenantId: baris.tenantId,
        kunci: baris.kunci,
        tahap: baris.tahap,
        jumlah: baris._count._all,
      })),
    );

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
          planExpiresAt: tenant.planExpiresAt?.toISOString() ?? null,
          enabledModules: tenant.enabledModules,
          createdAt: tenant.createdAt.toISOString(),
          userCount: tenant._count.users,
          minat: minatPerTenant.get(tenant.id) ?? MINAT_KOSONG,
          riwayat: tenant.planChanges.map((ubah) => ({
            id: ubah.id,
            dari: ubah.dari,
            ke: ubah.ke,
            expiresAt: ubah.expiresAt?.toISOString() ?? null,
            // Nama pengubah ikut terkirim; null bila akunnya sudah dihapus —
            // riwayatnya sengaja bertahan (FK-nya SetNull, bukan Cascade).
            oleh: ubah.oleh?.name ?? null,
            catatan: ubah.catatan,
            createdAt: ubah.createdAt.toISOString(),
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
  // Sama seperti dialog "Kelola": tanggal hanya berarti selama PRO.
  const berbayar = paketBisaKedaluwarsa(data.plan);
  const berakhir = berbayar ? tanggalMasaBerlaku(data.expiresAt) : null;

  try {
    const passwordHash = await hash(data.ownerPassword, 10);

    // Pembuatan tenant + user OWNER dilakukan dalam satu query bersarang (atomik).
    const tenant = await prisma.tenant.create({
      data: {
        name: data.name,
        slug,
        subdomain,
        plan: data.plan,
        planExpiresAt: berakhir,
        enabledModules: data.enabledModules,
        users: {
          create: {
            name: data.ownerName,
            email: ownerEmail,
            password: passwordHash,
            role: "OWNER",
          },
        },
        // Riwayat paket dimulai dari aktivasi pertama (PRD 4.D.4). Tenant FREE
        // tidak punya apa pun yang dicatat: FREE adalah keadaan awalnya, bukan
        // perubahan.
        ...(berbayar
          ? {
              planChanges: {
                create: {
                  dari: "FREE" as const,
                  ke: data.plan,
                  expiresAt: berakhir,
                  olehUserId: guard.userId,
                  catatan: "Dibuat aktif bersama tenant.",
                },
              },
            }
          : {}),
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

// Memperbarui paket (plan), masa berlakunya, dan daftar modul aktif tenant.
//
// Riwayat (PRD 4.D.4): setiap perubahan paket menulis satu baris PlanChange —
// termasuk tanggal berakhir dan siapa yang mengubahnya. Barisnya ditulis dalam
// transaksi yang sama dengan perubahan tenant, supaya tidak pernah ada paket
// yang berubah tanpa jejak. Kalau nilainya sama persis dengan yang tersimpan
// (admin hanya menggeser modul), tidak ada baris baru: tabel ini riwayat paket,
// bukan log setiap kali tombol "Simpan" ditekan.
export async function updateTenantPlanAndModules(
  input: unknown,
): Promise<ActionResponse<{ tenantId: string }>> {
  const guard = await assertSuperAdmin();
  if (!guard.ok) return { success: false, message: guard.message };

  const parsed = updateTenantSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const { tenantId, plan, enabledModules, expiresAt, catatan } = parsed.data;

  // FREE tidak punya masa berlaku: tanggalnya hanya berarti selama PRO, dan
  // menurunkan paket tanpa menghapus tanggalnya akan menyisakan batas yang
  // tidak pernah ditegakkan siapa pun.
  const berakhir = paketBisaKedaluwarsa(plan)
    ? tanggalMasaBerlaku(expiresAt)
    : null;

  try {
    const sebelum = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true, planExpiresAt: true },
    });
    if (!sebelum) {
      return { success: false, message: "Tenant tidak ditemukan." };
    }

    const paketBerubah = riwayatPerluDitulis(
      { plan: sebelum.plan, planExpiresAt: sebelum.planExpiresAt ?? null },
      { plan, planExpiresAt: berakhir },
    );

    await prisma.$transaction([
      prisma.tenant.update({
        where: { id: tenantId },
        data: { plan, planExpiresAt: berakhir, enabledModules },
      }),
      ...(paketBerubah
        ? [
            prisma.planChange.create({
              data: {
                tenantId,
                dari: sebelum.plan,
                ke: plan,
                expiresAt: berakhir,
                olehUserId: guard.userId,
                catatan: catatan && catatan.length > 0 ? catatan : null,
              },
            }),
          ]
        : []),
    ]);

    revalidatePath("/admin");
    return {
      success: true,
      message: paketBerubah
        ? `Paket tenant berubah dari ${sebelum.plan} ke ${plan}${
            berakhir ? `, berlaku sampai ${formatTanggal(berakhir)}` : ""
          }.`
        : "Modul tenant berhasil diperbarui.",
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
