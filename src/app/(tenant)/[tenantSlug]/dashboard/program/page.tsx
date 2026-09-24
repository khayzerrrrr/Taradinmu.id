import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { ArrowDownLeft, ArrowUpRight, Banknote } from "lucide-react";
import { formatRupiah } from "@/lib/format";
import { getCurrentTenant } from "@/lib/tenant";
import { getSessionUser, requireTenantMember } from "@/lib/tenant-access";
import { getPrograms } from "@/modules/program/actions/program-actions";
import { ProgramFormDialog } from "@/modules/program/components/program-form-dialog";
import { ProgramLocked } from "@/modules/program/components/program-locked";
import { ProgramTable } from "@/modules/program/components/program-table";
import { listProgramsSchema } from "@/modules/program/schemas/program-schema";
import type { ProgramItem, ProgramListData } from "@/modules/program/types";
import { labelProgram } from "@/modules/program/utils";
import { isModuleEnabled } from "@/shared/modules";
import type { PaginationMeta } from "@/shared/types";

export const dynamic = "force-dynamic";

function ambilString(nilai: string | string[] | undefined): string | undefined {
  if (typeof nilai === "string") return nilai;
  if (Array.isArray(nilai)) return nilai[0];
  return undefined;
}

export default async function ProgramPage({
  searchParams,
}: PageProps<"/[tenantSlug]/dashboard/program">) {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  await requireTenantMember(tenant);

  const sebutan = labelProgram(tenant.businessType).program;

  // Dua sebab berbeda, dua pesan berbeda (PRD 4.F.6): modul yang belum
  // dinyalakan adalah urusan Super Admin, paket FREE adalah ajakan upgrade.
  if (!isModuleEnabled(tenant.enabledModules, "PROGRAM")) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={sebutan} />
        <ProgramLocked tenantName={tenant.name} sebab="MODUL" sebutan={sebutan} />
      </div>
    );
  }

  if (!tenant.isPro) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={sebutan} />
        <ProgramLocked tenantName={tenant.name} sebab="PAKET" sebutan={sebutan} />
      </div>
    );
  }

  const user = await getSessionUser();
  // STAFF membaca daftar tetapi tidak menulis (PRD 4.F.7).
  const bolehMenulis =
    user !== null &&
    (user.role === "SUPER_ADMIN" || user.role === "OWNER" || user.role === "ADMIN");

  const params = await searchParams;
  const parsed = listProgramsSchema.safeParse({
    page: ambilString(params.page),
    perPage: ambilString(params.perPage),
    search: ambilString(params.search),
    status: ambilString(params.status),
  });
  const input = parsed.success
    ? parsed.data
    : { page: 1, perPage: 10, search: undefined, status: undefined };

  const result = await getPrograms(input);
  const programs: ProgramItem[] = result.data?.programs ?? [];
  const meta: PaginationMeta = result.data?.meta ?? {
    page: 1,
    perPage: 10,
    total: 0,
    totalPages: 1,
  };
  const totalSemua: ProgramListData["totalSemua"] = result.data?.totalSemua ?? {
    terkumpul: "0",
    terpakai: "0",
    berjalan: 0,
  };

  const basePath = `/${tenant.slug}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={sebutan}
        description={`Pusat biaya dan tagih per kegiatan ${tenant.name}. Angkanya diambil dari invoice dan pengeluaran yang tertaut, bukan dicatat dua kali.`}
        aksi={bolehMenulis ? <ProgramFormDialog sebutan={sebutan} /> : undefined}
      />

      {!result.success ? (
        <p className="text-sm text-destructive">{result.message}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard
            label="Dana tertaut terkumpul"
            value={formatRupiah(totalSemua.terkumpul)}
            hint="Total invoice lunas yang menaut suatu program"
            icon={ArrowDownLeft}
          />
          <MetricCard
            label="Dana tertaut terpakai"
            value={formatRupiah(totalSemua.terpakai)}
            hint="Total pengeluaran yang menaut suatu program"
            icon={ArrowUpRight}
          />
          <MetricCard
            label={`${sebutan} berjalan`}
            value={String(totalSemua.berjalan)}
            hint="Status berjalan belum tentu sudah selesai ditagih"
            icon={Banknote}
          />
        </div>
      )}

      <ProgramTable
        programs={programs}
        meta={meta}
        search={input.search ?? ""}
        status={input.status ?? ""}
        sebutan={sebutan}
        bolehMenulis={bolehMenulis}
        basePath={basePath}
      />
    </div>
  );
}
