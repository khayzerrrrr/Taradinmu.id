import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { isBatchTrackingEnabled } from "@/lib/business-presets";
import { getCurrentTenant } from "@/lib/tenant";
import { requireTenantMember } from "@/lib/tenant-access";
import {
  getRecentMovements,
  getVariantsForStock,
} from "@/modules/inventory/actions/stock-actions";
import { InventoryLocked } from "@/modules/inventory/components/inventory-locked";
import { MovementTable } from "@/modules/inventory/components/movement-table";
import { StockInForm } from "@/modules/inventory/components/stock-in-form";
import type {
  StockMovementItem,
  VariantOption,
} from "@/modules/inventory/types";
import { isModuleEnabled } from "@/shared/modules";

export const dynamic = "force-dynamic";

export default async function StockInPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  await requireTenantMember(tenant);

  if (!isModuleEnabled(tenant.enabledModules, "INVENTORY")) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Stok Masuk" />
        <InventoryLocked tenantName={tenant.name} />
      </div>
    );
  }

  const [variantsRes, movementsRes] = await Promise.all([
    getVariantsForStock(),
    getRecentMovements({ perPage: 10, type: "IN" }),
  ]);

  const variants: VariantOption[] = variantsRes.data ?? [];
  const movements: StockMovementItem[] = movementsRes.data ?? [];

  // Fitur batch mengikuti paket langganan (PRD 4.D): hanya PRO.
  const batchEnabled = isBatchTrackingEnabled(tenant.plan);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Stok Masuk"
        description={
          batchEnabled
            ? `Catat penerimaan barang per batch (nomor batch & tanggal kedaluwarsa) untuk ${tenant.name}.`
            : `Catat penerimaan barang untuk ${tenant.name}.`
        }
      />

      {!variantsRes.success ? (
        <p className="text-sm text-destructive">{variantsRes.message}</p>
      ) : null}

      <StockInForm variants={variants} batchEnabled={batchEnabled} />

      <MovementTable
        movements={movements}
        judul="10 pergerakan stok masuk terakhir"
      />
    </div>
  );
}
