import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@/generated/prisma/client";
import { auth } from "@/modules/core/auth";
import { getTenantRequestInfo, type TenantIndex } from "@/lib/tenant";

// Infrastruktur akses tenant — dipakai modul mana pun lewat src/lib,
// sehingga modul tidak perlu saling mengimpor.

// Role tenant yang boleh mengelola data (SUPER_ADMIN selalu boleh).
const TENANT_MANAGER_ROLES: readonly Role[] = ["OWNER", "ADMIN", "STAFF"];
// Role yang boleh mengubah identitas/branding tenant.
const TENANT_OWNER_ROLES: readonly Role[] = ["OWNER"];
// Role yang boleh mengelola pengguna tenant (PRD Bagian 4.D: PRO dapat menambah
// Admin, Staff, dan Akuntan; yang boleh mengundang adalah OWNER dan ADMIN).
const TENANT_USER_MANAGER_ROLES: readonly Role[] = ["OWNER", "ADMIN"];

export const getSessionUser = cache(async () => {
  const session = await auth();
  return session?.user ?? null;
});

export type TenantGuardResult =
  | { ok: true; userId: string }
  | { ok: false; message: string };

// Untuk Server Action: kembalikan status, jangan redirect.
export async function assertTenantMember(
  tenantId: string,
): Promise<TenantGuardResult> {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, message: "Sesi tidak ditemukan. Silakan masuk terlebih dahulu." };
  }
  if (user.role === "SUPER_ADMIN") return { ok: true, userId: user.id };
  if (user.tenantId !== tenantId) {
    return { ok: false, message: "Akses ditolak. Anda bukan anggota tenant ini." };
  }
  if (!TENANT_MANAGER_ROLES.includes(user.role)) {
    return { ok: false, message: "Akses ditolak. Role Anda tidak diizinkan." };
  }
  return { ok: true, userId: user.id };
}

// Hanya OWNER (atau SUPER_ADMIN) — untuk pengaturan identitas/branding tenant.
export async function assertTenantOwner(
  tenantId: string,
): Promise<TenantGuardResult> {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, message: "Sesi tidak ditemukan. Silakan masuk terlebih dahulu." };
  }
  if (user.role === "SUPER_ADMIN") return { ok: true, userId: user.id };
  if (user.tenantId !== tenantId) {
    return { ok: false, message: "Akses ditolak. Anda bukan anggota tenant ini." };
  }
  if (!TENANT_OWNER_ROLES.includes(user.role)) {
    return { ok: false, message: "Akses ditolak. Hanya pemilik (OWNER) yang boleh mengubah pengaturan toko." };
  }
  return { ok: true, userId: user.id };
}

// Hanya OWNER/ADMIN (atau SUPER_ADMIN) — untuk mengelola pengguna tenant.
export async function assertTenantUserManager(
  tenantId: string,
): Promise<TenantGuardResult> {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, message: "Sesi tidak ditemukan. Silakan masuk terlebih dahulu." };
  }
  if (user.role === "SUPER_ADMIN") return { ok: true, userId: user.id };
  if (user.tenantId !== tenantId) {
    return { ok: false, message: "Akses ditolak. Anda bukan anggota tenant ini." };
  }
  if (!TENANT_USER_MANAGER_ROLES.includes(user.role)) {
    return {
      ok: false,
      message: "Akses ditolak. Hanya pemilik atau admin yang boleh mengelola pengguna.",
    };
  }
  return { ok: true, userId: user.id };
}

// Untuk halaman: redirect bila belum masuk / bukan anggota tenant.
export async function requireTenantMember(tenant: TenantIndex) {
  const user = await getSessionUser();
  if (!user) redirect(await keLogin(tenant));
  if (user.role === "SUPER_ADMIN") return user;
  if (user.tenantId !== tenant.id) redirect("/");
  if (!TENANT_MANAGER_ROLES.includes(user.role)) redirect("/");
  return user;
}

// Untuk halaman pengaturan: hanya OWNER.
export async function requireTenantOwner(tenant: TenantIndex) {
  const user = await getSessionUser();
  if (!user) redirect(await keLogin(tenant));
  if (user.role === "SUPER_ADMIN") return user;
  if (user.tenantId !== tenant.id) redirect("/");
  if (!TENANT_OWNER_ROLES.includes(user.role)) redirect("/");
  return user;
}

// Untuk halaman pengguna: hanya OWNER/ADMIN.
export async function requireTenantUserManager(tenant: TenantIndex) {
  const user = await getSessionUser();
  if (!user) redirect(await keLogin(tenant));
  if (user.role === "SUPER_ADMIN") return user;
  if (user.tenantId !== tenant.id) redirect("/");
  if (!TENANT_USER_MANAGER_ROLES.includes(user.role)) redirect("/");
  return user;
}

async function keLogin(tenant: TenantIndex): Promise<string> {
  const { path } = await getTenantRequestInfo();
  const callbackUrl = path && path.startsWith("/") ? path : `/${tenant.slug}`;
  return `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}
