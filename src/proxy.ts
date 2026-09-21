import { NextResponse, type NextRequest } from "next/server";
import { TENANT_HEADERS, parseTenantFromRequest } from "@/lib/tenant";

// Di Next.js 16, `middleware.ts` digantikan oleh `proxy.ts` (runtime Node).
// Gerbang di sini bersifat optimistis (UX): otorisasi sebenarnya tetap ada di
// DAL (src/modules/core/auth/dal.ts) dan di setiap Server Action.

// Nama cookie sesi Auth.js v5: `__Secure-` dipakai saat HTTPS/produksi.
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
] as const;

function punyaSesi(request: NextRequest): boolean {
  return SESSION_COOKIES.some((nama) => request.cookies.has(nama));
}

// Arahkan ke /login sambil membawa tujuan semula sebagai callbackUrl.
function keLogin(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const url = new URL("/login", request.url);
  url.searchParams.set("callbackUrl", `${pathname}${search}`);
  return NextResponse.redirect(url);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Selalu buang header tenant yang datang dari client (anti-spoofing),
  // lalu tulis ulang hanya bila kita sendiri yang mendeteksi tenant.
  const headers = new Headers(request.headers);
  headers.delete(TENANT_HEADERS.slug);
  headers.delete(TENANT_HEADERS.mode);
  headers.delete(TENANT_HEADERS.rest);
  headers.delete(TENANT_HEADERS.path);
  headers.set(TENANT_HEADERS.path, pathname);

  const parsed = parseTenantFromRequest(request);
  const rest = parsed?.rest ?? "";

  // --- 1. Gerbang optimistis area /admin dan /dashboard.
  // Dashboard tenant tersedia dalam dua bentuk: /<slug>/dashboard (mode path)
  // dan /dashboard saat diakses lewat subdomain (mode subdomain).
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  const isDashboardArea =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    rest === "/dashboard" ||
    rest.startsWith("/dashboard/");

  if ((isAdminArea || isDashboardArea) && !punyaSesi(request)) {
    return keLogin(request);
  }

  if (isAdminArea) {
    return NextResponse.next({ request: { headers } });
  }

  // --- 2. Deteksi tenant (subdomain atau segmen pertama path).
  if (!parsed) {
    return NextResponse.next({ request: { headers } });
  }

  headers.set(TENANT_HEADERS.slug, parsed.slug);
  headers.set(TENANT_HEADERS.mode, parsed.mode);
  if (parsed.rest) headers.set(TENANT_HEADERS.rest, parsed.rest);

  // --- 3. Subdomain di-rewrite menjadi bentuk path agar cocok dengan (tenant)/[tenantSlug].
  //     URL yang dilihat user tidak berubah.
  if (parsed.mode === "subdomain") {
    const target = `/${parsed.slug}${parsed.rest}`;
    return NextResponse.rewrite(new URL(target, request.url), {
      request: { headers },
    });
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Jalankan untuk semua path kecuali aset/API. `/login` & `/admin` tetap
  // dievaluasi di dalam proxy (lihat reserved slug + gerbang admin).
  // Berkas ber-ekstensi (logo, ikon, manifest) dan gambar sosial dikecualikan agar
  // tidak di-rewrite ke rute tenant saat diakses lewat subdomain.
  matcher: ["/((?!api|_next/static|_next/image|opengraph-image|twitter-image|.*\\..*).*)"],
};
