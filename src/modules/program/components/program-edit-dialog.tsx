"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { updateProgram } from "../actions/program-actions";
import {
  type UpdateProgramFormValues,
  updateProgramSchema,
} from "../schemas/program-schema";
import type { ProgramItem, ProgramStatusValue } from "../types";
import { LABEL_STATUS, langkahStatusBerikut } from "../utils";

type Props = {
  program: ProgramItem;
  sebutan: string;
};

export function ProgramEditDialog({ program, sebutan }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<UpdateProgramFormValues>({
    resolver: zodResolver(updateProgramSchema),
    defaultValues: {
      programId: program.id,
      name: program.name,
      description: program.description ?? "",
      startDate: program.startDate,
      endDate: program.endDate ?? "",
      targetAmount: program.targetAmount ?? "",
      budgetAmount: program.budgetAmount ?? "",
      status: program.status,
    },
  });

  const { errors } = form.formState;
  // useWatch (bukan form.watch) agar React Compiler tidak melewati memo
  // komponen ini — konvensi yang sama dengan user-edit-dialog.tsx.
  const status = useWatch({ control: form.control, name: "status" });
  // Hanya lanjutan sah yang ditawarkan (PRD 4.F.5). Status saat ini selalu ada
  // agar pengguna yang membuka form tanpa niat mengubah status tidak dipaksa.
  const opsiStatus: ProgramStatusValue[] = [
    program.status,
    ...langkahStatusBerikut(program.status),
  ];

  async function onSubmit(values: UpdateProgramFormValues) {
    setSubmitting(true);
    const result = await updateProgram({ ...values, programId: program.id });
    setSubmitting(false);

    if (result.success) {
      toast.success(result.message);
      setOpen(false);
      router.refresh();
      return;
    }
    toast.error(result.message);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Pencil />
          Ubah
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ubah {sebutan}</DialogTitle>
          <DialogDescription>
            Mengubah nama atau tanggal tidak mengubah angka uang yang sudah
            tertaut.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor={`edit-name-${program.id}`}>
                Nama {sebutan}
              </FieldLabel>
              <Input
                id={`edit-name-${program.id}`}
                {...form.register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field data-invalid={Boolean(errors.status)}>
              <FieldLabel htmlFor={`edit-status-${program.id}`}>Status</FieldLabel>
              <Select
                value={status}
                onValueChange={(value) =>
                  form.setValue("status", value as ProgramStatusValue, {
                    shouldDirty: true,
                  })
                }
              >
                <SelectTrigger id={`edit-status-${program.id}`} className="w-full">
                  <SelectValue placeholder="Pilih status" />
                </SelectTrigger>
                <SelectContent>
                  {opsiStatus.map((nilai) => (
                    <SelectItem key={nilai} value={nilai}>
                      {LABEL_STATUS[nilai]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {langkahStatusBerikut(program.status).length === 0 ? (
                <FieldDescription>
                  Program yang sudah {LABEL_STATUS[program.status].toLowerCase()}{" "}
                  tidak dibuka kembali lewat form ini.
                </FieldDescription>
              ) : null}
              <FieldError errors={[errors.status]} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.startDate)}>
                <FieldLabel htmlFor={`edit-start-${program.id}`}>
                  Tanggal mulai
                </FieldLabel>
                <Input
                  id={`edit-start-${program.id}`}
                  type="date"
                  {...form.register("startDate")}
                />
                <FieldError errors={[errors.startDate]} />
              </Field>
              <Field data-invalid={Boolean(errors.endDate)}>
                <FieldLabel htmlFor={`edit-end-${program.id}`}>
                  Tanggal selesai (opsional)
                </FieldLabel>
                <Input
                  id={`edit-end-${program.id}`}
                  type="date"
                  {...form.register("endDate")}
                />
                <FieldError errors={[errors.endDate]} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.targetAmount)}>
                <FieldLabel htmlFor={`edit-target-${program.id}`}>
                  Target dana masuk
                </FieldLabel>
                <Input
                  id={`edit-target-${program.id}`}
                  inputMode="numeric"
                  {...form.register("targetAmount")}
                />
                <FieldError errors={[errors.targetAmount]} />
              </Field>
              <Field data-invalid={Boolean(errors.budgetAmount)}>
                <FieldLabel htmlFor={`edit-budget-${program.id}`}>
                  Anggaran keluar
                </FieldLabel>
                <Input
                  id={`edit-budget-${program.id}`}
                  inputMode="numeric"
                  {...form.register("budgetAmount")}
                />
                <FieldError errors={[errors.budgetAmount]} />
              </Field>
            </div>

            <Field data-invalid={Boolean(errors.description)}>
              <FieldLabel htmlFor={`edit-description-${program.id}`}>
                Keterangan
              </FieldLabel>
              <Textarea
                id={`edit-description-${program.id}`}
                {...form.register("description")}
              />
              <FieldError errors={[errors.description]} />
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
