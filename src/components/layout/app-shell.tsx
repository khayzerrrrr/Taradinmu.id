import type { ReactNode } from "react";
import { TenantTheme } from "@/components/brand/tenant-theme";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { BottomNav } from "@/components/layout/bottom-nav";
import type { NavSection, ShellTenant, ShellUser } from "@/components/layout/nav";
import type { Branding } from "@/lib/branding";
import { brandingStyle } from "@/lib/branding";

type Props = {
  sections: NavSection[];
  tenant: ShellTenant;
  branding: Branding;
  user: ShellUser;
  basePath: string;
  logoutAction: () => Promise<void>;
  children: ReactNode;
};

/**
 * Kerangka area terautentikasi: sidebar tetap (desktop) / navigasi bawah (HP),
 * bilah atas, dan kanvas konten.
 *
 * Lebar konten dibatasi 1400px — cukup untuk tabel banyak kolom, tetapi tetap
 * menjaga panjang baris teks pada halaman seperti Pengaturan agar tidak melebar
 * sampai sulit dibaca di monitor ultrawide.
 */
export function AppShell({
  sections,
  tenant,
  branding,
  user,
  basePath,
  logoutAction,
  children,
}: Props) {
  return (
    <div className="flex min-h-svh bg-background" style={brandingStyle(branding)}>
      {/* Radix mem-portal Dialog/Select ke body, di luar subtree ini. */}
      <TenantTheme branding={branding} />

      <AppSidebar
        sections={sections}
        tenant={tenant}
        branding={branding}
        basePath={basePath}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar user={user} basePath={basePath} logoutAction={logoutAction} />

        <main id="konten-utama" className="flex-1">
          {/* pb-24 di HP memberi ruang untuk BottomNav (h-14 + safe area). */}
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 pb-24 md:px-6 md:py-8 md:pb-8">
            {children}
          </div>
        </main>
      </div>

      <BottomNav
        sections={sections}
        tenant={tenant}
        branding={branding}
        basePath={basePath}
      />
    </div>
  );
}
