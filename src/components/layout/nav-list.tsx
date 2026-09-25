"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Building2,
  FolderKanban,
  HeartHandshake,
  LayoutDashboard,
  Lock,
  Package,
  ReceiptText,
  Store,
  Truck,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";import { cn } from "@/lib/utils";
import { UpgradeModal } from "@/components/shared/upgrade-modal";
import type { NavIcon, NavItem, NavSection } from "@/components/layout/nav";
import { itemAktif } from "@/components/layout/nav";

const IKON: Record<NavIcon, LucideIcon> = {
  dashboard: LayoutDashboard,
  products: Package,
  stock: Boxes,
  stockIn: ArrowDownToLine,
  stockOut: ArrowUpFromLine,
  suppliers: Truck,
  customers: Users,
  invoices: ReceiptText,
  expenses: Wallet,
  zakat: HeartHandshake,
  programs: FolderKanban,
  settings: Store,
  users: UserCog,
  tenants: Building2,
};

// Gaya baris aktif: permukaan terisi merek. `--sidebar-primary` sudah dijamin
// lolos kontras AA oleh src/lib/branding.ts, termasuk untuk warna kustom tenant.
const BARIS_DASAR =
  "group flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring";

function Baris({ item, aktif, onNavigate }: {
  item: NavItem;
  aktif: boolean;
  onNavigate?: () => void;
}) {
  const Ikon = item.icon ? IKON[item.icon] : null;

  const isi = (
    <>
      {Ikon ? (
        <Ikon
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0",
            aktif ? "opacity-100" : "opacity-55 group-hover:opacity-80",
          )}
        />
      ) : null}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge ? (
        <span className="shrink-0 rounded-sm bg-brand-accent/20 px-1.5 py-0.5 text-2xs font-semibold text-brand-accent">
          {item.badge}
        </span>
      ) : null}
      {item.terkunci ? (
        <Lock aria-hidden="true" className="size-3.5 shrink-0 opacity-45" />
      ) : null}
    </>
  );

  // Modul yang belum aktif tetap bisa diklik: halamannya sendiri menjelaskan cara
  // mengaktifkan. Baris mati hanya membuat pengguna bingung.
  const kelasBaris = cn(
    BARIS_DASAR,
    aktif
      ? "bg-sidebar-primary font-medium text-sidebar-primary-foreground"
      : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    item.terkunci && !aktif && "text-sidebar-foreground/45",
  );

  const tautan = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={aktif ? "page" : undefined}
      title={item.terkunci ? `${item.label} belum termasuk paket langganan Anda` : undefined}
      className={cn(kelasBaris, item.kunciPro && "flex-1")}
    >
      {isi}
    </Link>
  );

  if (!item.kunciPro) return tautan;

  // Fitur PRO pada paket FREE: gembok kecil di sisi kanan membuka modal upgrade.
  return (
    <div className="flex items-center gap-1">
      {tautan}
      <UpgradeModal fitur={item.label} kunci={item.kunciPro}>
        <button
          type="button"
          aria-label={`${item.label} — fitur PRO, buka opsi upgrade`}
          className="flex size-6 shrink-0 items-center justify-center rounded-sm text-sidebar-foreground/50 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <Lock aria-hidden="true" className="size-3.5" />
        </button>
      </UpgradeModal>
    </div>
  );
}

/**
 * Daftar navigasi sidebar. Dipakai bersama oleh sidebar desktop dan lembar
 * navigasi mobile, sehingga keduanya tidak mungkin menyimpang satu sama lain.
 */
export function NavList({
  sections,
  onNavigate,
}: {
  sections: NavSection[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-5" aria-label="Navigasi utama">
      {sections.map((section) => (
        <div key={section.judul ?? "utama"} className="flex flex-col gap-1">
          {section.judul ? (
            <h2 className="px-2.5 pb-1 text-2xs font-medium tracking-wide text-sidebar-foreground/40 uppercase">
              {section.judul}
            </h2>
          ) : null}

          {section.items.map((item) => (
            <Baris
              key={item.href}
              item={item}
              aktif={itemAktif(pathname, item)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}
