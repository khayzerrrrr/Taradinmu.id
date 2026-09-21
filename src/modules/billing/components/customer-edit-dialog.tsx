"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
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
import { updateCustomer } from "../actions/customer-actions";
import {
  updateCustomerSchema,
  type UpdateCustomerFormValues,
} from "../schemas/customer-schema";
import type { CustomerItem } from "../types";

type Props = {
  customer: CustomerItem;
};

export function CustomerEditDialog({ customer }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<UpdateCustomerFormValues>({
    resolver: zodResolver(updateCustomerSchema),
    defaultValues: {
      customerId: customer.id,
      name: customer.name,
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      address: customer.address ?? "",
    },
  });

  const { errors } = form.formState;

  async function onSubmit(values: UpdateCustomerFormValues) {
    setSubmitting(true);
    const result = await updateCustomer(values);
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
        <Button variant="outline" size="sm">
          <Pencil />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Pelanggan</DialogTitle>
          <DialogDescription>{customer.name}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor={`customer-name-${customer.id}`}>
                Nama Pelanggan
              </FieldLabel>
              <Input
                id={`customer-name-${customer.id}`}
                {...form.register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={Boolean(errors.phone)}>
                <FieldLabel htmlFor={`customer-phone-${customer.id}`}>
                  Telepon (opsional)
                </FieldLabel>
                <Input
                  id={`customer-phone-${customer.id}`}
                  {...form.register("phone")}
                />
                <FieldError errors={[errors.phone]} />
              </Field>
              <Field data-invalid={Boolean(errors.email)}>
                <FieldLabel htmlFor={`customer-email-${customer.id}`}>
                  Email (opsional)
                </FieldLabel>
                <Input
                  id={`customer-email-${customer.id}`}
                  type="email"
                  {...form.register("email")}
                />
                <FieldError errors={[errors.email]} />
              </Field>
            </div>

            <Field data-invalid={Boolean(errors.address)}>
              <FieldLabel htmlFor={`customer-address-${customer.id}`}>
                Alamat (opsional)
              </FieldLabel>
              <Textarea
                id={`customer-address-${customer.id}`}
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
              {submitting ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
