"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Package, Search } from "lucide-react";
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
import type { StockSummaryItem } from "../types";
import { BatchListDialog } from "./batch-list-dialog";

type Props = {
  items: StockSummaryItem[];
  meta: PaginationMeta;
  search: string;
  /** Fitur batch aktif? Kolom batch & tombol kelola batch hanya tampil bila ya. */
  batchEnabled: boolean;
};

export function StockSummaryTable({
  items,
  meta,
  search,
  batchEnabled,
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

  const bisaSebelumnya = meta.page > 1;
  const bisaBerikutnya = meta.page < meta.totalPages;
  const jumlahKolom = batchEnabled ? 6 : 4;

  return (
    <Card className="overflow-hidden p-0">
      <DataTableToolbar>
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
            placeholder="Cari produk / SKU / varian..."
            className="w-64"
            aria-label="Cari varian"
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
            <TableHead>Varian</TableHead>
            <TableHead className="text-right">Stok Layak</TableHead>
            <TableHead className="text-right">Kedaluwarsa</TableHead>
            {batchEnabled ? <TableHead className="text-right">Batch</TableHead> : null}
            <TableHead>Kedaluwarsa Terdekat</TableHead>
            {batchEnabled ? (
              <TableHead className="text-right">Aksi</TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={jumlahKolom}>
                <EmptyState
                  icon={Package}
                  title="Belum ada varian"
                  description="Stok akan muncul di sini setelah varian ditambahkan."
                />
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.variantId}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{item.variantName}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.productName} · {item.sku}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-medium">
                      {item.nonExpiredQuantity}
                    </span>
                    {item.isLowStock ? (
                      <Badge variant="destructive">STOK MENIPIS</Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {item.expiredQuantity > 0 ? (
                    <Badge variant="destructive">
                      {item.expiredQuantity}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                {batchEnabled ? (
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {item.batchCount}
                  </TableCell>
                ) : null}
                <TableCell>
                  {item.nearestExpiry ? (
                    <span className="flex items-center gap-2">
                      {formatTanggal(item.nearestExpiry)}
                      {item.isExpiringSoon ? (
                        <Badge variant="warning">SEGERA</Badge>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                {batchEnabled ? (
                  <TableCell className="text-right">
                    <BatchListDialog variantId={item.variantId} />
                  </TableCell>
                ) : null}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <p className="text-sm text-muted-foreground">
          {meta.total} varian · halaman {meta.page} dari {meta.totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!bisaSebelumnya}
            onClick={() => bukaUrl({ page: meta.page - 1 })}
          >
            <ChevronLeft />
            Sebelumnya
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!bisaBerikutnya}
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
