import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { getOwnerSummary } from "@/lib/dashboard-summary";
import { getCurrentTenant, getTenantRequestInfo } from "@/lib/tenant";
import { requireTenantMember } from "@/lib/tenant-access";
import { OwnerDashboard } from "@/modules/core/components/owner-dashboard";

export const dynamic = "force-dynamic";

// Dashboard Owner: ringkasan kas/piutang, pendapatan bulan ini, dan kondisi stok.
export default async function TenantDashboardPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  await requireTenantMember(tenant);

  const { mode } = await getTenantRequestInfo();
  const basePath = mode === "subdomain" ? "" : `/${tenant.slug}`;

  const ringkasan = await getOwnerSummary(
    tenant.id,
    tenant.enabledModules,
    tenant.plan,
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description={`Ringkasan usaha ${tenant.name}.`}
      />

      <OwnerDashboard ringkasan={ringkasan} basePath={basePath} />
    </div>
  );
}
