"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Layers, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createVariant,
  deleteVariant,
  updateVariant,
} from "../actions/variant-actions";
import { createVariantSchema } from "../schemas/variant-schema";
import type { ProductListItem, VariantItem } from "../types";
import { formatRupiah } from "../utils";

// Form varian hanya butuh sku/name/price (productId/variantId dikirim terpisah).
const variantFormSchema = createVariantSchema.omit({ productId: true });

type VariantFormValues = {
  sku: string;
  name: string;
  price: string;
};

type Props = {
  product: ProductListItem;
};

export function VariantManagerDialog({ product }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<VariantItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const form = useForm<VariantFormValues>({
    resolver: zodResolver(variantFormSchema),
    defaultValues: { sku: "", name: "", price: "" },
  });

  const { errors } = form.formState;

  function mulaiEdit(variant: VariantItem) {
    setEditing(variant);
    setPendingDelete(null);
    form.reset({ sku: variant.sku, name: variant.name, price: variant.price });
  }

  function batalEdit() {
    setEditing(null);
    form.reset({ sku: "", name: "", price: "" });
  }

  async function onSubmit(values: VariantFormValues) {
    setSubmitting(true);
    const result = editing
      ? await updateVariant({ variantId: editing.id, ...values })
      : await createVariant({ productId: product.id, ...values });
    setSubmitting(false);

    if (result.success) {
      toast.success(result.message);
      batalEdit();
      router.refresh();
      return;
    }
    toast.error(result.message);
  }

  async function konfirmasiHapus(variantId: string) {
    setSubmitting(true);
    const result = await deleteVariant({ variantId });
    setSubmitting(false);
    setPendingDelete(null);

    if (result.success) {
      toast.success(result.message);
      router.refresh();
      return;
    }
    toast.error(result.message);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          batalEdit();
          setPendingDelete(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Layers />
          Varian ({product.variants.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Kelola Varian</DialogTitle>
          <DialogDescription>{product.name}</DialogDescription>
        </DialogHeader>

        {product.variants.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada varian. Tambahkan varian pertama (SKU &amp; harga) di
            bawah.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Nama Varian</TableHead>
                  <TableHead>Harga</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {product.variants.map((variant) => (
                  <TableRow key={variant.id}>
                    <TableCell className="font-mono text-xs">
                      {variant.sku}
                    </TableCell>
                    <TableCell>{variant.name}</TableCell>
                    <TableCell>{formatRupiah(variant.price)}</TableCell>
                    <TableCell className="text-right">
                      {pendingDelete === variant.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-muted-foreground">
                            Hapus?
                          </span>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={submitting}
                            onClick={() => void konfirmasiHapus(variant.id)}
                          >
                            Ya
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPendingDelete(null)}
                          >
                            Batal
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => mulaiEdit(variant)}
                            aria-label={`Edit varian ${variant.sku}`}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setPendingDelete(variant.id)}
                            aria-label={`Hapus varian ${variant.sku}`}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4 border-t pt-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {editing ? `Edit varian: ${editing.sku}` : "Tambah Varian"}
            </span>
            {editing ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={batalEdit}
              >
                <X />
                Batal edit
              </Button>
            ) : null}
          </div>

          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field data-invalid={Boolean(errors.sku)}>
                <FieldLabel htmlFor={`variant-sku-${product.id}`}>
                  SKU
                </FieldLabel>
                <Input
                  id={`variant-sku-${product.id}`}
                  placeholder="PCM-500"
                  {...form.register("sku")}
                />
                <FieldError errors={[errors.sku]} />
              </Field>
              <Field data-invalid={Boolean(errors.name)}>
                <FieldLabel htmlFor={`variant-name-${product.id}`}>
                  Nama Varian
                </FieldLabel>
                <Input
                  id={`variant-name-${product.id}`}
                  placeholder="Paracetamol 500mg"
                  {...form.register("name")}
                />
                <FieldError errors={[errors.name]} />
              </Field>
              <Field data-invalid={Boolean(errors.price)}>
                <FieldLabel htmlFor={`variant-price-${product.id}`}>
                  Harga (Rp)
                </FieldLabel>
                <Input
                  id={`variant-price-${product.id}`}
                  inputMode="decimal"
                  placeholder="12500"
                  {...form.register("price")}
                />
                <FieldError errors={[errors.price]} />
              </Field>
            </div>
          </FieldGroup>

          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={submitting}>
              <Plus />
              {submitting
                ? "Menyimpan..."
                : editing
                  ? "Simpan Perubahan"
                  : "Tambah Varian"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
