"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { createCustomer } from "../actions/customer-actions";
import {
  createCustomerSchema,
  type CreateCustomerFormValues,
} from "../schemas/customer-schema";

export function CustomerFormDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<CreateCustomerFormValues>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: { name: "", phone: "", email: "", address: "" },
  });

  const { errors } = form.formState;

  async function onSubmit(values: CreateCustomerFormValues) {
    setSubmitting(true);
    const result = await createCustomer(values);
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
          <UserPlus />
          Tambah Pelanggan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah Pelanggan</DialogTitle>
          <DialogDescription>
            Data pelanggan dipakai saat membuat invoice.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="customer-name">Nama Pelanggan</FieldLabel>
              <Input
                id="customer-name"
                placeholder="Toko Berkah / Bapak Ahmad"
                {...form.register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.phone)}>
                <FieldLabel htmlFor="customer-phone">
                  Telepon (opsional)
                </FieldLabel>
                <Input
                  id="customer-phone"
                  placeholder="0812xxxxxxx"
                  {...form.register("phone")}
                />
                <FieldError errors={[errors.phone]} />
              </Field>
              <Field data-invalid={Boolean(errors.email)}>
                <FieldLabel htmlFor="customer-email">
                  Email (opsional)
                </FieldLabel>
                <Input
                  id="customer-email"
                  type="email"
                  placeholder="pelanggan@email.com"
                  {...form.register("email")}
                />
                <FieldError errors={[errors.email]} />
              </Field>
            </div>

            <Field data-invalid={Boolean(errors.address)}>
              <FieldLabel htmlFor="customer-address">
                Alamat (opsional)
              </FieldLabel>
              <Textarea
                id="customer-address"
                placeholder="Alamat penagihan"
                {...form.register("address")}
              />
              <FieldError errors={[errors.address]} />
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
