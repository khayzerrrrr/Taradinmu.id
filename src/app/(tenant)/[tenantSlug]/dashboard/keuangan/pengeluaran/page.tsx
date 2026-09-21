import { notFound } from "next/navigation";
import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { MetricCard } from "@/components/shared/metric-card";
import { formatRupiah } from "@/lib/format";
import { getCurrentTenant } from "@/lib/tenant";
import { requireTenantMember } from "@/lib/tenant-access";
import {
  getExpenseSummary,
  getExpenses,
} from "@/modules/core/actions/expense-actions";
import { ExpenseTable } from "@/modules/core/components/expense-table";
import { KeuanganLocked } from "@/modules/core/components/keuangan-locked";
import { listExpensesSchema } from "@/modules/core/schemas/expense-schema";
import type { ExpenseItem, ExpenseSummary } from "@/modules/core/types";
import { isModuleEnabled } from "@/shared/modules";
import type { PaginationMeta } from "@/shared/types";

// Halaman pencatatan pengeluaran (Modul Akuntansi).
// Data bergantung sesi & query, jadi selalu dirender per-request.
export const dynamic = "force-dynamic";

function ambilString(nilai: string | string[] | undefined): string | undefined {
  if (typeof nilai === "string") return nilai;
  if (Array.isArray(nilai)) return nilai[0];
  return undefined;
}

export default async function PengeluaranPage({
  searchParams,
}: PageProps<"/[tenantSlug]/dashboard/keuangan/pengeluaran">) {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  // Gate sesi: hanya anggota tenant (atau SUPER_ADMIN) yang boleh melihat.
  await requireTenantMember(tenant);

  // Feature flag (PRD Bagian 6): cek modul sebelum merender UI modul.
  if (!isModuleEnabled(tenant.enabledModules, "ACCOUNTING")) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Pengeluaran" />
        <KeuanganLocked tenantName={tenant.name} />
      </div>
    );
  }

  const params = await searchParams;
  const parsed = listExpensesSchema.safeParse({
    page: ambilString(params.page),
    perPage: ambilString(params.perPage),
    search: ambilString(params.search),
    category: ambilString(params.category),
  });
  const input = parsed.success
    ? parsed.data
    : { page: 1, perPage: 10, search: undefined, category: undefined };

  const [listRes, summaryRes] = await Promise.all([
    getExpenses(input),
    getExpenseSummary(),
  ]);

  const expenses: ExpenseItem[] = listRes.data?.expenses ?? [];
  const meta: PaginationMeta = listRes.data?.meta ?? {
    page: 1,
    perPage: 10,
    total: 0,
    totalPages: 1,
  };
  const ringkasan: ExpenseSummary = summaryRes.data ?? {
    totalBulanIni: 0,
    jumlahBulanIni: 0,
    totalKeseluruhan: 0,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pengeluaran"
        description={`Catat biaya operasional ${tenant.name} agar arus kas usaha tetap terpantau.`}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard
          label="Pengeluaran Bulan Ini"
          value={formatRupiah(ringkasan.totalBulanIni)}
          hint={`${ringkasan.jumlahBulanIni} transaksi bulan ini`}
          icon={Wallet}
          style={{ animationDelay: "0ms" }}
        />
        <MetricCard
          label="Total Sepanjang Waktu"
          value={formatRupiah(ringkasan.totalKeseluruhan)}
          hint="Seluruh pengeluaran yang tercatat"
          style={{ animationDelay: "60ms" }}
        />
      </div>

      {!listRes.success ? (
        <p className="text-sm text-destructive">{listRes.message}</p>
      ) : null}

      <ExpenseTable
        expenses={expenses}
        meta={meta}
        search={input.search ?? ""}
        category={input.category ?? ""}
      />
    </div>
  );
}
