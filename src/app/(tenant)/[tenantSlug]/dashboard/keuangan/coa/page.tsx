import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRupiah } from "@/lib/format";
import { getCurrentTenant } from "@/lib/tenant";
import { requireTenantMember } from "@/lib/tenant-access";
import { daftarAkun } from "@/modules/accounting/akun-kueri";
import { KeuanganLocked } from "@/modules/core/components/keuangan-locked";
import { isModuleEnabled } from "@/shared/modules";
// Halaman Bagan Akun (CoA) - Fase 1, PRD 4 F1.11.
// Data bergantung sesi & tenant, jadi selalu dirender per-request.
export const dynamic = "force-dynamic";

// Nama tipe akun dalam bahasa Indonesia; kunci mengikuti enum AccountType.
const LABEL_TIPE: Record<string, string> = {
  ASSET: "Aset",
  LIABILITY: "Liabilitas",
  EQUITY: "Modal",
  REVENUE: "Pendapatan",
  EXPENSE: "Beban",
};

export default async function CoaPage() {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  // Gate sesi: hanya anggota tenant (atau SUPER_ADMIN) yang boleh melihat.
  await requireTenantMember(tenant);

  // Feature flag (PRD Bagian 6): modul akuntansi harus aktif.
  if (!isModuleEnabled(tenant.enabledModules, "ACCOUNTING")) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Bagan Akun (CoA)" />
        <KeuanganLocked tenantName={tenant.name} />
      </div>
    );
  }
  const akun = await daftarAkun(tenant.id);
  const totalDebit = akun.reduce((n, a) => n + a.debit, 0);
  const totalKredit = akun.reduce((n, a) => n + a.kredit, 0);
  const totalSaldo = akun.reduce((n, a) => n + a.saldo, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bagan Akun (CoA)"
        description={`Daftar akun buku besar ${tenant.name} beserta saldonya.`}
      />

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kode</TableHead>
              <TableHead>Nama Akun</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Kredit</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {akun.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-muted-foreground"
                >
                  Belum ada akun pada tenant ini.
                </TableCell>
              </TableRow>
            ) : (
              akun.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium tabular-nums">
                    {a.kode}
                  </TableCell>
                  <TableCell>{a.nama}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {LABEL_TIPE[a.tipe] ?? a.tipe}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatRupiah(a.debit)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatRupiah(a.kredit)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatRupiah(a.saldo)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {akun.length > 0 ? (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3}>Total</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatRupiah(totalDebit)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatRupiah(totalKredit)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatRupiah(totalSaldo)}
                </TableCell>
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </Card>
    </div>
  );
}