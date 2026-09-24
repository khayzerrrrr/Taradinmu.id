"use server";

import { hash } from "bcryptjs";
import type { Prisma } from "@/generated/prisma/client";
import {
  isRecordNotFoundError,
  isUniqueConstraintError,
  pesanErrorUmum,
  pesanValidasi,
} from "@/lib/action";
import { checkLimit } from "@/lib/feature-guards";
import { catatPeringatan } from "@/lib/log";
import { prisma } from "@/lib/prisma";
import { getCurrentTenant } from "@/lib/tenant";
import { assertTenantUserManager } from "@/lib/tenant-access";
import { assertSuperAdmin } from "../auth/dal";
import { identifierReset } from "../auth/reset-token";
import {
  createUserSchema,
  deleteUserSchema,
  listUsersSchema,
  resetSandiAkunSchema,
  SEMUA_ROLE_LABELS,
  updateUserSchema,
} from "../schemas/user-schema";
import type { ActionResponse, UserListData, UserListItem } from "../types";

// Gerbang seragam untuk Server Action manajemen pengguna DI DALAM TENANT
// (bagian PLATFORM di ujung berkas ini punya gerbangnya sendiri):
// 1) konteks tenant (dari request, bukan dari input klien),
// 2) peran pengelola (OWNER/ADMIN atau SUPER_ADMIN),
// 3) identitas pemanggil (untuk mencegah menghapus/menurunkan diri sendiri).
type AksesPengguna =
  | { ok: true; tenantId: string; pemanggilId: string }
  | { ok: false; message: string };

async function aksesPengguna(): Promise<AksesPengguna> {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    return { ok: false, message: "Konteks tenant tidak ditemukan." };
  }
  const guard = await assertTenantUserManager(tenant.id);
  if (!guard.ok) {
    return { ok: false, message: guard.message };
  }
  return { ok: true, tenantId: tenant.id, pemanggilId: guard.userId };
}

// Akun pemilik dan akun platform tidak boleh disentuh dari daftar pengguna:
// menyentuhnya berarti berisiko mengunci pemilik keluar dari tokonya sendiri.
const PESAN_AKUN_ISTIMEWA = "Akun pemilik tidak dapat diubah dari halaman ini.";

type BarisUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
};

function keItem(user: BarisUser, pemanggilId: string): UserListItem {
  const role = user.role as UserListItem["role"];
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role,
    createdAt: user.createdAt.toISOString(),
    isSelf: user.id === pemanggilId,
    tidakDapatDiubah: role === "OWNER" || role === "SUPER_ADMIN",
  };
}

// ---------------------------------------------------------------------------
// BACA
// ---------------------------------------------------------------------------

export async function getUsers(
  input: unknown,
): Promise<ActionResponse<UserListData>> {
  const akses = await aksesPengguna();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = listUsersSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const { page, perPage, search } = parsed.data;
  const where: Prisma.UserWhereInput = {
    tenantId: akses.tenantId,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  try {
    const [total, users] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        // Pemilik dibuat lebih dulu saat provisioning, jadi urutan naik
        // menempatkannya di baris pertama daftar.
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * perPage,
        take: perPage,
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      }),
    ]);

    return {
      success: true,
      message: "Daftar pengguna berhasil dimuat.",
      data: {
        users: users.map((user) => keItem(user, akses.pemanggilId)),
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
      message: "Gagal memuat daftar pengguna.",
      error: pesanErrorUmum(error),
    };
  }
}

// ---------------------------------------------------------------------------
// TULIS
// ---------------------------------------------------------------------------

export async function createUser(
  input: unknown,
): Promise<ActionResponse<{ userId: string }>> {
  const akses = await aksesPengguna();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const { name, role, password } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  // Batas paket (PRD 4.D): FREE maksimum 1 pengguna, PRO tanpa batas.
  // Diperiksa di Server Action supaya tidak bisa dilewati dari klien.
  const kuota = await checkLimit(akses.tenantId, "USERS");
  if (!kuota.allowed) {
    return { success: false, message: kuota.message, code: "UPGRADE_REQUIRED" };
  }

  try {
    // Email unik secara GLOBAL, sehingga akun tenant lain pun menempati email ini.
    // Dicek lebih dulu agar pesannya jelas, bukan sekadar "gagal menyimpan".
    const sudahDipakai = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (sudahDipakai) {
      return { success: false, message: `Email ${email} sudah dipakai akun lain.` };
    }

    const passwordHash = await hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: passwordHash, role, tenantId: akses.tenantId },
      select: { id: true },
    });

    return {
      success: true,
      message: `Pengguna "${name}" berhasil ditambahkan.`,
      data: { userId: user.id },
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { success: false, message: `Email ${email} sudah dipakai akun lain.` };
    }
    return {
      success: false,
      message: "Gagal menambahkan pengguna.",
      error: pesanErrorUmum(error),
    };
  }
}

export async function updateUser(
  input: unknown,
): Promise<ActionResponse<{ userId: string }>> {
  const akses = await aksesPengguna();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const { userId, name, role, password } = parsed.data;

  try {
    // findFirst beserta tenantId: batas tenant ditegakkan di query, bukan dicek
    // setelah data terbaca, sehingga pengguna tenant lain tidak bisa disentuh.
    const target = await prisma.user.findFirst({
      where: { id: userId, tenantId: akses.tenantId },
      select: { id: true, role: true },
    });
    if (!target) return { success: false, message: "Pengguna tidak ditemukan." };

    if (target.role === "OWNER" || target.role === "SUPER_ADMIN") {
      return { success: false, message: PESAN_AKUN_ISTIMEWA };
    }
    if (target.id === akses.pemanggilId && target.role !== role) {
      return {
        success: false,
        message: "Anda tidak dapat mengubah role akun Anda sendiri.",
      };
    }

    const passwordBaru =
      password && password.length > 0 ? await hash(password, 10) : undefined;

    await prisma.user.update({
      where: { id: target.id },
      data: {
        name,
        role,
        ...(passwordBaru ? { password: passwordBaru } : {}),
      },
    });

    return {
      success: true,
      message: `Pengguna "${name}" berhasil diperbarui.`,
      data: { userId: target.id },
    };
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { success: false, message: "Pengguna tidak ditemukan." };
    }
    return {
      success: false,
      message: "Gagal memperbarui pengguna.",
      error: pesanErrorUmum(error),
    };
  }
}

export async function deleteUser(input: unknown): Promise<ActionResponse> {
  const akses = await aksesPengguna();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = deleteUserSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  try {
    const target = await prisma.user.findFirst({
      where: { id: parsed.data.userId, tenantId: akses.tenantId },
      select: { id: true, role: true, name: true },
    });
    if (!target) return { success: false, message: "Pengguna tidak ditemukan." };

    if (target.id === akses.pemanggilId) {
      return {
        success: false,
        message: "Anda tidak dapat menghapus akun Anda sendiri.",
      };
    }
    if (target.role === "OWNER" || target.role === "SUPER_ADMIN") {
      return { success: false, message: PESAN_AKUN_ISTIMEWA };
    }

    await prisma.user.delete({ where: { id: target.id } });

    return {
      success: true,
      message: `Pengguna "${target.name}" berhasil dihapus.`,
    };
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { success: false, message: "Pengguna tidak ditemukan." };
    }
    return {
      success: false,
      message: "Gagal menghapus pengguna.",
      error: pesanErrorUmum(error),
    };
  }
}

// ---------------------------------------------------------------------------
// PLATFORM — pemulihan akun yang terkunci (PRD 4.B)
// ---------------------------------------------------------------------------

// Sengaja TIDAK lewat aksesPengguna(): aksi ini berjalan lintas tenant dari
// konteks Super Admin, dan targetnya justru akun OWNER yang dilarang disentuh
// dari dalam tenant. Proteksi PESAN_AKUN_ISTIMEWA di atas tetap utuh — jalur
// khusus ini hanya terbuka bila pemanggilnya SUPER_ADMIN sejati.
//
// Batasan yang diterima: sesi JWT yang sedang aktif tidak ikut berakhir, jadi
// reset ini memulihkan akses tetapi tidak mengusir penyusup.
export async function resetKataSandiAkun(
  input: unknown,
): Promise<ActionResponse<{ userId: string }>> {
  const akses = await assertSuperAdmin();
  if (!akses.ok) return { success: false, message: akses.message };

  const parsed = resetSandiAkunSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: pesanValidasi(parsed.error) };
  }

  const email = parsed.data.email.toLowerCase();

  try {
    const target = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, role: true, tenantId: true },
    });
    if (!target) {
      // Jawaban spesifik, bukan netral seperti di /lupa-sandi: halamannya
      // sendiri sudah tertutup untuk publik, jadi menebak email tidak mungkin.
      return {
        success: false,
        message: `Akun dengan email ${email} tidak ditemukan.`,
      };
    }

    const passwordHash = await hash(parsed.data.password, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: target.id },
        data: { password: passwordHash },
      }),
      // Cabut tautan reset yang masih hidup milik target. Tanpa langkah ini,
      // siapa pun yang membuka email lama itu bisa menimpa sandi baru.
      prisma.verificationToken.deleteMany({
        where: { identifier: identifierReset(target.id) },
      }),
    ]);

    // Jejak audit: reset ini melewati bukti kepemilikan email, jadi "siapa
    // mereset akun siapa" harus tertinggal di log server.
    catatPeringatan("Kata sandi akun direset oleh Super Admin", {
      aksi: "resetKataSandiAkun",
      aktorId: akses.userId,
      targetId: target.id,
      tenantId: target.tenantId ?? undefined,
    });

    return {
      success: true,
      message: `Kata sandi akun "${target.name}" (${SEMUA_ROLE_LABELS[target.role]}) berhasil direset.`,
      data: { userId: target.id },
    };
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return { success: false, message: "Pengguna tidak ditemukan." };
    }
    return {
      success: false,
      message: "Gagal mereset kata sandi.",
      error: pesanErrorUmum(error),
    };
  }
}
