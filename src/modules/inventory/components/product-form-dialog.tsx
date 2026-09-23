"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
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
import { createProduct } from "../actions/product-actions";
import {
  createProductSchema,
  type CreateProductFormValues,
} from "../schemas/product-schema";
import {
  ITEM_KINDS,
  ITEM_KIND_LABELS,
  type ItemKindValue,
} from "@/shared/item-kind";

type Props = {
  /** Nilai awal jenis item, diambil dari preset jenis usaha tenant. */
  defaultKind?: ItemKindValue;
};

export function ProductFormDialog({ defaultKind = "GOODS" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<CreateProductFormValues>({
    resolver: zodResolver(createProductSchema),
    defaultValues: { name: "", description: "", kind: defaultKind },
  });

  const { errors } = form.formState;
  const kind = useWatch({ control: form.control, name: "kind" });

  async function onSubmit(values: CreateProductFormValues) {
    setSubmitting(true);
    const result = await createProduct(values);
    setSubmitting(false);

    if (result.success) {
      toast.success(result.message);
      form.reset({ name: "", description: "", kind: defaultKind });
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
          Tambah Item
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah Item</DialogTitle>
          <DialogDescription>
            Item akan tersimpan untuk tenant ini. Varian (SKU &amp; harga)
            ditambahkan setelahnya.
          </DialogDescription>
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
                {kind === "SERVICE"
                  ? "Jasa tidak memakai stok, jadi invoice untuk item ini tidak memotong stok."
                  : "Barang memakai stok: setiap invoice akan memotong stok (FEFO)."}
              </FieldDescription>
              <FieldError errors={[errors.kind]} />
            </Field>

            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="product-name">Nama Item</FieldLabel>
              <Input
                id="product-name"
                placeholder={
                  kind === "SERVICE"
                    ? "Paket Umrah 9 hari / Cuci Kering 3 kg"
                    : "Paracetamol / Baju Koko"
                }
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
                placeholder="Keterangan singkat"
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
