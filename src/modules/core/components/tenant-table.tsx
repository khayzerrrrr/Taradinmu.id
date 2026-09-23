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
import { TenantEditDialog } from "./tenant-edit-dialog";
import { TenantFormDialog } from "./tenant-form-dialog";
import type { PaginationMeta, TenantListItem } from "@/modules/core/types";
import { formatTanggal } from "@/modules/core/utils";

type Props = {
  tenants: TenantListItem[];
  meta: PaginationMeta;
};

export function TenantTable({ tenants, meta }: Props) {
  const router = useRouter();
  const bisaSebelumnya = meta.page > 1;
  const bisaBerikutnya = meta.page < meta.totalPages;

  return (
    <Card className="overflow-hidden p-0">
      <DataTableToolbar aksi={<TenantFormDialog />}>
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
            <TableHead>Dibuat</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tenants.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6}>
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
                  <Badge
                    variant={tenant.plan === "PRO" ? "default" : "secondary"}
                  >
                    {tenant.plan}
                  </Badge>
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
