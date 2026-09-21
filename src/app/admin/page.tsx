import { getAllTenants } from "@/modules/core/actions/tenant-actions";
import { requireSuperAdmin } from "@/modules/core/auth/dal";
import { TenantTable } from "@/modules/core/components/tenant-table";
import { listTenantsSchema } from "@/modules/core/schemas/tenant-schema";
import { PageHeader } from "@/components/shared/page-header";
import type { PaginationMeta, TenantListItem } from "@/modules/core/types";

// Dashboard Super Admin: daftar seluruh tenant beserta paket & modul aktifnya.
// Data bergantung pada sesi & query, jadi selalu dirender per-request.
export const dynamic = "force-dynamic";

function ambilString(nilai: string | string[] | undefined): string | undefined {
  if (typeof nilai === "string") return nilai;
  if (Array.isArray(nilai)) return nilai[0];
  return undefined;
}

export default async function AdminDashboardPage({
  searchParams,
}: PageProps<"/admin">) {
  // Gerbang otorisasi nyata: hanya SUPER_ADMIN yang boleh melihat daftar tenant.
  await requireSuperAdmin();

  // Di Next.js 16, searchParams adalah Promise.
  const params = await searchParams;
  const parsed = listTenantsSchema.safeParse({
    page: ambilString(params.page),
    perPage: ambilString(params.perPage),
    search: ambilString(params.search),
  });
  const input = parsed.success ? parsed.data : { page: 1, perPage: 10 };

  const result = await getAllTenants(input);
  const tenants: TenantListItem[] = result.data?.tenants ?? [];
  const meta: PaginationMeta = result.data?.meta ?? {
    page: 1,
    perPage: 10,
    total: 0,
    totalPages: 1,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Manajemen Tenant"
        description="Provisioning tenant baru, pengaturan paket, dan modul aktif."
      />

      {!result.success ? (
        <p className="text-sm text-destructive">{result.message}</p>
      ) : null}

      <TenantTable tenants={tenants} meta={meta} />
    </div>
  );
}
