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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { updateProduct } from "../actions/product-actions";
import {
  updateProductSchema,
  type UpdateProductFormValues,
} from "../schemas/product-schema";
import type { ProductListItem } from "../types";
import {
  ITEM_KINDS,
  ITEM_KIND_LABELS,
  type ItemKindValue,
} from "@/shared/item-kind";

type Props = {
  product: ProductListItem;
};

export function ProductEditDialog({ product }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<UpdateProductFormValues>({
    resolver: zodResolver(updateProductSchema),
    defaultValues: {
      productId: product.id,
      name: product.name,
      description: product.description ?? "",
      kind: product.kind,
    },
  });

  const { errors } = form.formState;
  const kind = useWatch({ control: form.control, name: "kind" });

  async function onSubmit(values: UpdateProductFormValues) {
    setSubmitting(true);
    const result = await updateProduct(values);
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
          <DialogTitle>Edit Item</DialogTitle>
          <DialogDescription>{product.name}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <FieldGroup>
            <Field data-invalid={Boolean(errors.kind)}>
              <FieldLabel>Jenis Item</FieldLabel>
              <Select
                value={kind}
                onValueChange={(value) =>
                  form.setValue("kind", value as ItemKindValue, {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih jenis item" />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_KINDS.map((nilai) => (
                    <SelectItem key={nilai} value={nilai}>
                      {ITEM_KIND_LABELS[nilai]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                Mengubah jenis memengaruhi perhitungan berikutnya: invoice untuk
                jasa tidak lagi memotong stok.
              </FieldDescription>
              <FieldError errors={[errors.kind]} />
            </Field>

            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor={`product-name-${product.id}`}>
                Nama Item
              </FieldLabel>
              <Input
                id={`product-name-${product.id}`}
                {...form.register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field data-invalid={Boolean(errors.description)}>
              <FieldLabel htmlFor={`product-description-${product.id}`}>
                Deskripsi (opsional)
              </FieldLabel>
              <Textarea
                id={`product-description-${product.id}`}
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
              {submitting ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
