import { notFound } from "next/navigation";
import { getPresetConfig } from "@/lib/business-presets";
import { getCurrentTenant } from "@/lib/tenant";
import { requireTenantMember } from "@/lib/tenant-access";
import { getProducts } from "@/modules/inventory/actions/product-actions";
import { InventoryLocked } from "@/modules/inventory/components/inventory-locked";
import { ProductTable } from "@/modules/inventory/components/product-table";
import { listProductsSchema } from "@/modules/inventory/schemas/product-schema";
import type { ProductListItem } from "@/modules/inventory/types";
import { PageHeader } from "@/components/shared/page-header";
import { ProductFormDialog } from "@/modules/inventory/components/product-form-dialog";
import { isModuleEnabled } from "@/shared/modules";
import type { PaginationMeta } from "@/shared/types";

// Halaman utama Modul Inventory: katalog barang & jasa + varian (SKU & harga).
// Data bergantung sesi & query, jadi selalu dirender per-request.
export const dynamic = "force-dynamic";

function ambilString(nilai: string | string[] | undefined): string | undefined {
  if (typeof nilai === "string") return nilai;
  if (Array.isArray(nilai)) return nilai[0];
  return undefined;
}

export default async function InventoryPage({
  searchParams,
}: PageProps<"/[tenantSlug]/dashboard/inventory">) {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  // Gate sesi: hanya anggota tenant (atau SUPER_ADMIN) yang boleh melihat.
  await requireTenantMember(tenant);

  // Feature flag (PRD Bagian 6): cek modul sebelum merender UI modul.
  if (!isModuleEnabled(tenant.enabledModules, "INVENTORY")) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Inventory" />
        <InventoryLocked tenantName={tenant.name} />
      </div>
    );
  }

  const params = await searchParams;
  const parsed = listProductsSchema.safeParse({
    page: ambilString(params.page),
    perPage: ambilString(params.perPage),
    search: ambilString(params.search),
  });
  const input = parsed.success
    ? parsed.data
    : { page: 1, perPage: 10, search: undefined };

  const result = await getProducts(input);
  const products: ProductListItem[] = result.data?.products ?? [];
  const meta: PaginationMeta = result.data?.meta ?? {
    page: 1,
    perPage: 10,
    total: 0,
    totalPages: 1,
  };

  // Jenis usaha menentukan jenis item yang paling sering dibuat: travel/laundry
  // mayoritas jasa, minimarket mayoritas barang. Hanya nilai awal form, tetap
  // bisa diubah pengguna.
  const defaultKind = getPresetConfig(tenant.businessType).defaultItemKind;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Produk & Layanan"
        description={`Katalog barang dan jasa beserta varian (SKU & harga) untuk ${tenant.name}.`}
        aksi={<ProductFormDialog defaultKind={defaultKind} />}
      />

      {!result.success ? (
        <p className="text-sm text-destructive">{result.message}</p>
      ) : null}

      <ProductTable
        products={products}
        meta={meta}
        search={input.search ?? ""}
        defaultKind={defaultKind}
      />
    </div>
  );
}
