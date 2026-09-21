"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Receipt, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { formatRupiah, formatTanggal } from "@/lib/format";
import type { PaginationMeta } from "@/shared/types";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORY_VALUES,
} from "../expense-categories";
import type { ExpenseItem } from "../types";
import { DeleteExpenseDialog } from "./delete-expense-dialog";
import { ExpenseFormDialog } from "./expense-form-dialog";

type Props = {
  expenses: ExpenseItem[];
  meta: PaginationMeta;
  search: string;
  category: string;
};

const SEMUA = "ALL";

export function ExpenseTable({ expenses, meta, search, category }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [kataKunci, setKataKunci] = useState(search);

  function bukaUrl(next: { page?: number; search?: string; category?: string }) {
    const params = new URLSearchParams();
    const q = (next.search ?? kataKunci).trim();
    if (q) params.set("search", q);
    const c = next.category ?? category;
    if (c) params.set("category", c);
    const page = next.page ?? 1;
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const bisaSebelumnya = meta.page > 1;
  const bisaBerikutnya = meta.page < meta.totalPages;

  return (
    <Card className="overflow-hidden p-0">
      <DataTableToolbar aksi={<ExpenseFormDialog />}>
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
            placeholder="Cari keterangan / referensi..."
            className="w-56"
            aria-label="Cari pengeluaran"
          />
          <Button type="submit" variant="outline" size="sm">
            <Search />
            Cari
          </Button>
        </form>

        <Select
          value={category || SEMUA}
          onValueChange={(value) =>
            bukaUrl({ category: value === SEMUA ? "" : value, page: 1 })
          }
        >
          <SelectTrigger size="sm" aria-label="Filter kategori">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SEMUA}>Semua kategori</SelectItem>
            {EXPENSE_CATEGORY_VALUES.map((nilai) => (
              <SelectItem key={nilai} value={nilai}>
                {EXPENSE_CATEGORY_LABELS[nilai]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </DataTableToolbar>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tanggal</TableHead>
            <TableHead>Kategori</TableHead>
            <TableHead>Keterangan</TableHead>
            <TableHead className="text-right">Nominal</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5}>
                <EmptyState
                  icon={Receipt}
                  title="Belum ada pengeluaran"
                  description="Catat pengeluaran usaha untuk melihat ringkasannya di sini."
                  aksi={<ExpenseFormDialog />}
                />
              </TableCell>
            </TableRow>
          ) : (
            expenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatTanggal(expense.expenseDate)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {EXPENSE_CATEGORY_LABELS[expense.category]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex max-w-xs flex-col">
                    <span className="font-medium">{expense.description}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {[expense.paymentMethod, expense.reference]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatRupiah(expense.amount)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <ExpenseFormDialog expense={expense} />
                    <DeleteExpenseDialog expense={expense} />
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <p className="text-sm text-muted-foreground">
          {meta.total} pengeluaran · halaman {meta.page} dari {meta.totalPages}
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
