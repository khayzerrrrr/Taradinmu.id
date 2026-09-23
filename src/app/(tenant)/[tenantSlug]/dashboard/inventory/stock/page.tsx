import { notFound } from "next/navigation";
import { getCurrentTenant } from "@/lib/tenant";
import { isBatchTrackingEnabled } from "@/lib/business-presets";
import { requireTenantMember } from "@/lib/tenant-access";
import { getStockSummary } from "@/modules/inventory/actions/stock-actions";
import { InventoryLocked } from "@/modules/inventory/components/inventory-locked";
import { StockSummaryTable } from "@/modules/inventory/components/stock-summary-table";
import { listStockSchema } from "@/modules/inventory/schemas/stock-schema";
import type { StockSummaryItem } from "@/modules/inventory/types";
import { PageHeader } from "@/components/shared/page-header";
import { isModuleEnabled } from "@/shared/modules";
import type { PaginationMeta } from "@/shared/types";

export const dynamic = "force-dynamic";

function ambilString(nilai: string | string[] | undefined): string | undefined {
  if (typeof nilai === "string") return nilai;
  if (Array.isArray(nilai)) return nilai[0];
  return undefined;
}

export default async function StockSummaryPage({
  searchParams,
}: PageProps<"/[tenantSlug]/dashboard/inventory/stock">) {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  await requireTenantMember(tenant);

  if (!isModuleEnabled(tenant.enabledModules, "INVENTORY")) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Ringkasan Stok" />
        <InventoryLocked tenantName={tenant.name} />
      </div>
    );
  }

  const params = await searchParams;
  const parsed = listStockSchema.safeParse({
    page: ambilString(params.page),
    perPage: ambilString(params.perPage),
    search: ambilString(params.search),
  });
  const input = parsed.success
    ? parsed.data
    : { page: 1, perPage: 10, search: undefined };

  const result = await getStockSummary(input);
  const items: StockSummaryItem[] = result.data?.items ?? [];
  const meta: PaginationMeta = result.data?.meta ?? {
    page: 1,
    perPage: 10,
    total: 0,
    totalPages: 1,
  };

  // Fitur batch mengikuti paket langganan (PRD 4.D): hanya PRO.
  const batchEnabled = isBatchTrackingEnabled(tenant.plan);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ringkasan Stok"
        description={
          batchEnabled
            ? `Stok per varian beserta batch, penanda stok menipis, dan kedaluwarsa terdekat untuk ${tenant.name}.`
            : `Stok per varian, penanda stok menipis, dan kedaluwarsa terdekat untuk ${tenant.name}.`
        }
      />

      {!result.success ? (
        <p className="text-sm text-destructive">{result.message}</p>
      ) : null}

      <StockSummaryTable
        items={items}
        meta={meta}
        search={input.search ?? ""}
        batchEnabled={batchEnabled}
      />
    </div>
  );
}
