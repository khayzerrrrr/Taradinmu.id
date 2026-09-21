import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentTenant } from "@/lib/tenant";
import { AVAILABLE_MODULES } from "@/modules/core/utils";

// CONTOH: mengambil data tenant di dalam Server Component.
// Cukup satu pemanggilan `getCurrentTenant()` — tidak ada query tambahan karena
// nilainya sudah di-cache per request dan dipakai bersama layout.
export default async function TenantHomePage({
  params,
}: PageProps<"/[tenantSlug]">) {
  const { tenantSlug } = await params;
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  const modulAktif = AVAILABLE_MODULES.filter((modul) =>
    tenant.enabledModules.includes(modul.key),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">{tenant.name}</h1>
        <p className="text-sm text-muted-foreground">
          Halaman tenant diakses lewat slug <code>/{tenantSlug}</code>.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Paket Langganan</CardTitle>
            <CardDescription>
              Menentukan fitur subdomain &amp; white-label.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Badge variant={tenant.isPro ? "default" : "secondary"}>
              {tenant.plan}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {tenant.isPro
                ? "Subdomain & branding kustom aktif"
                : "Subdomain & branding kustom tidak tersedia (upgrade ke PRO)"}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Modul Aktif</CardTitle>
            <CardDescription>
              Feature flag dari <code>tenant.enabledModules</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {modulAktif.length === 0 ? (
              <span className="text-sm text-muted-foreground">
                Belum ada modul diaktifkan.
              </span>
            ) : (
              modulAktif.map((modul) => (
                <Badge key={modul.key} variant="outline">
                  {modul.label}
                </Badge>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Contoh lain: <code>const tenant = await getCurrentTenant()</code> — hasilnya
        juga dipakai oleh <code>src/app/(tenant)/layout.tsx</code> pada request yang sama.
      </p>
    </div>
  );
}
