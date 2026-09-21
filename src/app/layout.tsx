import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BRAND_COLORS } from "@/components/brand/logo";
import { ROOT_DOMAIN } from "@/lib/tenant";
import "./globals.css";

// PRD Bagian 5: tipografi Inter — satu keluarga huruf untuk seluruh aplikasi.
// Variabel diberi nama --font-inter (bukan --font-sans) supaya globals.css bisa
// memetakannya ke --font-sans tanpa referensi melingkar ke dirinya sendiri.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  // Basis URL absolut untuk gambar Open Graph/Twitter (hanya produksi; dev memakai localhost).
  metadataBase:
    process.env.NODE_ENV === "production" ? new URL(`https://${ROOT_DOMAIN}`) : undefined,
  applicationName: "TaradinMu",
  title: "TaradinMu",
  description:
    "SaaS niaga syariah untuk UMKM Muhammadiyah: inventory, billing, dan laporan usaha.",
};

export const viewport: Viewport = {
  themeColor: BRAND_COLORS.forest,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${inter.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#konten-utama"
          className="sr-only rounded-md bg-background px-4 py-2 text-sm font-medium text-foreground shadow-raised ring-1 ring-border focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
        >
          Lompat ke konten utama
        </a>
        {/* Provider tooltip dipasang sekali di akar agar ikon aksi di Topbar
            dan tabel tidak perlu memasangnya masing-masing. */}
        <TooltipProvider delayDuration={300}>
          {children}
          <Toaster richColors position="top-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}
