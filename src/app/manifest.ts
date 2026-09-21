import type { MetadataRoute } from "next";
import { BRAND_COLORS } from "@/components/brand/logo";

// Manifest PWA. Ikon dibuat oleh `npm run brand:build` (public/icons).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TaradinMu",
    short_name: "TaradinMu",
    description:
      "SaaS niaga syariah untuk UMKM Muhammadiyah: inventory, billing, dan laporan usaha.",
    lang: "id",
    start_url: "/",
    display: "standalone",
    background_color: BRAND_COLORS.paper,
    theme_color: BRAND_COLORS.forest,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
