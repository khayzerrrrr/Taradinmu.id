import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { ambilBatasJumlah } from "@/lib/plan-limits";
import { getCurrentTenant } from "@/lib/tenant";
import { requireTenantUserManager } from "@/lib/tenant-access";
import { getUsers } from "@/modules/core/actions/user-actions";
import { UserTable } from "@/modules/core/components/user-table";
import { listUsersSchema } from "@/modules/core/schemas/user-schema";
import type { UserListItem } from "@/modules/core/types";
import type { PaginationMeta } from "@/shared/types";

// Manajemen pengguna tenant (PRD Fase 1: "User Management" + "Role-based access").
// Data bergantung sesi & query, jadi selalu dirender per-request.
export const dynamic = "force-dynamic";

function ambilString(nilai: string | string[] | undefined): string | undefined {
  if (typeof nilai === "string") return nilai;
  if (Array.isArray(nilai)) return nilai[0];
  return undefined;
}

export default async function UsersPage({
  searchParams,
}: PageProps<"/[tenantSlug]/dashboard/settings/users">) {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  // Gerbang halaman: hanya OWNER/ADMIN (atau SUPER_ADMIN) yang boleh melihat
  // daftar pengguna. Peran lain dialihkan. Penegakan sebenarnya juga ada di
  // setiap Server Action, karena layout tidak dijalankan ulang saat navigasi.
  await requireTenantUserManager(tenant);

  const params = await searchParams;
  const parsed = listUsersSchema.safeParse({
    page: ambilString(params.page),
    perPage: ambilString(params.perPage),
    search: ambilString(params.search),
  });
  const input = parsed.success
    ? parsed.data
    : { page: 1, perPage: 10, search: undefined };

  const hasil = await getUsers(input);
  const users: UserListItem[] = hasil.data?.users ?? [];
  const meta: PaginationMeta = hasil.data?.meta ?? {
    page: 1,
    perPage: 10,
    total: 0,
    totalPages: 1,
  };

  // Batas paket (PRD 4.D): FREE hanya 1 pengguna, PRO tanpa batas. Bila kuota
  // sudah penuh, tombol tambah berubah menjadi ajakan upgrade — bukan form yang
  // sudah pasti gagal saat dikirim.
  const batas = ambilBatasJumlah(tenant.plan, "USERS");
  const bolehTambah = batas === null || meta.total < batas;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pengguna"
        description={`Kelola siapa saja yang boleh mengakses data ${tenant.name}.`}
      />

      {!hasil.success ? (
        <p className="text-sm text-destructive">{hasil.message}</p>
      ) : null}

      <UserTable
        users={users}
        meta={meta}
        search={input.search ?? ""}
        bolehTambah={bolehTambah}
      />
    </div>
  );
}
