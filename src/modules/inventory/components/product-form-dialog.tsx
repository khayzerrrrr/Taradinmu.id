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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { createProduct } from "../actions/product-actions";
import {
  createProductSchema,
  type CreateProductFormValues,
} from "../schemas/product-schema";

export function ProductFormDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<CreateProductFormValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: { name: "", description: "" },
  });

  const { errors } = form.formState;

  async function onSubmit(values: CreateProductFormValues) {
    setSubmitting(true);
    const result = await createProduct(values);
    setSubmitting(false);

    if (result.success) {
      toast.success(result.message);
      form.reset();
      setOpen(false);
      router.refresh();
      return;
    }
    if (result.code === "UPGRADE_REQUIRED") {
      toast.error(result.message, { duration: 8000 });
      return;
    }
    toast.error(result.message);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Tambah Produk
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah Produk</DialogTitle>
          <DialogDescription>
            Produk akan tersimpan untuk tenant ini. Varian (SKU &amp; harga)
            ditambahkan setelahnya.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="product-name">Nama Produk</FieldLabel>
              <Input
                id="product-name"
                placeholder="Paracetamol / Baju Koko"
                {...form.register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field data-invalid={Boolean(errors.description)}>
              <FieldLabel htmlFor="product-description">
                Deskripsi (opsional)
              </FieldLabel>
              <Textarea
                id="product-description"
                placeholder="Keterangan singkat produk"
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
