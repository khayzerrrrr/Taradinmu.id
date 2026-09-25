"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Search, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { formatRupiah } from "@/lib/format";
import type { PaginationMeta } from "@/shared/types";
import type { SupplierItem } from "../types";
import { DeleteSupplierDialog } from "./delete-supplier-dialog";
import { SupplierFormDialog } from "./supplier-form-dialog";

type Props = {
  suppliers: SupplierItem[];
  meta: PaginationMeta;
  search: string;
  /** STAFF membaca saja; tambah/ubah/hapus hanya OWNER & ADMIN (PRD 4.G.4). */
  bolehMenulis: boolean;
};

export function SupplierTable({
  suppliers,
  meta,
  search,
  bolehMenulis,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [kataKunci, setKataKunci] = useState(search);

  function bukaUrl(next: { page?: number; search?: string }) {
    const params = new URLSearchParams();
    const q = (next.search ?? kataKunci).trim();
    if (q) params.set("search", q);
    const page = next.page ?? meta.page;
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <Card className="overflow-hidden p-0">
      <DataTableToolbar
        aksi={
          bolehMenulis ? <SupplierFormDialog /> : undefined
        }
      >
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            bukaUrl({ search: kataKunci, page: 1 });
          }}
        >
          <Input
            value={kataKunci}
            onChange={(event) => setKataKunci(event.target.value)}
            placeholder="Cari nama / telepon / email..."
            className="w-60"
            aria-label="Cari pemasok"
          />
          <Button type="submit" variant="outline" size="sm">
            <Search />
            Cari
          </Button>
        </form>
      </DataTableToolbar>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Kontak</TableHead>
            <TableHead className="text-right">Batch</TableHead>
            <TableHead className="text-right">Modal di stok</TableHead>
            <TableHead>Catatan</TableHead>
            {bolehMenulis ? <TableHead className="text-right">Aksi</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={bolehMenulis ? 6 : 5}>
                <EmptyState
                  icon={Truck}
                  title="Belum ada pemasok"
                  description="Catat tempat barang dibeli supaya asal modal stok bisa ditelusuri."
                  aksi={
                    bolehMenulis ? <SupplierFormDialog /> : undefined
                  }
                />
              </TableCell>
            </TableRow>
          ) : (
            suppliers.map((supplier) => (
              <TableRow key={supplier.id}>
                <TableCell className="font-medium">{supplier.name}</TableCell>
                <TableCell>
                  <div className="flex flex-col text-xs text-muted-foreground">
                    <span>{supplier.phone ?? "—"}</span>
                    <span>{supplier.email ?? "—"}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {supplier.batchCount > 0 ? (
                    <Badge variant="outline">{supplier.batchCount}</Badge>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatRupiah(supplier.nilaiModal)}
                </TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground">
                  {supplier.notes ?? supplier.address ?? "—"}
                </TableCell>
                {bolehMenulis ? (
                  <TableCell className="text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <SupplierFormDialog supplier={supplier} />
                      <DeleteSupplierDialog supplier={supplier} />
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <p className="text-sm text-muted-foreground">
          {meta.total} pemasok · halaman {meta.page} dari {meta.totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={meta.page <= 1}
            onClick={() => bukaUrl({ page: meta.page - 1 })}
          >
            <ChevronLeft />
            Sebelumnya
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={meta.page >= meta.totalPages}
            onClick={() => bukaUrl({ page: meta.page + 1 })}
          >
            Berikutnya
            <ChevronRight />
          </Button>
        </div>
      </div>
    </Card>
  );
}
