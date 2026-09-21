"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  HeartHandshake,
  LayoutDashboard,
  Menu,
  ReceiptText,
  type LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarPanel } from "@/components/layout/app-sidebar";
import { itemAktif, type NavSection, type ShellTenant } from "@/components/layout/nav";
import type { Branding } from "@/lib/branding";
import { cn } from "@/lib/utils";

type Props = {
  sections: NavSection[];
  tenant: ShellTenant;
  branding: Branding;
  basePath: string;
};

type Tujuan = {
  href: string;
  label: string;
  exact?: boolean;
  Ikon: LucideIcon;
};

/**
 * Navigasi bawah untuk layar HP. Menampilkan tujuan utama (maks. 4 agar tidak
 * sesak), sedangkan menu lengkap dibuka lewat "Lainnya" memakai panel yang sama
 * dengan sidebar desktop.
 */
export function BottomNav({ sections, tenant, branding, basePath }: Props) {
  const pathname = usePathname();
  const [navTerbuka, setNavTerbuka] = useState(false);

  const tujuan: Tujuan[] = [
    {
      href: `${basePath}/dashboard`,
      label: "Dashboard",
      exact: true,
      Ikon: LayoutDashboard,
    },
    {
      href: `${basePath}/dashboard/inventory`,
      label: "Produk",
      Ikon: Boxes,
    },
    {
      href: `${basePath}/dashboard/billing`,
      label: "Invoice",
      Ikon: ReceiptText,
    },
    {
      href: `${basePath}/dashboard/zakat`,
      label: "Zakat",
      Ikon: HeartHandshake,
    },
  ];

  return (
    <nav
      aria-label="Navigasi utama (bawah)"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {tujuan.map(({ Ikon, ...item }) => {
          const aktif = itemAktif(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={aktif ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  aktif
                    ? "text-primary-solid"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Ikon aria-hidden="true" className="size-5 shrink-0" />
                <span className="text-2xs">{item.label}</span>
              </Link>
            </li>
          );
        })}

        <li>
          <Sheet open={navTerbuka} onOpenChange={setNavTerbuka}>
            <SheetTrigger asChild>
              <button
                type="button"
                aria-label="Buka menu lainnya"
                className="flex h-14 w-full flex-col items-center justify-center gap-1 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Menu aria-hidden="true" className="size-5 shrink-0" />
                <span className="text-2xs">Lainnya</span>
              </button>
            </SheetTrigger>
            <SheetContent
              side="left"
              showCloseButton={false}
              className="w-[17.5rem] gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Navigasi</SheetTitle>
              </SheetHeader>
              <SidebarPanel
                sections={sections}
                tenant={tenant}
                branding={branding}
                basePath={basePath}
                onNavigate={() => setNavTerbuka(false)}
              />
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
