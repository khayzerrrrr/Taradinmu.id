"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PackageMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { stockOut } from "../actions/stock-actions";
import { stockOutSchema, type StockOutFormValues } from "../schemas/stock-schema";
import type { VariantOption } from "../types";

type Props = {
  variants: VariantOption[];
};

export function StockOutForm({ variants }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<StockOutFormValues>({
    resolver: zodResolver(stockOutSchema),
    defaultValues: { variantId: "", quantity: "", reference: "", notes: "" },
  });

  const { errors } = form.formState;
  const variantId = useWatch({ control: form.control, name: "variantId" });
  const dipilih = variants.find((variant) => variant.id === variantId);

  async function onSubmit(values: StockOutFormValues) {
    setSubmitting(true);
    const result = await stockOut(values);
    setSubmitting(false);

    if (result.success && result.data) {
      // Tampilkan batch mana saja yang terpakai (transparansi FEFO).
      const rincian = result.data.allocations
        .map((alokasi) => `${alokasi.batchNumber}: ${alokasi.quantity}`)
        .join(", ");
      toast.success(
        rincian ? `${result.message} — ${rincian}` : result.message,
      );
      form.reset();
      router.refresh();
      return;
    }
    toast.error(result.message);
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PackageMinus className="size-4" />
          Form Stok Keluar
        </CardTitle>
        <CardDescription>
          Alokasi otomatis memakai FEFO: batch dengan kedaluwarsa terdekat
          dipakai lebih dulu. Batch kedaluwarsa dilewati.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {variants.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada varian. Tambahkan produk &amp; varian lebih dulu di halaman
            Produk.
          </p>
        ) : (
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FieldGroup>
              <Field data-invalid={Boolean(errors.variantId)}>
                <FieldLabel>Varian</FieldLabel>
                <Select
                  value={variantId}
                  onValueChange={(value) =>
                    form.setValue("variantId", value, { shouldValidate: true })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pilih varian" />
                  </SelectTrigger>
                  <SelectContent>
                    {variants.map((variant) => (
                      <SelectItem key={variant.id} value={variant.id}>
                        {variant.productName} · {variant.name} ({variant.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {dipilih ? (
                  <FieldDescription>
                    Stok layak keluar: <strong>{dipilih.available}</strong> unit
                    {dipilih.expired > 0
                      ? ` · ${dipilih.expired} unit kedaluwarsa (tidak diikutkan)`
                      : ""}
                  </FieldDescription>
                ) : null}
                <FieldError errors={[errors.variantId]} />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={Boolean(errors.quantity)}>
                  <FieldLabel htmlFor="quantityOut">Jumlah Keluar</FieldLabel>
                  <Input
                    id="quantityOut"
                    inputMode="numeric"
                    placeholder="5"
                    className="tabular-nums"
                    {...form.register("quantity")}
                  />
                  <FieldError errors={[errors.quantity]} />
                </Field>
                <Field data-invalid={Boolean(errors.reference)}>
                  <FieldLabel htmlFor="referenceOut">
                    Referensi (opsional)
                  </FieldLabel>
                  <Input
                    id="referenceOut"
                    placeholder="INV-001"
                    {...form.register("reference")}
                  />
                  <FieldError errors={[errors.reference]} />
                </Field>
              </div>

              <Field data-invalid={Boolean(errors.notes)}>
                <FieldLabel htmlFor="notesOut">Catatan (opsional)</FieldLabel>
                <Textarea
                  id="notesOut"
                  placeholder="Tujuan pengeluaran barang"
                  {...form.register("notes")}
                />
                <FieldError errors={[errors.notes]} />
              </Field>
            </FieldGroup>

            <Button type="submit" disabled={submitting} size="lg" className="ml-auto">
              {submitting ? "Memproses..." : "Proses Stok Keluar"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
