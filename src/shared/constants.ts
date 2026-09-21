// Konstanta lintas modul (PRD Bagian 2: src/shared/ untuk types, constants, enums).
// File ini sengaja TANPA dependensi server agar aman diimpor client maupun server.

// Slug yang dipakai sistem. Tenant tidak boleh memakai slug ini karena akan
// menabrak route aplikasi (mis. /admin, /login).
export const RESERVED_SLUGS = [
  "admin",
  "login",
  "logout",
  "api",
  "_next",
  "favicon.ico",
  "www",
  "app",
  "public",
  "static",
  "assets",
  "robots.txt",
  "sitemap.xml",
  "manifest.webmanifest",
] as const;

export function isReservedSlug(value: string): boolean {
  return (RESERVED_SLUGS as readonly string[]).includes(value.trim().toLowerCase());
}

// Warna utama default TaradinMu (PRD Bagian 5).
export const DEFAULT_PRIMARY_COLOR = "#059669";
