import { notFound } from "next/navigation";
import { getCurrentTenant } from "@/lib/tenant";
import { requireTenantMember } from "@/lib/tenant-access";
import { getCustomers } from "@/modules/billing/actions/customer-actions";
import { BillingLocked } from "@/modules/billing/components/billing-locked";
import { CustomerTable } from "@/modules/billing/components/customer-table";
import { listCustomersSchema } from "@/modules/billing/schemas/customer-schema";
import type { CustomerItem } from "@/modules/billing/types";
import { PageHeader } from "@/components/shared/page-header";
import { CustomerFormDialog } from "@/modules/billing/components/customer-form-dialog";
import { isModuleEnabled } from "@/shared/modules";
import type { PaginationMeta } from "@/shared/types";

export const dynamic = "force-dynamic";

function ambilString(nilai: string | string[] | undefined): string | undefined {
  if (typeof nilai === "string") return nilai;
  if (Array.isArray(nilai)) return nilai[0];
  return undefined;
}

export default async function BillingCustomersPage({
  searchParams,
}: PageProps<"/[tenantSlug]/dashboard/billing/customers">) {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  await requireTenantMember(tenant);

  if (!isModuleEnabled(tenant.enabledModules, "BILLING")) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Pelanggan" />
        <BillingLocked tenantName={tenant.name} />
      </div>
    );
  }

  const params = await searchParams;
  const parsed = listCustomersSchema.safeParse({
    page: ambilString(params.page),
    perPage: ambilString(params.perPage),
    search: ambilString(params.search),
  });
  const input = parsed.success
    ? parsed.data
    : { page: 1, perPage: 10, search: undefined };

  const result = await getCustomers(input);
  const customers: CustomerItem[] = result.data?.customers ?? [];
  const meta: PaginationMeta = result.data?.meta ?? {
    page: 1,
    perPage: 10,
    total: 0,
    totalPages: 1,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pelanggan"
        description={`Data pelanggan untuk penagihan ${tenant.name}.`}
        aksi={<CustomerFormDialog />}
      />

      {!result.success ? (
        <p className="text-sm text-destructive">{result.message}</p>
      ) : null}

      <CustomerTable
        customers={customers}
        meta={meta}
        search={input.search ?? ""}
      />
    </div>
  );
}
