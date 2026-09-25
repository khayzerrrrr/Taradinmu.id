import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { getCurrentTenant } from "@/lib/tenant";
import {
  getSessionUser,
  requireTenantMember,
} from "@/lib/tenant-access";
import { getSuppliers } from "@/modules/inventory/actions/supplier-actions";
import { InventoryLocked } from "@/modules/inventory/components/inventory-locked";
import { SupplierTable } from "@/modules/inventory/components/supplier-table";
import { listSuppliersSchema } from "@/modules/inventory/schemas/supplier-schema";
import type { SupplierItem } from "@/modules/inventory/types";
import { isModuleEnabled } from "@/shared/modules";
import type { PaginationMeta } from "@/shared/types";

export const dynamic = "force-dynamic";

function ambilString(nilai: string | string[] | undefined): string | undefined {
  if (typeof nilai === "string") return nilai;
  if (Array.isArray(nilai)) return nilai[0];
  return undefined;
}

export default async function InventorySuppliersPage({
  searchParams,
}: PageProps<"/[tenantSlug]/dashboard/inventory/suppliers">) {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  await requireTenantMember(tenant);

  if (!isModuleEnabled(tenant.enabledModules, "INVENTORY")) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Pemasok" />
        <InventoryLocked tenantName={tenant.name} />
      </div>
    );
  }

  const user = await getSessionUser();
  // STAFF membaca data pemasok tetapi tidak mengubahnya (PRD 4.G.4).
  const bolehMenulis =
    user !== null &&
    (user.role === "SUPER_ADMIN" ||
      user.role === "OWNER" ||
      user.role === "ADMIN");

  const params = await searchParams;
  const parsed = listSuppliersSchema.safeParse({
    page: ambilString(params.page),
    perPage: ambilString(params.perPage),
    search: ambilString(params.search),
  });
  const input = parsed.success
    ? parsed.data
    : { page: 1, perPage: 10, search: undefined };

  const result = await getSuppliers(input);
  const suppliers: SupplierItem[] = result.data?.suppliers ?? [];
  const meta: PaginationMeta = result.data?.meta ?? {
    page: 1,
    perPage: 10,
    total: 0,
    totalPages: 1,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pemasok"
        description={`Tempat ${tenant.name} membeli barang, asal harga modal stok. Tombol tambah & ubah hanya tampil untuk pemilik dan admin.`}
      />

      {!result.success ? (
        <p className="text-sm text-destructive">{result.message}</p>
      ) : null}

      <SupplierTable
        suppliers={suppliers}
        meta={meta}
        search={input.search ?? ""}
        bolehMenulis={bolehMenulis}
      />
    </div>
  );
}
