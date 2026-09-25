import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { LockedFeature } from "@/components/shared/locked-feature";
import { resolveBranding } from "@/lib/branding";
import { getCurrentTenant } from "@/lib/tenant";
import { requireTenantOwner } from "@/lib/tenant-access";
import { BrandingForm } from "@/modules/core/components/branding-form";
import { AVAILABLE_MODULES, isModuleEnabled } from "@/shared/modules";

export const dynamic = "force-dynamic";

// Pengaturan Toko (white-label) — hanya OWNER (atau Super Admin).
export default async function TenantSettingsPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  await requireTenantOwner(tenant);

  const branding = resolveBranding(tenant);
  const modulAktif = AVAILABLE_MODULES.filter((modul) =>
    isModuleEnabled(tenant.enabledModules, modul.key),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pengaturan Branding"
        description="Sesuaikan logo dan warna dashboard toko Anda."
        aksi={
          <Badge variant={tenant.isPro ? "default" : "secondary"}>
            {tenant.plan}
          </Badge>
        }
      />

      {/* White-label adalah fitur PRO: paket FREE melihat pratinjau terburam
          dengan overlay gembok, dan tombolnya membuka modal upgrade. */}
      <LockedFeature
        isLocked={!tenant.isPro}
        fitur="Branding (logo & warna)"
        kunci="BRANDING"
        deskripsi="Ganti logo dan warna dashboard tersedia pada paket PRO. Informasi toko di bawah tetap bisa dilihat."
      >
        <BrandingForm
          isPro={tenant.isPro}
          primaryColor={branding.accentColor}
          logoUrl={branding.logoUrl}
          tenantName={tenant.name}
        />
      </LockedFeature>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Informasi Toko</CardTitle>
          <CardDescription>
            Data ini dikelola oleh Super Admin TaradinMu.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <Baris label="Nama usaha" nilai={tenant.name} />
          <Baris label="Slug" nilai={`/${tenant.slug}`} />
          <Baris label="Subdomain" nilai={tenant.subdomain ?? "—"} />
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Modul aktif</span>
            <span className="flex flex-wrap justify-end gap-1">
              {modulAktif.length === 0 ? (
                <span className="text-muted-foreground">Belum ada</span>
              ) : (
                modulAktif.map((modul) => (
                  <Badge key={modul.key} variant="outline">
                    {modul.key}
                  </Badge>
                ))
              )}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Baris({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{nilai}</span>
    </div>
  );
}
