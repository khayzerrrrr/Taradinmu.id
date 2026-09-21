"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { createExpense, updateExpense } from "../actions/expense-actions";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORY_VALUES,
} from "../expense-categories";
import {
  createExpenseSchema,
  type CreateExpenseFormValues,
} from "../schemas/expense-schema";
import type { ExpenseItem } from "../types";

type Props = {
  /** Bila diisi, dialog berjalan dalam mode ubah. */
  expense?: ExpenseItem;
};

function hariIni(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ExpenseFormDialog({ expense }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const modeUbah = Boolean(expense);

  const form = useForm<CreateExpenseFormValues>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: {
      category: expense?.category ?? "OTHER",
      description: expense?.description ?? "",
      amount: expense?.amount ?? "",
      expenseDate: expense?.expenseDate.slice(0, 10) ?? hariIni(),
      paymentMethod: expense?.paymentMethod ?? "",
      reference: expense?.reference ?? "",
      notes: expense?.notes ?? "",
    },
  });

  const { errors } = form.formState;
  const category = useWatch({ control: form.control, name: "category" });

  async function onSubmit(values: CreateExpenseFormValues) {
    setSubmitting(true);
    const result = expense
      ? await updateExpense({ ...values, expenseId: expense.id })
      : await createExpense(values);
    setSubmitting(false);

    if (result.success) {
      toast.success(result.message);
      if (!modeUbah) form.reset();
      setOpen(false);
      router.refresh();
      return;
    }
    toast.error(result.message);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {modeUbah ? (
          <Button variant="outline" size="sm">
            <Pencil />
            Ubah
          </Button>
        ) : (
          <Button>
            <Plus />
            Tambah Pengeluaran
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {modeUbah ? "Ubah Pengeluaran" : "Tambah Pengeluaran"}
          </DialogTitle>
          <DialogDescription>
            Catat pengeluaran usaha beserta kategori dan tanggalnya.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-6"
        >
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.category)}>
                <FieldLabel>Kategori</FieldLabel>
                <Select
                  value={category}
                  onValueChange={(value) =>
                    form.setValue("category", value as typeof category, {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORY_VALUES.map((nilai) => (
                      <SelectItem key={nilai} value={nilai}>
                        {EXPENSE_CATEGORY_LABELS[nilai]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={[errors.category]} />
              </Field>

              <Field data-invalid={Boolean(errors.expenseDate)}>
                <FieldLabel htmlFor="expenseDate">Tanggal</FieldLabel>
                <Input
                  id="expenseDate"
                  type="date"
                  {...form.register("expenseDate")}
                />
                <FieldError errors={[errors.expenseDate]} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.amount)}>
                <FieldLabel htmlFor="amount">Nominal (Rp)</FieldLabel>
                <Input
                  id="amount"
                  inputMode="decimal"
                  placeholder="150000"
                  className="tabular-nums"
                  {...form.register("amount")}
                />
                <FieldError errors={[errors.amount]} />
              </Field>

              <Field data-invalid={Boolean(errors.description)}>
                <FieldLabel htmlFor="description">Keterangan</FieldLabel>
                <Input
                  id="description"
                  placeholder="Pembelian kemasan"
                  {...form.register("description")}
                />
                <FieldError errors={[errors.description]} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.paymentMethod)}>
                <FieldLabel htmlFor="paymentMethod">
                  Metode (opsional)
                </FieldLabel>
                <Input
                  id="paymentMethod"
                  placeholder="Tunai / Transfer"
                  {...form.register("paymentMethod")}
                />
                <FieldError errors={[errors.paymentMethod]} />
              </Field>

              <Field data-invalid={Boolean(errors.reference)}>
                <FieldLabel htmlFor="reference">Referensi (opsional)</FieldLabel>
                <Input
                  id="reference"
                  placeholder="NOTA-001"
                  {...form.register("reference")}
                />
                <FieldError errors={[errors.reference]} />
              </Field>
            </div>

            <Field data-invalid={Boolean(errors.notes)}>
              <FieldLabel htmlFor="expenseNotes">Catatan (opsional)</FieldLabel>
              <Textarea
                id="expenseNotes"
                placeholder="Catatan tambahan"
                {...form.register("notes")}
              />
              <FieldDescription>
                Nominal dicatat dalam Rupiah; pajak/PPN tidak dipisahkan di sini.
              </FieldDescription>
              <FieldError errors={[errors.notes]} />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
