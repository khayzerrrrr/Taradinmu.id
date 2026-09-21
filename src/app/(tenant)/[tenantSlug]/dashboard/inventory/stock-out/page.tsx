import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { getCurrentTenant } from "@/lib/tenant";
import { requireTenantMember } from "@/lib/tenant-access";
import {
  getRecentMovements,
  getVariantsForStock,
} from "@/modules/inventory/actions/stock-actions";
import { InventoryLocked } from "@/modules/inventory/components/inventory-locked";
import { MovementTable } from "@/modules/inventory/components/movement-table";
import { StockOutForm } from "@/modules/inventory/components/stock-out-form";
import type {
  StockMovementItem,
  VariantOption,
} from "@/modules/inventory/types";
import { isModuleEnabled } from "@/shared/modules";

export const dynamic = "force-dynamic";

export default async function StockOutPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  await requireTenantMember(tenant);

  if (!isModuleEnabled(tenant.enabledModules, "INVENTORY")) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Stok Keluar" />
        <InventoryLocked tenantName={tenant.name} />
      </div>
    );
  }

  const [variantsRes, movementsRes] = await Promise.all([
    getVariantsForStock(),
    getRecentMovements({ perPage: 10, type: "OUT" }),
  ]);

  const variants: VariantOption[] = variantsRes.data ?? [];
  const movements: StockMovementItem[] = movementsRes.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Stok Keluar"
        description={`Pengeluaran barang dengan alokasi FEFO (First Expired First Out) untuk ${tenant.name}.`}
      />

      {!variantsRes.success ? (
        <p className="text-sm text-destructive">{variantsRes.message}</p>
      ) : null}

      <StockOutForm variants={variants} />

      <MovementTable
        movements={movements}
        judul="10 pergerakan stok keluar terakhir"
      />
    </div>
  );
}
