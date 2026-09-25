"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteSupplier } from "../actions/supplier-actions";
import type { SupplierItem } from "../types";

type Props = {
  supplier: SupplierItem;
};

export function DeleteSupplierDialog({ supplier }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function onConfirm() {
    setSubmitting(true);
    const result = await deleteSupplier({ supplierId: supplier.id });
    setSubmitting(false);

    if (result.success) {
      toast.success(result.message);
      router.refresh();
      return;
    }
    toast.error(result.message);
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={submitting}>
          <Trash2 />
          Hapus
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus pemasok ini?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{supplier.name}&rdquo; akan dihapus permanen.
            {supplier.batchCount > 0
              ? ` ${supplier.batchCount} batch stok yang tercatat berasal darinya TIDAK ikut terhapus — hanya penanda asalnya yang lepas, sehingga riwayat harga modalnya tetap ada.`
              : " Belum ada batch stok yang menunjuk pemasok ini."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => void onConfirm()}
          >
            Ya, hapus
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
