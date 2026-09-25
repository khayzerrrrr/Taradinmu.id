import { notFound } from "next/navigation";
import { getCurrentTenant } from "@/lib/tenant";
import { requireTenantMember } from "@/lib/tenant-access";
import { getCustomerOptions } from "@/modules/billing/actions/customer-options";
import {
  getInvoices,
  getVariantsForInvoice,
} from "@/modules/billing/actions/invoice-actions";
import { BillingLocked } from "@/modules/billing/components/billing-locked";
import { InvoiceForm } from "@/modules/billing/components/invoice-form";
import { InvoiceTable } from "@/modules/billing/components/invoice-table";
import { listInvoicesSchema } from "@/modules/billing/schemas/invoice-schema";
import type {
  InvoiceListItem,
  InvoiceStatusValue,
  InvoiceVariantOption,
} from "@/modules/billing/types";
import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { UpgradeModal } from "@/components/shared/upgrade-modal";
import { checkLimit } from "@/lib/feature-guards";
import { isModuleEnabled } from "@/shared/modules";
import type { PaginationMeta } from "@/shared/types";

// Halaman utama Modul Billing: buat invoice + kelola status pembayaran.
// Data bergantung sesi & query, jadi selalu dirender per-request.
export const dynamic = "force-dynamic";

function ambilString(nilai: string | string[] | undefined): string | undefined {
  if (typeof nilai === "string") return nilai;
  if (Array.isArray(nilai)) return nilai[0];
  return undefined;
}

function defaultJatuhTempo(): string {
  const tanggal = new Date();
  tanggal.setDate(tanggal.getDate() + 14);
  return tanggal.toISOString().slice(0, 10);
}

export default async function BillingPage({
  searchParams,
}: PageProps<"/[tenantSlug]/dashboard/billing">) {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  // Gate sesi: hanya anggota tenant (atau SUPER_ADMIN) yang boleh melihat.
  await requireTenantMember(tenant);

  // Feature flag (PRD Bagian 6): cek modul sebelum merender UI modul.
  if (!isModuleEnabled(tenant.enabledModules, "BILLING")) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Invoice" />
        <BillingLocked tenantName={tenant.name} />
      </div>
    );
  }

  const params = await searchParams;
  const parsed = listInvoicesSchema.safeParse({
    page: ambilString(params.page),
    perPage: ambilString(params.perPage),
    search: ambilString(params.search),
    status: ambilString(params.status),
  });
  const input = parsed.success
    ? parsed.data
    : { page: 1, perPage: 10, search: undefined, status: undefined };

  const [invoicesRes, variantsRes, customersRes] = await Promise.all([
    getInvoices(input),
    getVariantsForInvoice(),
    getCustomerOptions(),
  ]);

  const invoices: InvoiceListItem[] = invoicesRes.data?.invoices ?? [];
  const meta: PaginationMeta = invoicesRes.data?.meta ?? {
    page: 1,
    perPage: 10,
    total: 0,
    totalPages: 1,
  };
  const variants: InvoiceVariantOption[] = variantsRes.data ?? [];
  const customers = customersRes.data ?? [];

  // Batas paket (PRD 4.D): FREE maksimal 50 invoice PER BULAN, dihitung dari
  // invoice bulan berjalan saja. Karena kontrol "buat" di halaman ini berupa kartu
  // besar (bukan tombol di toolbar), penggantian ke ajakan upgrade dilakukan di
  // sini — bukan di dalam tabel seperti pola halaman Pengguna.
  const kuotaInvoice = await checkLimit(tenant.id, "INVOICE");
  const bolehBuatInvoice = kuotaInvoice.allowed;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Invoice"
        description={`Buat invoice (stok langsung dipotong FEFO) dan kelola status pembayaran untuk ${tenant.name}.`}
      />

      {!invoicesRes.success ? (
        <p className="text-sm text-destructive">{invoicesRes.message}</p>
      ) : null}

      {bolehBuatInvoice ? (
        <>
          {kuotaInvoice.limit === null ? null : (
            <p className="text-sm text-muted-foreground">
              Kuota bulan ini: {kuotaInvoice.used ?? 0} dari {kuotaInvoice.limit}{" "}
              invoice terpakai. Kuota dihitung ulang setiap awal bulan.
            </p>
          )}
          <InvoiceForm
            customers={customers}
            variants={variants}
            defaultDueDate={defaultJatuhTempo()}
          />
        </>
      ) : (
        <Card className="max-w-4xl">
          <CardHeader>
            <CardTitle>Kuota invoice bulan ini tercapai</CardTitle>
            <CardDescription>
              Paket {tenant.plan} dibatasi {kuotaInvoice.limit} invoice per bulan.
              Kuota tersedia kembali pada awal bulan berikutnya — atau tanpa batas
              sama sekali dengan paket PRO.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UpgradeModal fitur="Invoice tanpa batas" kunci="INVOICE">
              <Button size="lg">
                <Crown />
                Buka Invoice Tanpa Batas
              </Button>
            </UpgradeModal>
          </CardContent>
        </Card>
      )}

      <InvoiceTable
        invoices={invoices}
        meta={meta}
        search={input.search ?? ""}
        status={(input.status ?? "") as InvoiceStatusValue | ""}
      />
    </div>
  );
}
