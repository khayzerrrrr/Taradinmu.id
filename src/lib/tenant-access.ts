import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/modules/core/auth";
import { getTenantRequestInfo, type TenantIndex } from "@/lib/tenant";
import {
  nilaiAksesTenant,
  PESAN_PERAN_OWNER,
  PESAN_PERAN_PENGGUNA,
  PESAN_PERAN_UMUM,
  TENANT_MANAGER_ROLES,
  TENANT_OWNER_ROLES,
  TENANT_USER_MANAGER_ROLES,
  type HasilIzinTenant,
} from "@/lib/tenant-rules";

// Infrastruktur akses tenant — dipakai modul mana pun lewat src/lib,
// sehingga modul tidak perlu saling mengimpor.
//
// Berkas ini hanya urusan I/O (membaca sesi, mengarahkan halaman). Aturan
// izinnya sendiri ada di `tenant-rules.ts` supaya bisa diuji tanpa Next.js.

export const getSessionUser = cache(async () => {
  const session = await auth();
  return session?.user ?? null;
});

// Untuk Server Action: kembalikan status, jangan redirect.
export async function assertTenantMember(
  tenantId: string,
): Promise<HasilIzinTenant> {
  return nilaiAksesTenant(
    await getSessionUser(),
    tenantId,
    TENANT_MANAGER_ROLES,
    PESAN_PERAN_UMUM,
  );
}

// Hanya OWNER (atau SUPER_ADMIN) — untuk pengaturan identitas/branding tenant.
export async function assertTenantOwner(
  tenantId: string,
): Promise<HasilIzinTenant> {
  return nilaiAksesTenant(
    await getSessionUser(),
    tenantId,
    TENANT_OWNER_ROLES,
    PESAN_PERAN_OWNER,
  );
}

// Hanya OWNER/ADMIN (atau SUPER_ADMIN) — untuk mengelola pengguna tenant.
export async function assertTenantUserManager(
  tenantId: string,
): Promise<HasilIzinTenant> {
  return nilaiAksesTenant(
    await getSessionUser(),
    tenantId,
    TENANT_USER_MANAGER_ROLES,
    PESAN_PERAN_PENGGUNA,
  );
}

// Untuk halaman: redirect bila belum masuk / bukan anggota tenant.
export async function requireTenantMember(tenant: TenantIndex) {
  const user = await getSessionUser();
  if (!user) redirect(await keLogin(tenant));
  const hasil = nilaiAksesTenant(
    user,
    tenant.id,
    TENANT_MANAGER_ROLES,
    PESAN_PERAN_UMUM,
  );
  if (!hasil.ok) redirect("/");
  return user;
}

// Untuk halaman pengaturan: hanya OWNER.
export async function requireTenantOwner(tenant: TenantIndex) {
  const user = await getSessionUser();
  if (!user) redirect(await keLogin(tenant));
  const hasil = nilaiAksesTenant(
    user,
    tenant.id,
    TENANT_OWNER_ROLES,
    PESAN_PERAN_OWNER,
  );
  if (!hasil.ok) redirect("/");
  return user;
}

// Untuk halaman pengguna: hanya OWNER/ADMIN.
export async function requireTenantUserManager(tenant: TenantIndex) {
  const user = await getSessionUser();
  if (!user) redirect(await keLogin(tenant));
  const hasil = nilaiAksesTenant(
    user,
    tenant.id,
    TENANT_USER_MANAGER_ROLES,
    PESAN_PERAN_PENGGUNA,
  );
  if (!hasil.ok) redirect("/");
  return user;
}

async function keLogin(tenant: TenantIndex): Promise<string> {
  const { path } = await getTenantRequestInfo();
  const callbackUrl = path && path.startsWith("/") ? path : `/${tenant.slug}`;
  return `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}
