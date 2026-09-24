"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { createProgram } from "../actions/program-actions";
import {
  createProgramSchema,
  type CreateProgramFormValues,
} from "../schemas/program-schema";

type Props = {
  /** Sebutan industri: "Kloter", "Proyek", "Tahun Ajaran"... (PRD 4.F.4). */
  sebutan: string;
};

export function ProgramFormDialog({ sebutan }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<CreateProgramFormValues>({
    resolver: zodResolver(createProgramSchema),
    defaultValues: {
      name: "",
      description: "",
      startDate: "",
      endDate: "",
      targetAmount: "",
      budgetAmount: "",
    },
  });

  const { errors } = form.formState;

  async function onSubmit(values: CreateProgramFormValues) {
    setSubmitting(true);
    const result = await createProgram(values);
    setSubmitting(false);

    if (result.success) {
      toast.success(result.message);
      form.reset();
      setOpen(false);
      router.refresh();
      return;
    }
    toast.error(result.message);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Tambah {sebutan}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah {sebutan}</DialogTitle>
          <DialogDescription>
            Satu {sebutan} mengumpulkan tagihan dan pengeluaran yang sama. Angka
            uang tetap dicatat di Invoice dan Pengeluaran — {sebutan} hanya
            menautnya.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="program-name">Nama {sebutan}</FieldLabel>
              <Input
                id="program-name"
                placeholder={
                  sebutan === "Kloter"
                    ? "Umrah Reguler Oktober 2026"
                    : "Nama kegiatan / proyek"
                }
                {...form.register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.startDate)}>
                <FieldLabel htmlFor="program-start">Tanggal mulai</FieldLabel>
                <Input
                  id="program-start"
                  type="date"
                  {...form.register("startDate")}
                />
                <FieldError errors={[errors.startDate]} />
              </Field>
              <Field data-invalid={Boolean(errors.endDate)}>
                <FieldLabel htmlFor="program-end">
                  Tanggal selesai (opsional)
                </FieldLabel>
                <Input id="program-end" type="date" {...form.register("endDate")} />
                <FieldError errors={[errors.endDate]} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.targetAmount)}>
                <FieldLabel htmlFor="program-target">
                  Target dana masuk (opsional)
                </FieldLabel>
                <Input
                  id="program-target"
                  inputMode="numeric"
                  placeholder="350000000"
                  {...form.register("targetAmount")}
                />
                <FieldError errors={[errors.targetAmount]} />
              </Field>
              <Field data-invalid={Boolean(errors.budgetAmount)}>
                <FieldLabel htmlFor="program-budget">
                  Anggaran keluar (opsional)
                </FieldLabel>
                <Input
                  id="program-budget"
                  inputMode="numeric"
                  placeholder="300000000"
                  {...form.register("budgetAmount")}
                />
                <FieldError errors={[errors.budgetAmount]} />
              </Field>
            </div>

            <Field data-invalid={Boolean(errors.description)}>
              <FieldLabel htmlFor="program-description">
                Keterangan (opsional)
              </FieldLabel>
              <Textarea
                id="program-description"
                placeholder="Rincian kegiatan, jadwal, atau ketentuan khusus"
                {...form.register("description")}
              />
              <FieldDescription>
                Maksimal 500 karakter.
              </FieldDescription>
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
