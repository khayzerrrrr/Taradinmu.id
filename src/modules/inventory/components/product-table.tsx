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
import type { ProductListItem } from "../types";
import { formatRupiah } from "../utils";
import { DeleteProductDialog } from "./delete-product-dialog";
import { ProductEditDialog } from "./product-edit-dialog";
import { ProductFormDialog } from "./product-form-dialog";
import { VariantManagerDialog } from "./variant-manager-dialog";

type Props = {
  products: ProductListItem[];
  meta: PaginationMeta;
  search: string;
};

export function ProductTable({ products, meta, search }: Props) {
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

  return (
    <Card className="overflow-hidden p-0">
      <DataTableToolbar aksi={<ProductFormDialog />}>
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
            placeholder="Cari nama produk..."
            className="w-56"
            aria-label="Cari produk"
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
            <TableHead>Produk</TableHead>
            <TableHead>Varian</TableHead>
            <TableHead>Rentang Harga</TableHead>
            <TableHead>Dibuat</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5}>
                <EmptyState
                  icon={Package}
                  title="Belum ada produk"
                  description="Mulai tambahkan produk untuk mengisi katalog."
                  aksi={<ProductFormDialog />}
                />
              </TableCell>
            </TableRow>
          ) : (
            products.map((product) => {
              const harga = product.variants
                .map((variant) => Number(variant.price))
                .filter((nilai) => Number.isFinite(nilai));
              const termurah = harga.length > 0 ? Math.min(...harga) : null;
              const termahal = harga.length > 0 ? Math.max(...harga) : null;

              return (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="flex max-w-xs flex-col">
                      <span className="font-medium">{product.name}</span>
                      {product.description ? (
                        <span className="truncate text-xs text-muted-foreground">
                          {product.description}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    {product.variants.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        Belum ada
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {product.variants.slice(0, 3).map((variant) => (
                          <Badge key={variant.id} variant="outline">
                            {variant.sku}
                          </Badge>
                        ))}
                        {product.variants.length > 3 ? (
                          <Badge variant="outline">
                            +{product.variants.length - 3}
                          </Badge>
                        ) : null}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {termurah === null || termahal === null
                      ? "-"
                      : termurah === termahal
                        ? formatRupiah(termurah)
                        : `${formatRupiah(termurah)} – ${formatRupiah(termahal)}`}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatTanggal(product.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <VariantManagerDialog product={product} />
                      <ProductEditDialog product={product} />
                      <DeleteProductDialog product={product} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <p className="text-sm text-muted-foreground">
          {meta.total} produk · halaman {meta.page} dari {meta.totalPages}
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
