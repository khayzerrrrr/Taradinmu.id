import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { getCurrentTenant } from "@/lib/tenant";
import { requireTenantMember } from "@/lib/tenant-access";
import { ZAKAT_RATE } from "@/lib/zakat";
import { NISAB_PERDAGANGAN } from "@/lib/zakat-nisab";
import {
  calculateZakatPenghasilan,
  getZakatHistory,
} from "@/modules/core/actions/zakat-actions";
import { KeuanganLocked } from "@/modules/core/components/keuangan-locked";
import { ZakatTabs } from "@/modules/core/components/zakat-tabs";
import type {
  ZakatHistoryItem,
  ZakatPenghasilan,
} from "@/modules/core/types";
import { isModuleEnabled } from "@/shared/modules";

// Fitur Zakat: zakat penghasilan (otomatis) & zakat perniagaan (manual).
// Data bergantung sesi & waktu, jadi selalu dirender per-request.
export const dynamic = "force-dynamic";

export default async function ZakatPage({
  searchParams,
}: PageProps<"/[tenantSlug]/dashboard/zakat">) {
  const params = await searchParams;
  const tabAwal = typeof params.tab === "string" ? params.tab : undefined;

  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  // Gate sesi: hanya anggota tenant (atau SUPER_ADMIN) yang boleh melihat.
  await requireTenantMember(tenant);

  // Zakat adalah bagian modul Akuntansi (feature flag PRD Bagian 6).
  if (!isModuleEnabled(tenant.enabledModules, "ACCOUNTING")) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Zakat" />
        <KeuanganLocked tenantName={tenant.name} />
      </div>
    );
  }

  const [hasilPenghasilan, hasilRiwayat] = await Promise.all([
    calculateZakatPenghasilan(),
    getZakatHistory(),
  ]);

  const penghasilan: ZakatPenghasilan | null = hasilPenghasilan.data ?? null;
  const riwayat: ZakatHistoryItem[] = hasilRiwayat.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Zakat"
        description={`Estimasi zakat penghasilan dan perniagaan ${tenant.name}.`}
      />

      <ZakatTabs
        penghasilan={penghasilan}
        pesanPenghasilan={
          hasilPenghasilan.success ? undefined : hasilPenghasilan.message
        }
        terkunciPro={tenant.plan === "FREE"}
        nisabPerdagangan={NISAB_PERDAGANGAN}
        rate={ZAKAT_RATE}
        riwayat={riwayat}
        tabAwal={tabAwal}
      />
    </div>
  );
}
