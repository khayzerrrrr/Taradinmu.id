import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import type { NavItem, NavSection } from "@/components/layout/nav";
import { AiAssistantChat } from "@/components/shared/ai-assistant-chat";
import { resolveBranding } from "@/lib/branding";
import { punyaItemBarang } from "@/lib/katalog-tenant";
import {
  buildTenantSubdomainUrl,
  getCurrentTenant,
  getTenantRequestInfo,
  ROOT_DOMAIN,
  type TenantMode,
} from "@/lib/tenant";
import { getSessionUser } from "@/lib/tenant-access";
import { logoutAction } from "@/modules/core/actions/auth-actions";
import { ImpersonationBanner } from "@/modules/core/components/impersonation-banner";
import { labelProgram } from "@/modules/program/utils";
import { isModuleEnabled } from "@/shared/modules";

// Layout area tenant: sidebar + bilah atas + kanvas konten.
// Route group tidak menyumbang segmen URL, sehingga tipe layout ini adalah "/".
export default async function TenantLayout({ children }: LayoutProps<"/">) {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  const info = await getTenantRequestInfo();
  const modus: TenantMode = info.mode ?? "path";

  // Sesi dibaca lebih awal karena perannya menentukan apakah menu Pengguna muncul,
  // dan karena mode "masuk sebagai tenant" membatalkan pengalihan subdomain di bawah.
  // `getSessionUser` di-cache per request, jadi ini tidak menambah query.
  const user = await getSessionUser();

  // Fitur PRO (subdomain). Bila tenant PRO diakses lewat path, arahkan ke subdomain.
  // Dikecualikan ketika Super Admin sedang "masuk sebagai tenant": subdomain butuh
  // DNS yang tidak tersedia di pengembangan, sehingga mode pratinjau justru gagal
  // membuka halamannya.
  if (
    modus === "path" &&
    tenant.isPro &&
    tenant.subdomain &&
    !user?.impersonatedBy
  ) {
    redirect(buildTenantSubdomainUrl(tenant.subdomain, info.rest));
  }

  // White-label: warna & logo kustom hanya berlaku untuk PRO (fallback ke default TaradinMu).
  const branding = resolveBranding(tenant);

  // Basis URL mengikuti mode: subdomain memakai akar domain, path memakai /<slug>.
  const basePath = modus === "subdomain" ? "" : `/${tenant.slug}`;
  const inventoryAktif = isModuleEnabled(tenant.enabledModules, "INVENTORY");
  const billingAktif = isModuleEnabled(tenant.enabledModules, "BILLING");
  const accountingAktif = isModuleEnabled(tenant.enabledModules, "ACCOUNTING");
  const programAktif = isModuleEnabled(tenant.enabledModules, "PROGRAM");
  // Menu memakai sebutan industri, bukan "Program" generik: travel umrah harus
  // membaca "Kloter", sekolah membaca "Tahun Ajaran" (PRD 4.F.4).
  const sebutanProgram = labelProgram(tenant.businessType).program;
  // Menu stok hanya relevan bila katalog tenant memang berisi barang, bukan
  // hanya jasa (travel/laundry/pendidikan).
  const adaItemBarang = inventoryAktif ? await punyaItemBarang(tenant.id) : false;

  // Sesi sudah dibaca di atas (lihat alasan di sana).
  const bolehKelolaPengguna =
    user !== null &&
    (user.role === "SUPER_ADMIN" ||
      user.role === "OWNER" ||
      user.role === "ADMIN");

  // Modul yang belum aktif tetap ditampilkan (dengan penanda gembok) agar
  // pengguna tahu fitur itu ada — halamannya menjelaskan cara mengaktifkan.
  const tandai = (items: NavItem[], aktif: boolean): NavItem[] =>
    aktif ? items : items.map((item) => ({ ...item, terkunci: true }));

  const itemToko: NavItem[] = [
    {
      href: `${basePath}/dashboard/settings`,
      label: "Pengaturan Toko",
      icon: "settings",
      // `exact`: tanpa ini baris ini ikut menyala saat sub-halamannya dibuka
      // (mis. /dashboard/settings/users), sehingga dua menu tampak aktif.
      exact: true,
      // Branding/white-label hanya untuk PRO: FREE melihat gembok upgrade.
      kunciPro: tenant.plan === "FREE",
    },
  ];

  if (bolehKelolaPengguna) {
    itemToko.push({
      href: `${basePath}/dashboard/settings/users`,
      label: "Pengguna",
      icon: "users",
    });
  }

  // Katalog selalu ditampilkan (barang maupun jasa). Menu stok menyusul hanya
  // bila tenant punya item barang, supaya usaha jasa tidak melihat menu yang
  // selamanya kosong.
  const itemInventory: NavItem[] = [
    {
      href: `${basePath}/dashboard/inventory`,
      label: "Produk & Layanan",
      icon: "products",
      // Sama seperti "Pengaturan Toko": menu stok adalah sub-halaman dari sini.
      exact: true,
    },
  ];

  if (adaItemBarang) {
    itemInventory.push(
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
    );
  }

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
      items: tandai(itemInventory, inventoryAktif),
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
            // Daftar invoice memang tinggal di /dashboard/billing (bukan
            // /billing/invoices yang tidak pernah ada). `exact` wajib karena
            // rute ini juga induk dari /billing/customers: tanpa exact,
            // membuka "Pelanggan" ikut menyalakan baris "Invoice".
            href: `${basePath}/dashboard/billing`,
            label: "Invoice",
            exact: true,
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
      judul: "Program",
      items: tandai(
        [
          {
            href: `${basePath}/dashboard/program`,
            label: sebutanProgram,
            icon: "programs",
            // PRO saja (PRD 4.F.6): paket FREE melihat gembok + modal upgrade,
            // dan Server Action-nya tetap menolak — bukan hanya menunya.
            kunciPro: tenant.plan === "FREE",
          },
        ],
        programAktif,
      ),
    },
    {
      judul: "Toko",
      items: itemToko,
    },
  ];

  // Halaman di bawah grup ini mengalihkan ke /login bila belum ada sesi. Render
  // tanpa kerangka dulu supaya tidak ada sidebar yang berkedip sebelum itu.
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
      banner={
        // Mode "masuk sebagai tenant" (PRD 4.B): banner + jalan keluar.
        user.impersonatedBy ? (
          <ImpersonationBanner
            tenantName={user.impersonatingTenant?.name ?? tenant.name}
          />
        ) : undefined
      }
    >
      {children}
      {/* Asisten AI mengambang di seluruh halaman tenant (PRD Bagian 4.E). */}
      <AiAssistantChat terkunciPro={tenant.plan === "FREE"} />
    </AppShell>
  );
}
