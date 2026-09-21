"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Boxes } from "lucide-react";
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
import { getVariantBatches } from "../actions/stock-actions";
import type { BatchItem } from "../types";

type Props = {
  variantId: string;
  label?: string;
};

// Daftar batch satu varian — batch pertama adalah yang akan dipakai FEFO lebih dulu.
export function BatchListDialog({ variantId, label = "Lihat batch" }: Props) {
  const [open, setOpen] = useState(false);
  const [memuat, setMemuat] = useState(false);
  const [batches, setBatches] = useState<BatchItem[]>([]);

  async function muatBatch() {
    setMemuat(true);
    const result = await getVariantBatches(variantId);
    setMemuat(false);

    if (result.success && result.data) {
      setBatches(result.data);
      return;
    }
    toast.error(result.message);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void muatBatch();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Boxes />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Daftar Batch</DialogTitle>
          <DialogDescription>
            Urut sesuai prioritas FEFO (kedaluwarsa terdekat lebih dulu).
            Batch kedaluwarsa tidak ikut keluar.
          </DialogDescription>
        </DialogHeader>

        {memuat ? (
          <p className="text-sm text-muted-foreground">Memuat batch...</p>
        ) : batches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada batch untuk varian ini.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Nomor Batch</TableHead>
                  <TableHead className="text-right">Stok</TableHead>
                  <TableHead>Kedaluwarsa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch, index) => (
                  <TableRow key={batch.id}>
                    <TableCell className="text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {batch.batchNumber}
                    </TableCell>
                    <TableCell className="text-right">
                      {batch.quantity}
                    </TableCell>
                    <TableCell>
                      {batch.expiredDate ? (
                        <span className="flex items-center gap-2">
                          {formatTanggal(batch.expiredDate)}
                          {batch.isExpired ? (
                            <Badge variant="destructive">KEDALUWARSA</Badge>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
