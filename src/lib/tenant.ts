import { cache } from "react";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import type { BusinessType, PlanType } from "@/generated/prisma/client";
import { isReservedSlug } from "@/shared/constants";

// ---------------------------------------------------------------------------
// Bagian 1: MURNI (tanpa DB) — dipakai oleh proxy.ts.
// Proxy sengaja tidak menyentuh database; ia hanya menyuntikkan "identifier"
// tenant lewat request header, lalu lapisan layout yang mengambil dari DB.
// ---------------------------------------------------------------------------

export const TENANT_HEADERS = {
  slug: "x-tenant-slug",
  mode: "x-tenant-mode",
  rest: "x-tenant-rest",
  /** Pathname asli yang diminta user (sebelum rewrite) — dipakai untuk callbackUrl login. */
  path: "x-tenant-path",
} as const;

export type TenantMode = "path" | "subdomain";

// Domain induk untuk deteksi subdomain (mis. "taradinmu.id" -> "toko.taradinmu.id").
export const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? "taradinmu.id";

export type ParsedTenant = {
  slug: string;
  mode: TenantMode;
  /** Sisa path setelah slug, diawali "/" ("" bila tidak ada). Dipakai untuk redirect PRO. */
  rest: string;
};

export type TenantIndex = {
  id: string;
  name: string;
  slug: string;
  subdomain: string | null;
  plan: PlanType;
  businessType: BusinessType;
  enabledModules: string[];
  primaryColor: string | null;
  customLogoUrl: string | null;
};

export type TenantContext = TenantIndex & { isPro: boolean };

const EXTENSION_PATTERN = /\.[a-z0-9]+$/i;

function hostnameFromHost(host: string): string {
  return host.split(":")[0].trim().toLowerCase();
}

// Ambil label subdomain dari host, atau null bila tidak ada / host kosong.
// Mendukung produksi (toko.taradinmu.id) dan dev (toko.localhost).
export function extractSubdomain(host: string): string | null {
  const hostname = hostnameFromHost(host);
  if (!hostname || hostname === "localhost") return null;

  if (hostname.endsWith(".localhost")) {
    const sub = hostname.slice(0, -".localhost".length);
    return sub && sub !== "www" ? sub : null;
  }

  const suffix = `.${ROOT_DOMAIN}`;
  if (hostname.endsWith(suffix)) {
    const sub = hostname.slice(0, -suffix.length);
    if (!sub || sub.includes(".")) return null;
    return sub === "www" ? null : sub;
  }

  return null;
}

// Tentukan tenant dari sebuah request: lewat subdomain atau segmen pertama path.
export function parseTenantFromRequest(request: NextRequest): ParsedTenant | null {
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const subdomain = extractSubdomain(host);
  const pathname = request.nextUrl.pathname;

  if (subdomain && !isReservedSlug(subdomain)) {
    return {
      slug: subdomain,
      mode: "subdomain",
      rest: pathname === "/" ? "" : pathname,
    };
  }

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const first = segments[0];
  if (isReservedSlug(first) || EXTENSION_PATTERN.test(first)) return null;

  const rest = segments.length > 1 ? `/${segments.slice(1).join("/")}` : "";
  return { slug: first, mode: "path", rest };
}

export function buildTenantSubdomainUrl(
  subdomain: string,
  rest?: string | null,
  protocol: "http" | "https" = "https",
): string {
  const suffix = rest && rest !== "/" ? rest : "";
  return `${protocol}://${subdomain}.${ROOT_DOMAIN}${suffix}`;
}

// ---------------------------------------------------------------------------
// Bagian 2: AKSES DATABASE.
// `prisma` diimpor secara dinamis supaya bundel proxy.ts tidak ikut memuat
// Prisma/pg (proxy dipanggil untuk hampir semua request).
// ---------------------------------------------------------------------------

const tenantSelect = {
  id: true,
  name: true,
  slug: true,
  subdomain: true,
  plan: true,
  businessType: true,
  enabledModules: true,
  primaryColor: true,
  customLogoUrl: true,
} as const;

async function getPrisma() {
  const { prisma } = await import("@/lib/prisma");
  return prisma;
}

export async function getTenantBySlug(slug: string): Promise<TenantIndex | null> {
  const prisma = await getPrisma();
  return prisma.tenant.findUnique({ where: { slug }, select: tenantSelect });
}

export async function getTenantBySubdomain(
  subdomain: string,
): Promise<TenantIndex | null> {
  const prisma = await getPrisma();
  return prisma.tenant.findUnique({ where: { subdomain }, select: tenantSelect });
}

// ---------------------------------------------------------------------------
// Bagian 3: REQUEST CONTEXT untuk Server Components & Server Actions.
// `cache` membuat hasilnya hanya dihitung sekali per request, sehingga layout,
// halaman, dan action berbagi data tenant yang sama tanpa query berulang.
// ---------------------------------------------------------------------------

export const getTenantRequestInfo = cache(async () => {
  const headerList = await headers();
  return {
    slug: headerList.get(TENANT_HEADERS.slug),
    mode: headerList.get(TENANT_HEADERS.mode) as TenantMode | null,
    rest: headerList.get(TENANT_HEADERS.rest),
    path: headerList.get(TENANT_HEADERS.path),
  };
});

export const getCurrentTenant = cache(async (): Promise<TenantContext | null> => {
  const { slug } = await getTenantRequestInfo();
  if (!slug) return null;

  const tenant = await getTenantBySlug(slug);
  if (!tenant) return null;

  return { ...tenant, isPro: tenant.plan === "PRO" };
});
