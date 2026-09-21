"use client";

import Link from "next/link";
import { TenantLogo } from "@/components/brand/tenant-logo";
import { NavList } from "@/components/layout/nav-list";
import type { NavSection, ShellTenant } from "@/components/layout/nav";
import type { Branding } from "@/lib/branding";
import { cn } from "@/lib/utils";

type PanelProps = {
  sections: NavSection[];
  tenant: ShellTenant;
  branding: Branding;
  basePath: string;
  onNavigate?: () => void;
};

/**
 * Isi sidebar. Dipakai bersama oleh kolom tetap di desktop dan lembar navigasi
 * di mobile, sehingga kedua permukaan itu tidak mungkin menyimpang.
 */
export function SidebarPanel({
  sections,
  tenant,
  branding,
  basePath,
  onNavigate,
}: PanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-topbar shrink-0 items-center border-b border-sidebar-border px-4">
        <Link
          href={`${basePath}/dashboard`}
          onClick={onNavigate}
          className="flex min-w-0 items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          aria-label={`${tenant.name} — buka Dashboard`}
        >
          <TenantLogo
            branding={branding}
            tenantName={tenant.name}
            variant="horizontal"
            tone="dark"
            className="h-7 w-auto"
          />
        </Link>
      </div>

      <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <NavList sections={sections} onNavigate={onNavigate} />
      </div>

      <div className="shrink-0 border-t border-sidebar-border p-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-xs font-medium">
              {tenant.name}
            </span>
            <span className="truncate text-2xs text-sidebar-foreground/50">
              {tenant.host}
            </span>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-2xs font-semibold",
              tenant.isPro
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "bg-sidebar-accent text-sidebar-foreground/70",
            )}
          >
            {tenant.plan}
          </span>
        </div>

        {tenant.isPro ? null : (
          <Link
            href={`${basePath}/dashboard/settings`}
            onClick={onNavigate}
            className="mt-2 block rounded-md px-1 py-1 text-2xs text-sidebar-foreground/55 underline-offset-4 transition-colors hover:text-sidebar-foreground hover:underline"
          >
            Aktifkan PRO untuk membuka semua modul
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * Kolom sidebar desktop. `self-start` + `h-svh` diperlukan agar elemen ini
 * benar-benar dapat "menempel" saat halaman digulir: tanpa itu flexbox akan
 * meregangkannya setinggi konten dan `sticky` kehilangan ruang gerak.
 */
export function AppSidebar(props: PanelProps) {
  return (
    <aside className="sticky top-0 hidden h-svh w-sidebar shrink-0 self-start md:block">
      <SidebarPanel {...props} />
    </aside>
  );
}
