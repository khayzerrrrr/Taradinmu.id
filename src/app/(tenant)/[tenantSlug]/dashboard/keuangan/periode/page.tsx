import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatWaktu } from "@/lib/format";
import { getCurrentTenant } from "@/lib/tenant";
import { requireTenantMember } from "@/lib/tenant-access";
import { KeuanganLocked } from "@/modules/core/components/keuangan-locked";
import {
  bukaPeriode,
  daftarPeriode,
  tutupPeriode,
} from "@/modules/accounting/period-actions";
import { isModuleEnabled } from "@/shared/modules";

export const dynamic = "force-dynamic";

export default async function PeriodePage() {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  await requireTenantMember(tenant);

  if (!isModuleEnabled(tenant.enabledModules, "ACCOUNTING")) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Periode" />
        <KeuanganLocked tenantName={tenant.name} />
      </div>
    );
  }

  const daftar = await daftarPeriode();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Periode"
        description={`Kelola status periode akuntansi ${tenant.name}.`}
      />

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Periode</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ditutup pada</TableHead>
              <TableHead className="text-right">Tindakan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {daftar.map((p) => (
              <TableRow key={p.periode}>
                <TableCell className="font-medium tabular-nums">
                  {p.periode}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={p.status === "CLOSED" ? "secondary" : "outline"}
                  >
                    {p.status === "CLOSED" ? "Ditutup" : "Terbuka"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {p.closedAt ? formatWaktu(new Date(p.closedAt)) : "-"}
                </TableCell>
                <TableCell className="flex justify-end gap-2">
                  {p.status === "OPEN" ? (
                    <form action={async () => {
                      "use server";
                      const r = await tutupPeriode(p.periode);
                      if (!r.ok) return;
                      revalidatePath("/dashboard/keuangan/periode");
                    }}>
                      <Button size="sm" type="submit">
                        Tutup Periode
                      </Button>
                    </form>
                  ) : (
                    <form action={async () => {
                      "use server";
                      const r = await bukaPeriode(p.periode);
                      if (!r.ok) return;
                      revalidatePath("/dashboard/keuangan/periode");
                    }}>
                      <Button size="sm" variant="outline" type="submit">
                        Buka Periode
                      </Button>
                    </form>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}