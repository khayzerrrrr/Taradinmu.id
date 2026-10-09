"use client";

import { useRouter } from "next/navigation";
import { Building2, ChevronLeft, ChevronRight } from "lucide-react";
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
import { DataTableToolbar } from "@/components/shared/data-table-toolbar";
import { EmptyState } from "@/components/shared/empty-state";
import { ImpersonateTenantDialog } from "./impersonate-tenant-dialog";
import { ResetSandiAkunDialog } from "./reset-sandi-akun-dialog";
import { TenantEditDialog } from "./tenant-edit-dialog";
import { TenantFormDialog } from "./tenant-form-dialog";
import type { PaginationMeta, TenantListItem } from "@/modules/core/types";
import { JENDELA_MINAT_HARI } from "@/lib/upgrade-interest";
import { susunMasaBerlaku } from "@/lib/plan-status";
import { MasaBerlakuPaketNotice } from "@/components/shared/masa-berlaku-paket";
import { formatTanggal } from "@/modules/core/utils";

type Props = {
  tenants: TenantListItem[];
  meta: PaginationMeta;
};

// Tanggal berakhir datang sebagai string ISO (serialisasi untuk klien). Nilai
// itu dikembalikan ke Date di sini supaya penilaiannya memakai fungsi yang sama
// dengan yang dibaca penyewa di halaman paketnya — dua permukaan, satu aturan.
function masaBerlakuTenant(tenant: TenantListItem) {
  return susunMasaBerlaku(
    tenant.plan,
    tenant.planExpiresAt ? new Date(tenant.planExpiresAt) : null,
  );
}

export function TenantTable({ tenants, meta }: Props) {
  const router = useRouter();
  const bisaSebelumnya = meta.page > 1;
  const bisaBerikutnya = meta.page < meta.totalPages;

  return (
    <Card className="overflow-hidden p-0">
      <DataTableToolbar
        aksi={
          <>
            <ResetSandiAkunDialog />
            <TenantFormDialog />
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          {meta.total} tenant terdaftar
        </p>
      </DataTableToolbar>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usaha</TableHead>
            <TableHead>Paket</TableHead>
            <TableHead>Modul Aktif</TableHead>
            <TableHead className="text-center">Pengguna</TableHead>
            <TableHead
              title={`Gembok yang diklik ${JENDELA_MINAT_HARI} hari terakhir (PRD 4.D.5)`}
            >
              Minat PRO
            </TableHead>
            <TableHead>Dibuat</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tenants.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7}>
                <EmptyState
                  icon={Building2}
                  title="Belum ada tenant"
                  description="Provisioning tenant baru untuk memulai."
                  aksi={<TenantFormDialog />}
                />
              </TableCell>
            </TableRow>
          ) : (
            tenants.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{tenant.name}</span>
                    <span className="text-xs text-muted-foreground">
                      /{tenant.slug}
                      {tenant.subdomain
                        ? ` · ${tenant.subdomain}.taradinmu.id`
                        : ""}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Badge
                      variant={tenant.plan === "PRO" ? "default" : "secondary"}
                      className="self-start"
                    >
                      {tenant.plan}
                    </Badge>
                    <MasaBerlakuPaketNotice masa={masaBerlakuTenant(tenant)} />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {tenant.enabledModules.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        Tidak ada
                      </span>
                    ) : (
                      tenant.enabledModules.map((modul) => (
                        <Badge key={modul} variant="outline">
                          {modul}
                        </Badge>
                      ))
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center tabular-nums">
                  {tenant.userCount}
                </TableCell>
                <TableCell>
                  {tenant.minat.buka === 0 && tenant.minat.cta === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      belum ada
                    </span>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm tabular-nums">
                        {tenant.minat.buka} dibuka
                        {tenant.minat.cta > 0
                          ? ` · ${tenant.minat.cta} klik WhatsApp`
                          : ""}
                      </span>
                      {tenant.minat.kunci.length > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {tenant.minat.kunci.join(", ")}
                        </span>
                      ) : null}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatTanggal(tenant.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <ImpersonateTenantDialog tenant={tenant} />
                    <TenantEditDialog tenant={tenant} />
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <p className="text-sm text-muted-foreground">
          Halaman {meta.page} dari {meta.totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!bisaSebelumnya}
            onClick={() =>
              router.push(`/admin?page=${meta.page - 1}`)
            }
          >
            <ChevronLeft />
            Sebelumnya
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!bisaBerikutnya}
            onClick={() => router.push(`/admin?page=${meta.page + 1}`)}
          >
            Berikutnya
            <ChevronRight />
          </Button>
        </div>
      </div>
    </Card>
  );
}
