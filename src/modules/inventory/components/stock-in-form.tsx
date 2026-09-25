"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PackagePlus } from "lucide-react";
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
import { DEFAULT_BATCH_NUMBER } from "@/lib/business-presets";
import { stockIn } from "../actions/stock-actions";
import { stockInSchema, type StockInFormValues } from "../schemas/stock-schema";
import type { SupplierOption, VariantOption } from "../types";

type Props = {
  variants: VariantOption[];
  /** Fitur batch aktif? Hanya paket PRO (PRD Bagian 4.D). */
  batchEnabled: boolean;
  /** Pemasok tenant ini, untuk asal barang (PRD 4.G.4). */
  suppliers: SupplierOption[];
};

// Radix Select tidak mengizinkan value string kosong, jadi "tanpa pemasok"
// memakai penanda ini lalu diterjemahkan kembali saat submit.
const TANPA_PEMASOK = "__tanpa_pemasok__";

export function StockInForm({ variants, batchEnabled, suppliers }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<StockInFormValues>({
    resolver: zodResolver(stockInSchema),
    defaultValues: {
      variantId: "",
      batchNumber: "",
      quantity: "",
      costPrice: "",
      supplierId: "",
      expiredDate: "",
      reference: "",
      notes: "",
    },
  });

  const { errors } = form.formState;
  const variantId = useWatch({ control: form.control, name: "variantId" });
  const dipilih = variants.find((variant) => variant.id === variantId);
  const supplierId =
    useWatch({ control: form.control, name: "supplierId" }) ?? "";

  async function onSubmit(values: StockInFormValues) {
    setSubmitting(true);
    const result = await stockIn({
      ...values,
      supplierId: values.supplierId === TANPA_PEMASOK ? "" : values.supplierId,
    });
    setSubmitting(false);

    if (result.success) {
      toast.success(result.message);
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
          <PackagePlus className="size-4" />
          Form Stok Masuk
        </CardTitle>
        <CardDescription>
          {batchEnabled
            ? "Nomor batch yang sama akan digabung ke batch yang sudah ada."
            : `Fitur batch tidak aktif untuk usaha ini. Stok akan dicatat pada batch "${DEFAULT_BATCH_NUMBER}".`}
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
                    Stok saat ini: {dipilih.available} unit layak
                    {dipilih.expired > 0
                      ? `, ${dipilih.expired} unit kedaluwarsa`
                      : ""}
                    {batchEnabled ? ` · ${dipilih.batchCount} batch` : ""}
                  </FieldDescription>
                ) : null}
                <FieldError errors={[errors.variantId]} />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                {batchEnabled ? (
                  <Field data-invalid={Boolean(errors.batchNumber)}>
                    <FieldLabel htmlFor="batchNumber">Nomor Batch</FieldLabel>
                    <Input
                      id="batchNumber"
                      placeholder="BATCH-2026-001"
                      {...form.register("batchNumber")}
                    />
                    <FieldError errors={[errors.batchNumber]} />
                  </Field>
                ) : null}
                <Field data-invalid={Boolean(errors.quantity)}>
                  <FieldLabel htmlFor="quantity">Jumlah Masuk</FieldLabel>
                  <Input
                    id="quantity"
                    inputMode="numeric"
                    placeholder="100"
                    className="tabular-nums"
                    {...form.register("quantity")}
                  />
                  <FieldError errors={[errors.quantity]} />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={Boolean(errors.costPrice)}>
                  <FieldLabel htmlFor="costPrice">
                    Harga Modal per Unit (opsional)
                  </FieldLabel>
                  <Input
                    id="costPrice"
                    inputMode="numeric"
                    placeholder="12500"
                    className="tabular-nums"
                    {...form.register("costPrice")}
                  />
                  <FieldDescription>
                    Modal beli per unit. Kosong berarti belum dicatat — bukan nol,
                    supaya laba tidak terlihat lebih besar dari sebenarnya. Pada
                    batch yang sudah ada, harga digabung rata-rata tertimbang.
                  </FieldDescription>
                  <FieldError errors={[errors.costPrice]} />
                </Field>

                <Field data-invalid={Boolean(errors.supplierId)}>
                  <FieldLabel>Pemasok (opsional)</FieldLabel>
                  <Select
                    value={supplierId.length > 0 ? supplierId : TANPA_PEMASOK}
                    onValueChange={(value) =>
                      form.setValue("supplierId", value, {
                        shouldValidate: true,
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Tanpa pemasok" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TANPA_PEMASOK}>
                        Tanpa pemasok
                      </SelectItem>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Batch yang sudah punya pemasok tidak diganti oleh stok masuk
                    berikutnya. {suppliers.length === 0 ? "Belum ada pemasok tercatat — tambahkan di halaman Pemasok." : ""}
                  </FieldDescription>
                  <FieldError errors={[errors.supplierId]} />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {batchEnabled ? (
                  <Field data-invalid={Boolean(errors.expiredDate)}>
                    <FieldLabel htmlFor="expiredDate">
                      Tanggal Kedaluwarsa (opsional)
                    </FieldLabel>
                    <Input
                      id="expiredDate"
                      type="date"
                      {...form.register("expiredDate")}
                    />
                    <FieldDescription>
                      Wajib untuk F&amp;B dan farmasi. Batch tanpa tanggal tidak
                      akan dianggap kedaluwarsa.
                    </FieldDescription>
                    <FieldError errors={[errors.expiredDate]} />
                  </Field>
                ) : null}
                <Field data-invalid={Boolean(errors.reference)}>
                  <FieldLabel htmlFor="reference">
                    Referensi (opsional)
                  </FieldLabel>
                  <Input
                    id="reference"
                    placeholder="PO-002"
                    {...form.register("reference")}
                  />
                  <FieldError errors={[errors.reference]} />
                </Field>
              </div>

              {!batchEnabled ? (
                <FieldDescription>
                  Pelacakan nomor batch &amp; tanggal kedaluwarsa tersedia pada
                  paket PRO atau jenis usaha Ritel/Kuliner.
                </FieldDescription>
              ) : null}

              <Field data-invalid={Boolean(errors.notes)}>
                <FieldLabel htmlFor="notes">Catatan (opsional)</FieldLabel>
                <Textarea
                  id="notes"
                  placeholder="Catatan penerimaan barang"
                  {...form.register("notes")}
                />
                <FieldError errors={[errors.notes]} />
              </Field>
            </FieldGroup>

            <Button type="submit" disabled={submitting} size="lg" className="ml-auto">
              {submitting ? "Menyimpan..." : "Simpan Stok Masuk"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
