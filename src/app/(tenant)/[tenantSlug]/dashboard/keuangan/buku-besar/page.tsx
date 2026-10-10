import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { getCurrentTenant } from "@/lib/tenant";
import { requireTenantMember } from "@/lib/tenant-access";
import {
  daftarAkun,
  labelSumberJurnal,
  mutasiAkun,
} from "@/modules/accounting/akun-kueri";
import { KeuanganLocked } from "@/modules/core/components/keuangan-locked";
import { isModuleEnabled } from "@/shared/modules";
// Halaman Buku Besar: mutasi satu akun pada satu periode (Fase 1, PRD 4 F1.11).
// Data bergantung sesi & query, jadi selalu dirender per-request.
export const dynamic = "force-dynamic";

const POLA_PERIODE = /^\d{4}-\d{2}$/;

function ambilString(nilai: string | string[] | undefined): string | undefined {
  if (typeof nilai === "string") return nilai;
  if (Array.isArray(nilai)) return nilai[0];
  return undefined;
}

// Bulan berjalan dalam bentuk "YYYY-MM" (UTC), dipakai bila periode kosong.
function bulanSekarang(): string {
  const sekarang = new Date();
  const bulan = String(sekarang.getUTCMonth() + 1).padStart(2, "0");
  return `${sekarang.getUTCFullYear()}-${bulan}`;
}
export default async function BukuBesarPage({
  searchParams,
}: PageProps<"/[tenantSlug]/dashboard/keuangan/buku-besar">) {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();

  // Gate sesi: hanya anggota tenant (atau SUPER_ADMIN) yang boleh melihat.
  await requireTenantMember(tenant);

  // Feature flag (PRD Bagian 6): modul akuntansi harus aktif.
  if (!isModuleEnabled(tenant.enabledModules, "ACCOUNTING")) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Buku Besar" />
        <KeuanganLocked tenantName={tenant.name} />
      </div>
    );
  }
  const params = await searchParams;
  const akun = await daftarAkun(tenant.id);
  const accountId = ambilString(params.accountId) ?? akun[0]?.id ?? "";
  const periodeParam = ambilString(params.periode);
  const periode =
    periodeParam && POLA_PERIODE.test(periodeParam)
      ? periodeParam
      : bulanSekarang();

  // Rentang [awal bulan, awal bulan berikutnya): jurnal tepat di batas akhir
  // bulan tidak ikut terhitung - konvensi yang sama dengan batasPeriode.
  const [tahun, bulan] = periode.split("-").map(Number);
  const dari = new Date(`${periode}-01T00:00:00Z`);
  const sampai = new Date(Date.UTC(tahun, bulan, 1));

  const mutasi = accountId
    ? await mutasiAkun(tenant.id, accountId, dari, sampai)
    : [];
  const akunTerpilih = akun.find((a) => a.id === accountId) ?? null;
  const totalDebit = mutasi.reduce(
    (n, m) => n + (m.sisi === "DEBIT" ? m.nominal : 0),
    0,
  );
  const totalKredit = mutasi.reduce(
    (n, m) => n + (m.sisi === "CREDIT" ? m.nominal : 0),
    0,
  );
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Buku Besar"
        description={`Mutasi satu akun pada satu periode untuk ${tenant.name}.`}
      />

      <Card className="p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Akun</span>
            <select
              name="accountId"
              defaultValue={accountId}
              className="h-9 min-w-64 rounded-md border border-input bg-transparent px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {akun.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.kode} - {a.nama}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Periode</span>
            <Input
              type="month"
              name="periode"
              defaultValue={periode}
              className="w-44"
            />
          </label>

          <Button type="submit">Tampilkan</Button>
        </form>
      </Card>

      {akun.length === 0 ? (
        <Card>
          <EmptyState
            title="Belum ada akun"
            description="Bagan akun (CoA) tenant ini masih kosong, jadi belum ada mutasi yang bisa ditampilkan."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Sumber</TableHead>
                <TableHead>Referensi</TableHead>
                <TableHead>Deskripsi</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Kredit</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mutasi.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-muted-foreground"
                  >
                    Tidak ada mutasi untuk {akunTerpilih?.kode ?? "-"} pada
                    periode {periode}.
                  </TableCell>
                </TableRow>
              ) : (
                mutasi.map((m) => (
                  <TableRow key={m.idPosting}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatTanggal(m.businessDate)}
                    </TableCell>
                    <TableCell>{labelSumberJurnal(m.source)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {m.reference ?? "-"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {m.deskripsi ?? "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.sisi === "DEBIT" ? formatRupiah(m.nominal) : "-"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.sisi === "CREDIT" ? formatRupiah(m.nominal) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatRupiah(m.saldo)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {mutasi.length > 0 ? (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4}>Total</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatRupiah(totalDebit)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatRupiah(totalKredit)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatRupiah(mutasi[mutasi.length - 1].saldo)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            ) : null}
          </Table>
        </Card>
      )}
    </div>
  );
}
