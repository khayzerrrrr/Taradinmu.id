import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/modules/core/actions/auth-actions";
import { requireSuperAdmin } from "@/modules/core/auth/dal";

// Layout area /admin: gerbang cepat untuk UX.
// Catatan: layout TIDAK dijalankan ulang saat navigasi client-side, jadi setiap
// halaman dan setiap Server Action tetap memverifikasi otorisasi sendiri.
//
// Sengaja TANPA sidebar: area ini hanya punya satu tujuan (daftar tenant), dan
// header mendatar membuat operator langsung sadar sedang berada di luar
// konteks toko.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireSuperAdmin();

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-30 flex h-topbar shrink-0 items-center gap-3 border-b border-border bg-surface px-4 md:px-6">
        <Link
          href="/admin"
          aria-label="TaradinMu — area admin"
          className="flex shrink-0 items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Logo variant="horizontal" className="h-7 w-auto" />
        </Link>

        <Badge variant="neutral" className="hidden shrink-0 sm:inline-flex">
          Super Admin
        </Badge>

        <span aria-hidden="true" className="hidden h-5 w-px bg-border md:block" />

        <Breadcrumbs basePath="" />

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span className="hidden max-w-[16rem] truncate text-xs text-muted-foreground sm:inline">
            {user.email}
          </span>
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="sm">
              Keluar
            </Button>
          </form>
        </div>
      </header>

      <main id="konten-utama" className="flex-1">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
