import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Banknote } from "lucide-react";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { getCurrentTenant } from "@/lib/tenant";
import { getSessionUser, requireTenantMember } from "@/lib/tenant-access";
import { getProgramDetail } from "@/modules/program/actions/program-actions";
import { ProgramEditDialog } from "@/modules/program/components/program-edit-dialog";
import { ProgramLocked } from "@/modules/program/components/program-locked";
import { ProgramProgres, ProgramStatusBadge } from "@/modules/program/components/program-status";
import { ProgramRincian } from "@/modules/program/components/program-rincian";
import { TautanDialog } from "@/modules/program/components/tautan-dialog";
import { detailProgramSchema } from "@/modules/program/schemas/program-schema";
import { hitungRingkasan, labelProgram, perluDitinjau } from "@/modules/program/utils";
import { isModuleEnabled } from "@/shared/modules";

export const dynamic = "force-dynamic";

export default async function ProgramDetailPage({
  params,
}: PageProps<"/[tenantSlug]/dashboard/program/[programId]">) {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  await requireTenantMember(tenant);

  const { programId } = await params;
  const { program, peserta } = labelProgram(tenant.businessType);

  if (!isModuleEnabled(tenant.enabledModules, "PROGRAM")) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={program} />
        <ProgramLocked tenantName={tenant.name} sebab="MODUL" sebutan={program} />
      </div>
    );
  }

  if (!tenant.isPro) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={program} />
        <ProgramLocked tenantName={tenant.name} sebab="PAKET" sebutan={program} />
      </div>
    );
  }

  const parsed = detailProgramSchema.safeParse({ programId });
  if (!parsed.success) notFound();

  const hasil = await getProgramDetail(parsed.data);
  if (!hasil.success || !hasil.data) {
    // Program milik tenant lain menghasilkan "tidak ditemukan" yang sama —
    // tidak ada kebocoran informasi soal keberadaan data.
    notFound();
  }

  const detail = hasil.data;
  const ringkas = hitungRingkasan({
    targetAmount: detail.targetAmount === null ? null : Number(detail.targetAmount),
    budgetAmount: detail.budgetAmount === null ? null : Number(detail.budgetAmount),
    collected: Number(detail.collected),
    spent: Number(detail.spent),
  });

  const user = await getSessionUser();
  const bolehMenulis =
    user !== null &&
    (user.role === "SUPER_ADMIN" || user.role === "OWNER" || user.role === "ADMIN");

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/${tenant.slug}/dashboard/program`}
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Kembali ke daftar {program.toLowerCase()}
      </Link>

      <PageHeader
        title={detail.name}
        description={
          detail.description ??
          `${program} ${tenant.name} · ${formatTanggal(detail.startDate)} sampai ${
            detail.endDate ? formatTanggal(detail.endDate) : "belum ditentukan"
          }`
        }
        aksi={
          bolehMenulis ? (
            <>
              <TautanDialog programId={detail.id} sebutan={program} />
              <ProgramEditDialog program={detail} sebutan={program} />
            </>
          ) : undefined
        }
      />

      <div className="flex items-center gap-2">
        <ProgramStatusBadge status={detail.status} />
        {perluDitinjau(detail.status, detail.endDate) ? (
          <span className="text-xs text-destructive">
            Tanggal selesai sudah lewat — status masih berjalan, perlu ditutup
            atau diperpanjang.
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Dana terkumpul"
          value={formatRupiah(detail.collected)}
          hint={`${detail.paidInvoiceCount} invoice lunas`}
          icon={ArrowDownLeft}
        />
        <MetricCard
          label="Dana terpakai"
          value={formatRupiah(detail.spent)}
          hint={`${detail.expenseCount} pengeluaran`}
          icon={ArrowUpRight}
        />
        <MetricCard
          label="Saldo program"
          value={formatRupiah(ringkas.saldo)}
          hint="Terkumpul dikurangi terpakai"
          icon={Banknote}
        />
        <MetricCard
          label={peserta}
          value={String(detail.participantCount)}
          hint={
            detail.tautanLepas.invoice + detail.tautanLepas.pengeluaran > 0
              ? `${detail.tautanLepas.invoice} invoice & ${detail.tautanLepas.pengeluaran} pengeluaran belum tertaut program mana pun`
              : "Semua uang sudah tertaut"
          }
        />
      </div>

      <Card>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <ProgramProgres
            persen={ringkas.persenTarget}
            label={`Terkumpul dari target ${detail.targetAmount ? formatRupiah(detail.targetAmount) : "-"}`}
          />
          <ProgramProgres
            persen={
              detail.budgetAmount === null
                ? null
                : Number(detail.budgetAmount) <= 0
                  ? null
                  : (Number(detail.spent) / Number(detail.budgetAmount)) * 100
            }
            label={`Terpakai dari anggaran ${detail.budgetAmount ? formatRupiah(detail.budgetAmount) : "-"}`}
            melewati={ringkas.anggaranTerlewat}
          />
          <p className="text-xs text-muted-foreground sm:col-span-2">
            {ringkas.sisaTarget > 0
              ? `Kurang ${formatRupiah(ringkas.sisaTarget)} lagi untuk mencapai target.`
              : detail.targetAmount
                ? "Target dana sudah tercapai."
                : "Target dana belum dipasang, jadi kemajuan tidak bisa dihitung."}
            {ringkas.anggaranTerlewat
              ? ` Pengeluaran melewati anggaran sebesar ${formatRupiah(Math.abs(ringkas.sisaAnggaran ?? 0))}.`
              : ""}
          </p>
        </CardContent>
      </Card>

      <ProgramRincian
        detail={detail}
        sebutan={peserta}
        sebutanProgram={program}
        bolehMenulis={bolehMenulis}
      />
    </div>
  );
}
