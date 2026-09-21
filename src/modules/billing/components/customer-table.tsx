"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
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
import { formatTanggal } from "@/lib/format";
import type { PaginationMeta } from "@/shared/types";
import type { CustomerItem } from "../types";
import { CustomerEditDialog } from "./customer-edit-dialog";
import { CustomerFormDialog } from "./customer-form-dialog";
import { DeleteCustomerDialog } from "./delete-customer-dialog";

type Props = {
  customers: CustomerItem[];
  meta: PaginationMeta;
  search: string;
};

export function CustomerTable({ customers, meta, search }: Props) {
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
      <DataTableToolbar aksi={<CustomerFormDialog />}>
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
            aria-label="Cari pelanggan"
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
            <TableHead>Alamat</TableHead>
            <TableHead className="text-right">Invoice</TableHead>
            <TableHead>Dibuat</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6}>
                <EmptyState
                  icon={Users}
                  title="Belum ada pelanggan"
                  description="Tambahkan data pelanggan untuk mulai membuat invoice."
                  aksi={<CustomerFormDialog />}
                />
              </TableCell>
            </TableRow>
          ) : (
            customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell className="font-medium">{customer.name}</TableCell>
                <TableCell>
                  <div className="flex flex-col text-xs text-muted-foreground">
                    <span>{customer.phone ?? "—"}</span>
                    <span>{customer.email ?? "—"}</span>
                  </div>
                </TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground">
                  {customer.address ?? "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {customer.invoiceCount > 0 ? (
                    <Badge variant="outline">{customer.invoiceCount}</Badge>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatTanggal(customer.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <CustomerEditDialog customer={customer} />
                    <DeleteCustomerDialog customer={customer} />
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <p className="text-sm text-muted-foreground">
          {meta.total} pelanggan · halaman {meta.page} dari {meta.totalPages}
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
