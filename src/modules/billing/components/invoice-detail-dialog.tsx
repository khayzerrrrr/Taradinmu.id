"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTanggal } from "@/lib/format";
import { getInvoiceDetail } from "../actions/invoice-actions";
import type { InvoiceDetail } from "../types";
import { formatRupiah, INVOICE_STATUS_LABELS } from "../utils";

type Props = {
  invoiceId: string;
  invoiceNumber: string;
};

export function InvoiceDetailDialog({ invoiceId, invoiceNumber }: Props) {
  const [open, setOpen] = useState(false);
  const [memuat, setMemuat] = useState(false);
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);

  async function muatDetail() {
    setMemuat(true);
    const result = await getInvoiceDetail(invoiceId);
    setMemuat(false);

    if (result.success && result.data) {
      setDetail(result.data);
      return;
    }
    toast.error(result.message);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void muatDetail();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Eye />
          Detail
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Invoice {invoiceNumber}</DialogTitle>
          <DialogDescription>
            {detail
              ? `${detail.customer.name} · jatuh tempo ${formatTanggal(detail.dueDate)}`
              : "Memuat detail invoice..."}
          </DialogDescription>
        </DialogHeader>

        {memuat ? (
          <p className="text-sm text-muted-foreground">Memuat...</p>
        ) : !detail ? (
          <p className="text-sm text-muted-foreground">Detail tidak tersedia.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Badge
                variant={detail.isOverdue ? "destructive" : "outline"}
              >
                {detail.isOverdue
                  ? INVOICE_STATUS_LABELS.OVERDUE
                  : INVOICE_STATUS_LABELS[detail.status]}
              </Badge>
              {detail.customer.phone ? (
                <span className="text-sm text-muted-foreground">
                  {detail.customer.phone}
                </span>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Varian</TableHead>
                    <TableHead className="text-right tabular-nums">Harga</TableHead>
                    <TableHead className="text-right tabular-nums">Qty</TableHead>
                    <TableHead className="text-right tabular-nums">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{item.variantName}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {item.sku}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatRupiah(item.price)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatRupiah(item.subtotal)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col items-end gap-1 border-t border-border pt-3 text-sm">
              <span className="text-muted-foreground">
                PPN: {formatRupiah(detail.taxAmount)}
              </span>
              <span className="font-medium tabular-nums">
                Total: {formatRupiah(detail.totalAmount)}
              </span>

              {/* Laporan HPP dokumen (PRD 4.G.5). `null` = paket tenant ini tidak
                  menyertainya; angkanya memang tidak dikirim dari server. */}
              {detail.laporanHpp ? (
                <>
                  <span className="mt-1 text-muted-foreground tabular-nums">
                    HPP barang keluar: {formatRupiah(detail.laporanHpp.hpp)}
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    Laba kotor: {formatRupiah(detail.laporanHpp.labaKotor)}
                  </span>
                  {detail.laporanHpp.unitModalBelumTercatat > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {detail.laporanHpp.unitModalBelumTercatat} unit keluar tanpa
                      harga modal — HPP di atas belum penuh (PRD 4.G.6).
                    </span>
                  ) : null}
                </>
              ) : null}
            </div>

            {detail.notes ? (
              <p className="text-sm text-muted-foreground">{detail.notes}</p>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
