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
import { deleteProgram } from "../actions/program-actions";
import type { ProgramItem } from "../types";

type Props = {
  program: ProgramItem;
  sebutan: string;
};

export function DeleteProgramDialog({ program, sebutan }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const menaut = program.linkedInvoiceCount + program.expenseCount > 0;

  async function onConfirm() {
    setSubmitting(true);
    // `confirmLepas` dikirim true di sini karena dialog inilah tempat jumlah
    // yang akan dilepas tautannya dilaporkan lebih dulu ke pengguna.
    const result = await deleteProgram({
      programId: program.id,
      confirmLepas: true,
    });
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
        <Button variant="ghost" size="sm" disabled={submitting}>
          <Trash2 />
          Hapus
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus {sebutan.toLowerCase()} ini?</AlertDialogTitle>
          <AlertDialogDescription>
            {menaut ? (
              <>
                &ldquo;{program.name}&rdquo; masih menaut{" "}
                {program.linkedInvoiceCount} invoice dan {program.expenseCount}{" "}
                pengeluaran. {" "}
                <strong>Uangnya tidak ikut terhapus</strong> — invoice dan
                pengeluaran itu kembali menjadi data biasa tanpa{" "}
                {sebutan.toLowerCase()}.
              </>
            ) : (
              <>
                &ldquo;{program.name}&rdquo; belum menaut invoice maupun
                pengeluaran, jadi tidak ada data lain yang terpengaruh.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => void onConfirm()}>
            Ya, hapus
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
