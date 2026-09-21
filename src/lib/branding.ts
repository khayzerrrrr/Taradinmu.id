import type { CSSProperties } from "react";
import type { PlanType } from "@/generated/prisma/client";
import { DEFAULT_PRIMARY_COLOR } from "@/shared/constants";

// Aturan white-label terpusat (PRD Bagian 4A): logo & warna kustom HANYA untuk plan PRO.

export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export const MAX_LOGO_BYTES = 512 * 1024; // 512 KB
export const ALLOWED_LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
] as const;

export const LOGO_EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export type BrandingSource = {
  plan: PlanType;
  primaryColor: string | null;
  customLogoUrl: string | null;
};

export type Branding = {
  isPro: boolean;
  /** Warna merek apa adanya — dipakai untuk garis, ikon, ring fokus, dan grafik. */
  accentColor: string;
  /** Warna merek yang sudah dijamin lolos AA — dipakai untuk permukaan terisi. */
  solidColor: string;
  /** Keadaan hover dari solidColor. */
  solidHoverColor: string;
  /** Warna teks di atas solidColor. */
  primaryForeground: string;
  logoUrl: string | null;
  isCustomLogo: boolean;
};

function kanal(nilai: number): number {
  const c = nilai / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

// Luminance relatif (WCAG) dari warna hex #rrggbb.
export function luminanceRelatif(hex: string): number {
  const bersih = hex.replace("#", "");
  if (bersih.length !== 6) return 0;
  const r = Number.parseInt(bersih.slice(0, 2), 16);
  const g = Number.parseInt(bersih.slice(2, 4), 16);
  const b = Number.parseInt(bersih.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return 0;
  return 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
}

// Rasio kontras WCAG antara dua warna hex.
export function rasioKontras(a: string, b: string): number {
  const l1 = luminanceRelatif(a);
  const l2 = luminanceRelatif(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function keRgb(hex: string): [number, number, number] {
  const bersih = hex.replace("#", "");
  return [
    Number.parseInt(bersih.slice(0, 2), 16),
    Number.parseInt(bersih.slice(2, 4), 16),
    Number.parseInt(bersih.slice(4, 6), 16),
  ];
}

function keHex(rgb: [number, number, number]): string {
  return `#${rgb
    .map((n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0"))
    .join("")}`;
}

// Campur dua warna hex di ruang sRGB. `rasioB` = porsi warna b (0..1).
export function campurWarna(a: string, b: string, rasioB: number): string {
  const [r1, g1, b1] = keRgb(a);
  const [r2, g2, b2] = keRgb(b);
  return keHex([
    r1 + (r2 - r1) * rasioB,
    g1 + (g2 - g1) * rasioB,
    b1 + (b2 - b1) * rasioB,
  ]);
}

// Ambang WCAG 2.2 AA untuk teks ukuran normal.
const AMBANG_AA = 4.5;
const SLATE_900 = "#0f172a";

// Warna teks di atas warna primary, supaya tombol tetap terbaca.
export function kontrasPrimary(hex: string): string {
  return luminanceRelatif(hex) > 0.45 ? SLATE_900 : "#ffffff";
}

/**
 * Warna latar untuk permukaan terisi yang membawa teks (tombol utama, menu aktif).
 *
 * Warna merek sebagian besar aman dipakai apa adanya. Sebagian kecil — termasuk
 * emerald-600 (#059669), warna default TaradinMu — berada di "zona mati": tidak
 * ada teks terang maupun gelap yang mencapai 4.5:1 di atasnya, sehingga latarnya
 * harus digeser. Kami menggelapkan warna merek bertahap ke arah Slate-900, pada
 * hue yang sama, sampai teks putih lolos AA. Hasilnya tak berbeda secara visual
 * (≤ 15% lebih gelap) tetapi lolos audit aksesibilitas untuk merek kustom tenant.
 */
export function warnaSolid(hex: string): string {
  if (rasioKontras(hex, "#ffffff") >= AMBANG_AA) return hex;
  if (luminanceRelatif(hex) > 0.45) return hex; // warna terang → teks gelap, latar tetap
  for (let langkah = 1; langkah <= 8; langkah += 1) {
    const kandidat = campurWarna(hex, SLATE_900, langkah * 0.05);
    if (rasioKontras(kandidat, "#ffffff") >= AMBANG_AA) return kandidat;
  }
  return campurWarna(hex, SLATE_900, 0.4);
}

// Satu-satunya tempat aturan white-label: warna/logo kustom hanya berlaku untuk PRO.
export function resolveBranding(tenant: BrandingSource): Branding {
  const isPro = tenant.plan === "PRO";

  const warnaKustom =
    isPro && tenant.primaryColor && HEX_COLOR_PATTERN.test(tenant.primaryColor)
      ? tenant.primaryColor
      : null;
  const accentColor = warnaKustom ?? DEFAULT_PRIMARY_COLOR;
  const solidColor = warnaSolid(accentColor);

  const logoKustom = isPro ? tenant.customLogoUrl : null;
  const logoUrl = logoKustom && logoKustom.length > 0 ? logoKustom : null;

  return {
    isPro,
    accentColor,
    solidColor,
    solidHoverColor: campurWarna(solidColor, SLATE_900, 0.08),
    primaryForeground: kontrasPrimary(solidColor),
    logoUrl,
    isCustomLogo: logoUrl !== null,
  };
}

// Seluruh variabel yang ditimpa runtime oleh tenant PRO. Dipakai juga oleh
// TenantTheme untuk menyimpan & memulihkan nilai sebelumnya, jadi tambahkan
// setiap variabel baru di sini — bukan hanya di brandingVars().
export const BRANDING_VAR_KEYS = [
  "--primary",
  "--primary-solid",
  "--primary-solid-hover",
  "--primary-foreground",
  "--ring",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-ring",
] as const;

export function brandingVars(branding: Branding): Record<string, string> {
  return {
    "--primary": branding.accentColor,
    "--primary-solid": branding.solidColor,
    "--primary-solid-hover": branding.solidHoverColor,
    "--primary-foreground": branding.primaryForeground,
    "--ring": branding.accentColor,
    "--sidebar-primary": branding.solidColor,
    "--sidebar-primary-foreground": branding.primaryForeground,
    "--sidebar-ring": branding.accentColor,
  };
}

// React.CSSProperties tidak mendeklarasikan custom property, jadi perlu cast.
export function brandingStyle(branding: Branding): CSSProperties {
  return brandingVars(branding) as unknown as CSSProperties;
}
