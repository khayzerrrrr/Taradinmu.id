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
import { deleteExpense } from "../actions/expense-actions";
import type { ExpenseItem } from "../types";

type Props = {
  expense: ExpenseItem;
};

export function DeleteExpenseDialog({ expense }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function onConfirm() {
    setSubmitting(true);
    const result = await deleteExpense({ expenseId: expense.id });
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
          <AlertDialogTitle>Hapus pengeluaran ini?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{expense.description}&rdquo; akan dihapus permanen. Tindakan
            ini tidak bisa dibatalkan.
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
