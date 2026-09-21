"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, FileText, Search } from "lucide-react";
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
import { deleteInvoice, updateInvoiceStatus } from "../actions/invoice-actions";
import type { InvoiceListItem, InvoiceStatusValue } from "../types";
import {
  formatRupiah,
  INVOICE_STATUS_LABELS,
  transisiBerikutnya,
  type StatusInti,
} from "../utils";
import { InvoiceDetailDialog } from "./invoice-detail-dialog";

type Props = {
  invoices: InvoiceListItem[];
  meta: PaginationMeta;
  search: string;
  status: InvoiceStatusValue | "";
};

const VARIAN_BADGE: Record<InvoiceStatusValue, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "outline",
  SENT: "secondary",
  PAID: "default",
  OVERDUE: "destructive",
};

const LABEL_TOMBOL: Record<StatusInti, string> = {
  DRAFT: "Kembalikan ke Draft",
  SENT: "Tandai Terkirim",
  PAID: "Tandai Lunas",
};

export function InvoiceTable({ invoices, meta, search, status }: Props) {
  const router = useRouter();
  const [kataKunci, setKataKunci] = useState(search);
  const [prosesId, setProsesId] = useState<string | null>(null);

  function bukaUrl(next: { page?: number; search?: string; status?: string }) {
    const params = new URLSearchParams();
    const q = (next.search ?? kataKunci).trim();
    if (q) params.set("search", q);
    const s = next.status ?? status;
    if (s) params.set("status", s);
    const page = next.page ?? 1;
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    router.push(qs ? `?${qs}` : "?");
  }

  async function ubahStatus(invoice: InvoiceListItem, ke: StatusInti) {
    setProsesId(invoice.id);
    const result = await updateInvoiceStatus({ invoiceId: invoice.id, status: ke });
    setProsesId(null);

    if (result.success) {
      toast.success(result.message);
      router.refresh();
      return;
    }
    toast.error(result.message);
  }

  async function hapus(invoice: InvoiceListItem) {
    setProsesId(invoice.id);
    const result = await deleteInvoice({ invoiceId: invoice.id });
    setProsesId(null);

    if (result.success) {
      toast.success(result.message);
      router.refresh();
      return;
    }
    toast.error(result.message);
  }

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
            placeholder="Cari nomor invoice / pelanggan..."
            className="w-60"
            aria-label="Cari invoice"
          />
          <Button type="submit" variant="outline" size="sm">
            <Search />
            Cari
          </Button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {(["", "DRAFT", "SENT", "PAID", "OVERDUE"] as const).map((nilai) => (
            <Button
              key={nilai || "SEMUA"}
              variant={status === nilai ? "default" : "outline"}
              size="sm"
              onClick={() => bukaUrl({ status: nilai, page: 1 })}
            >
              {nilai === "" ? "Semua" : INVOICE_STATUS_LABELS[nilai]}
            </Button>
          ))}
        </div>
      </DataTableToolbar>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nomor</TableHead>
            <TableHead>Pelanggan</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Jatuh Tempo</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6}>
                <EmptyState
                  icon={FileText}
                  title="Belum ada invoice"
                  description="Buat invoice baru untuk memulai pencatatan penjualan."
                />
              </TableCell>
            </TableRow>
          ) : (
            invoices.map((invoice) => {
              const transisi =
                invoice.status === "DRAFT" ||
                invoice.status === "SENT" ||
                invoice.status === "PAID"
                  ? transisiBerikutnya(invoice.status)
                  : [];

              return (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-mono text-xs">
                        {invoice.invoiceNumber}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {invoice.itemCount} item
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{invoice.customerName}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatRupiah(invoice.totalAmount)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <Badge
                        variant={
                          invoice.isOverdue
                            ? "destructive"
                            : VARIAN_BADGE[invoice.status]
                        }
                      >
                        {invoice.isOverdue
                          ? INVOICE_STATUS_LABELS.OVERDUE
                          : INVOICE_STATUS_LABELS[invoice.status]}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatTanggal(invoice.dueDate)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <InvoiceDetailDialog
                        invoiceId={invoice.id}
                        invoiceNumber={invoice.invoiceNumber}
                      />
                      {transisi.map((ke) => (
                        <Button
                          key={ke}
                          variant="outline"
                          size="sm"
                          disabled={prosesId === invoice.id}
                          onClick={() => void ubahStatus(invoice, ke)}
                        >
                          {LABEL_TOMBOL[ke]}
                        </Button>
                      ))}
                      {invoice.status === "DRAFT" ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={prosesId === invoice.id}
                          onClick={() => void hapus(invoice)}
                        >
                          Hapus
                        </Button>
                      ) : null}
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
          {meta.total} invoice · halaman {meta.page} dari {meta.totalPages}
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
