import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import type { NavItem, NavSection } from "@/components/layout/nav";
import { resolveBranding } from "@/lib/branding";
import {
  buildTenantSubdomainUrl,
  getCurrentTenant,
  getTenantRequestInfo,
  ROOT_DOMAIN,
  type TenantMode,
} from "@/lib/tenant";
import { getSessionUser } from "@/lib/tenant-access";
import { logoutAction } from "@/modules/core/actions/auth-actions";
import { isModuleEnabled } from "@/shared/modules";

// Layout area tenant: sidebar + bilah atas + kanvas konten.
// Route group tidak menyumbang segmen URL, sehingga tipe layout ini adalah "/".
export default async function TenantLayout({ children }: LayoutProps<"/">) {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  const info = await getTenantRequestInfo();
  const modus: TenantMode = info.mode ?? "path";

  // Fitur PRO (subdomain). Bila tenant PRO diakses lewat path, arahkan ke subdomain.
  if (modus === "path" && tenant.isPro && tenant.subdomain) {
    redirect(buildTenantSubdomainUrl(tenant.subdomain, info.rest));
  }

  // White-label: warna & logo kustom hanya berlaku untuk PRO (fallback ke default TaradinMu).
  const branding = resolveBranding(tenant);

  // Basis URL mengikuti mode: subdomain memakai akar domain, path memakai /<slug>.
  const basePath = modus === "subdomain" ? "" : `/${tenant.slug}`;
  const inventoryAktif = isModuleEnabled(tenant.enabledModules, "INVENTORY");
  const billingAktif = isModuleEnabled(tenant.enabledModules, "BILLING");
  const accountingAktif = isModuleEnabled(tenant.enabledModules, "ACCOUNTING");

  // Modul yang belum aktif tetap ditampilkan (dengan penanda gembok) agar
  // pengguna tahu fitur itu ada — halamannya menjelaskan cara mengaktifkan.
  const tandai = (items: NavItem[], aktif: boolean): NavItem[] =>
    aktif ? items : items.map((item) => ({ ...item, terkunci: true }));

  const sections: NavSection[] = [
    {
      items: [
        {
          href: `${basePath}/dashboard`,
          label: "Dashboard",
          exact: true,
          icon: "dashboard",
        },
      ],
    },
    {
      judul: "Inventory",
      items: tandai(
        [
          {
            href: `${basePath}/dashboard/inventory`,
            label: "Produk",
            icon: "products",
          },
          {
            href: `${basePath}/dashboard/inventory/stock`,
            label: "Stok",
            icon: "stock",
          },
          {
            href: `${basePath}/dashboard/inventory/stock-in`,
            label: "Stok Masuk",
            icon: "stockIn",
          },
          {
            href: `${basePath}/dashboard/inventory/stock-out`,
            label: "Stok Keluar",
            icon: "stockOut",
          },
        ],
        inventoryAktif,
      ),
    },
    {
      judul: "Billing",
      items: tandai(
        [
          {
            href: `${basePath}/dashboard/billing/customers`,
            label: "Pelanggan",
            icon: "customers",
          },
          {
            href: `${basePath}/dashboard/billing`,
            label: "Invoice",
            icon: "invoices",
          },
        ],
        billingAktif,
      ),
    },
    {
      judul: "Keuangan",
      items: tandai(
        [
          {
            href: `${basePath}/dashboard/keuangan/pengeluaran`,
            label: "Pengeluaran",
            icon: "expenses",
          },
          {
            href: `${basePath}/dashboard/zakat`,
            label: "Zakat",
            icon: "zakat",
          },
        ],
        accountingAktif,
      ),
    },
    {
      judul: "Toko",
      items: [
        {
          href: `${basePath}/dashboard/settings`,
          label: "Pengaturan Branding",
          icon: "settings",
          // Branding/white-label hanya untuk PRO: FREE melihat gembok upgrade.
          kunciPro: tenant.plan === "FREE",
        },
      ],
    },
  ];

  // Halaman di bawah grup ini mengalihkan ke /login bila belum ada sesi. Render
  // tanpa kerangka dulu supaya tidak ada sidebar yang berkedip sebelum itu.
  const user = await getSessionUser();
  if (!user) {
    return <div className="min-h-svh bg-background">{children}</div>;
  }

  return (
    <AppShell
      sections={sections}
      tenant={{
        name: tenant.name,
        host:
          modus === "subdomain" ? `${tenant.slug}.${ROOT_DOMAIN}` : `/${tenant.slug}`,
        plan: tenant.plan,
        isPro: tenant.isPro,
      }}
      branding={branding}
      user={{
        name: user.name ?? user.email ?? "Pengguna",
        email: user.email ?? "",
      }}
      basePath={basePath}
      logoutAction={logoutAction}
    >
      {children}
    </AppShell>
  );
}
